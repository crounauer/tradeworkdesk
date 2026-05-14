import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { requireStripe } from "../lib/stripe";
import { supabaseAdmin } from "../lib/supabase";
import {
  sendInvoiceEmail,
  sendPaymentFailedEmail,
} from "../lib/email";
import { syncSeats } from "./billing";
import { getPayPalAccessToken, PP_BASE } from "./paypal-payments";
import { getPlatformSetting } from "../lib/geocode";
import { decryptToken } from "../lib/accounting/crypto";

const router = Router();

const BILLING_URL = process.env.APP_URL
  ? `${process.env.APP_URL}/billing`
  : "https://tradeworkdesk.co.uk/billing";

router.post(
  "/webhooks/stripe",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const stripeClient = requireStripe();
    let event;

    try {
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
      event = stripeClient.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("[webhook] Signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as {
            metadata?: { tenant_id?: string; plan_id?: string; billing_cycle?: string };
            customer?: string;
            subscription?: string;
          };
          const tenantId = session.metadata?.tenant_id;
          if (!tenantId) break;

          const updates: Record<string, unknown> = {
            status: "active",
            subscription_started_at: new Date().toISOString(),
          };
          if (session.customer) updates.stripe_customer_id = session.customer;
          if (session.subscription) updates.stripe_subscription_id = session.subscription;
          if (session.metadata?.plan_id) updates.plan_id = session.metadata.plan_id;

          if (session.subscription) {
            const sub = await stripeClient.subscriptions.retrieve(session.subscription as string) as unknown as { current_period_end: number };
            updates.subscription_renewal_at = new Date(sub.current_period_end * 1000).toISOString();
          }

          await supabaseAdmin.from("tenants").update(updates as Record<string, unknown>).eq("id", tenantId);

          // Store per-seat subscription item ID so syncSeats can update quantity later
          if (session.subscription && session.metadata?.plan_id) {
            try {
              const { data: planRaw } = await supabaseAdmin
                .from("plans")
                .select("stripe_per_seat_price_id")
                .eq("id", session.metadata.plan_id)
                .single();
              const plan = planRaw as { stripe_per_seat_price_id: string | null } | null;

              if (plan?.stripe_per_seat_price_id) {
                const sub = await stripeClient.subscriptions.retrieve(session.subscription as string);
                const perSeatItem = (sub.items as { data: Array<{ id: string; price: { id: string } }> }).data
                  .find((i) => i.price.id === plan.stripe_per_seat_price_id);
                if (perSeatItem) {
                  await supabaseAdmin
                    .from("tenants")
                    .update({ stripe_per_seat_item_id: perSeatItem.id } as Record<string, unknown>)
                    .eq("id", tenantId);
                }
              }
            } catch (e) {
              console.error("[webhook] Failed to store per-seat item ID:", e);
            }
          }

          await supabaseAdmin.from("platform_audit_log").insert({
            event_type: "subscription_activated",
            entity_type: "tenant",
            entity_id: tenantId,
            detail: { stripe_customer: session.customer, stripe_subscription: session.subscription },
          });
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as {
            customer?: string;
            subscription?: string;
            amount_paid?: number;
            currency?: string;
            hosted_invoice_url?: string;
            lines?: { data?: Array<{ period?: { end?: number } }> };
          };

          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("id, contact_email, company_name")
            .eq("stripe_customer_id", invoice.customer!)
            .maybeSingle();

          if (tenant && invoice.subscription) {
            const sub = await stripeClient.subscriptions.retrieve(invoice.subscription as string) as unknown as { current_period_end: number };
            const renewalAt = new Date(sub.current_period_end * 1000).toISOString();

            await supabaseAdmin.from("tenants").update({
              status: "active",
              subscription_renewal_at: renewalAt,
            }).eq("id", tenant.id);

            await supabaseAdmin.from("platform_audit_log").insert({
              actor_email: "stripe",
              event_type: "subscription_renewed",
              entity_type: "tenant",
              entity_id: tenant.id,
              detail: { amount_paid: invoice.amount_paid, currency: invoice.currency, renewal_at: renewalAt },
            });

            if (tenant.contact_email && invoice.amount_paid && invoice.currency && invoice.hosted_invoice_url) {
              await sendInvoiceEmail(
                tenant.contact_email,
                tenant.company_name,
                invoice.amount_paid,
                invoice.currency,
                renewalAt,
                invoice.hosted_invoice_url,
              );
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as {
            customer?: string;
            amount_due?: number;
            currency?: string;
          };

          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("id, contact_email, company_name")
            .eq("stripe_customer_id", invoice.customer!)
            .maybeSingle();

          if (tenant) {
            await supabaseAdmin.from("tenants").update({ status: "payment_overdue" }).eq("id", tenant.id);

            if (tenant.contact_email && invoice.amount_due && invoice.currency) {
              await sendPaymentFailedEmail(
                tenant.contact_email,
                tenant.company_name,
                invoice.amount_due,
                invoice.currency,
                BILLING_URL,
              );
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          // No addon sync needed in the simplified plan model.
          // Per-seat quantity changes are pushed from the API, not pulled from Stripe.
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as { customer?: string };

          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("id")
            .eq("stripe_customer_id", sub.customer!)
            .maybeSingle();

          if (tenant) {
            await supabaseAdmin.from("tenants").update({
              status: "cancelled",
              stripe_subscription_id: null,
            }).eq("id", tenant.id);

            await supabaseAdmin.from("platform_audit_log").insert({
              event_type: "subscription_cancelled",
              entity_type: "tenant",
              entity_id: tenant.id,
              detail: { stripe_customer: sub.customer },
            });
          }
          break;
        }

        default:
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[webhook] Handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);

// ── POST /webhooks/stripe-connect ────────────────────────────────────────────
// Handles events from connected accounts (e.g. customer invoice payments).
// Stripe sends these with a Stripe-Account header identifying the tenant account.

router.post(
  "/webhooks/stripe-connect",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // Not configured — silently ignore rather than erroring
      res.json({ received: true });
      return;
    }

    const stripeClient = requireStripe();
    let event;

    try {
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
      event = stripeClient.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("[webhook-connect] Signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      // Handle checkout.session.completed for invoice payments
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as {
          id: string;
          metadata?: { invoice_id?: string; tenant_id?: string };
          payment_status?: string;
          amount_total?: number | null;
          currency?: string | null;
        };

        const invoiceId = session.metadata?.invoice_id;
        const tenantId = session.metadata?.tenant_id;

        if (invoiceId && tenantId && session.payment_status === "paid") {
          const nowIso = new Date().toISOString();

          const { data: inv } = await supabaseAdmin
            .from("invoices")
            .select("id, status, total, currency")
            .eq("id", invoiceId)
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (inv && !["paid", "cancelled"].includes((inv as any).status)) {
            await supabaseAdmin
              .from("invoices")
              .update({
                status: "paid",
                payment_date: nowIso.slice(0, 10),
                paid_amount: (inv as any).total,
                payment_method: "card",
                updated_at: nowIso,
              } as Record<string, unknown>)
              .eq("id", invoiceId)
              .eq("tenant_id", tenantId);

            console.log(`[webhook-connect] Invoice ${invoiceId} marked paid via Stripe Connect`);
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[webhook-connect] Handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);

// ─── GoCardless webhook ───────────────────────────────────────────────────────
// POST /webhooks/gocardless
// Listens for billing_request.fulfilled events and marks invoices paid.
router.post(
  "/webhooks/gocardless",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const webhookSecret = await getPlatformSetting("gocardless_webhook_secret", "GOCARDLESS_WEBHOOK_SECRET").catch(() => null);
    if (!webhookSecret) { res.json({ received: true }); return; }

    // Verify HMAC-SHA256 signature
    const sig = req.headers["webhook-signature"] as string | undefined;
    if (!sig) { res.status(400).json({ error: "Missing signature" }); return; }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      const { events } = req.body as {
        events: Array<{
          resource_type: string;
          action: string;
          links: { billing_request?: string };
        }>;
      };

      for (const event of events || []) {
        if (event.resource_type === "billing_requests" && event.action === "fulfilled") {
          const billingRequestId = event.links.billing_request;
          if (!billingRequestId) continue;

          const { data: inv } = await supabaseAdmin
            .from("invoices")
            .select("id, status, total, tenant_id")
            .eq("gocardless_billing_request_id", billingRequestId)
            .maybeSingle();

          if (inv && !["paid", "cancelled"].includes((inv as any).status)) {
            const nowIso = new Date().toISOString();
            await supabaseAdmin
              .from("invoices")
              .update({
                status: "paid",
                payment_date: nowIso.slice(0, 10),
                paid_amount: (inv as any).total,
                payment_method: "direct_debit",
                updated_at: nowIso,
              } as Record<string, unknown>)
              .eq("id", (inv as any).id);

            console.log(`[webhook-gc] Invoice ${(inv as any).id} marked paid via GoCardless`);
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[webhook-gc] Handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  },
);

// ─── PayPal webhook ──────────────────────────────────────────────────────────
// POST /webhooks/paypal
// Handles PAYMENT.CAPTURE.COMPLETED and CHECKOUT.ORDER.APPROVED events.
router.post(
  "/webhooks/paypal",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    try {
      const event = req.body as {
        event_type: string;
        resource: {
          id?: string;
          custom_id?: string;
          purchase_units?: Array<{ custom_id?: string; reference_id?: string }>;
        };
      };

      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        // custom_id is "{tenantId}:{invoiceId}" set when creating the order
        const customId = event.resource.custom_id;
        if (customId) {
          const [tenantId, invoiceId] = customId.split(":");
          if (tenantId && invoiceId) {
            const { data: inv } = await supabaseAdmin
              .from("invoices")
              .select("id, status, total")
              .eq("id", invoiceId)
              .eq("tenant_id", tenantId)
              .maybeSingle();

            if (inv && !["paid", "cancelled"].includes((inv as any).status)) {
              const nowIso = new Date().toISOString();

              // Capture the order to complete the payment
              const creds = await (async () => {
                const { data: t } = await supabaseAdmin
                  .from("tenants")
                  .select("paypal_client_id, paypal_client_secret")
                  .eq("id", tenantId)
                  .single();
                const raw = t as any;
                if (!raw?.paypal_client_id || !raw?.paypal_client_secret) return null;
                try {
                  return { clientId: decryptToken(raw.paypal_client_id), secret: decryptToken(raw.paypal_client_secret) };
                } catch { return null; }
              })();

              if (creds) {
                try {
                  const ppToken = await getPayPalAccessToken(creds.clientId, creds.secret);
                  await fetch(`${PP_BASE}/v2/checkout/orders/${event.resource.id}/capture`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${ppToken}`, "Content-Type": "application/json" },
                  });
                } catch { /* already captured or non-fatal */ }
              }

              await supabaseAdmin
                .from("invoices")
                .update({
                  status: "paid",
                  payment_date: nowIso.slice(0, 10),
                  paid_amount: (inv as any).total,
                  payment_method: "card",
                  updated_at: nowIso,
                } as Record<string, unknown>)
                .eq("id", invoiceId)
                .eq("tenant_id", tenantId);

              console.log(`[webhook-paypal] Invoice ${invoiceId} marked paid via PayPal`);
            }
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[webhook-paypal] Handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  },
);

// ─── TrueLayer webhook ────────────────────────────────────────────────────────
// POST /webhooks/truelayer
// Handles payment_settled events and marks invoices paid.
router.post(
  "/webhooks/truelayer",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    try {
      const event = req.body as {
        type: string;
        payment_id?: string;
        metadata?: { invoice_id?: string; tenant_id?: string };
      };

      if (event.type === "payment_settled" || event.type === "payment_executed") {
        const invoiceId = event.metadata?.invoice_id;
        const tenantId = event.metadata?.tenant_id;

        if (invoiceId && tenantId) {
          const { data: inv } = await supabaseAdmin
            .from("invoices")
            .select("id, status, total")
            .eq("id", invoiceId)
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (inv && !["paid", "cancelled"].includes((inv as any).status)) {
            const nowIso = new Date().toISOString();
            await supabaseAdmin
              .from("invoices")
              .update({
                status: "paid",
                payment_date: nowIso.slice(0, 10),
                paid_amount: (inv as any).total,
                payment_method: "bank_transfer",
                updated_at: nowIso,
              } as Record<string, unknown>)
              .eq("id", invoiceId)
              .eq("tenant_id", tenantId);

            console.log(`[webhook-truelayer] Invoice ${invoiceId} marked paid via TrueLayer`);
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[webhook-truelayer] Handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  },
);

export default router;
