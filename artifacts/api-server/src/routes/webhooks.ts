import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getStripe } from "../lib/stripe";
import { supabaseAdmin } from "../lib/supabase";
import {
  sendInvoiceEmail,
  sendPaymentFailedEmail,
} from "../lib/email";
import { sendPaymentReceiptEmail } from "../lib/invoice-email";
import { generateInvoicePdf } from "../lib/invoice-pdf";
import { recordInvoicePayment } from "../lib/invoice-payments";
import { topUpAddonCredits } from "../lib/tenant-limits";
import { syncSeats } from "./billing";
import { bustInitCache } from "./platform";
import { getPlatformSetting } from "../lib/geocode";

const router = Router();

/** Fetch invoice + customer + company, generate PDF, send a payment receipt email. */
async function sendReceiptForInvoice(invoiceId: string, tenantId: string, paidAmount: number, paymentMethod: string): Promise<void> {
  try {
    const [{ data: inv }, { data: lineItems }] = await Promise.all([
      supabaseAdmin
        .from("invoices")
        .select("invoice_number, currency, customer_id, job_id, issue_date, due_date, expiry_date, subtotal, vat_rate, vat_amount, total, works_order, customer_notes")
        .eq("id", invoiceId)
        .eq("tenant_id", tenantId)
        .single(),
      supabaseAdmin
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order"),
    ]);
    if (!inv) return;

    const [{ data: customer }, { data: cs }] = await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("first_name, last_name, email, phone, mobile, address_line1, address_line2, city, county, postcode")
        .eq("id", (inv as any).customer_id)
        .maybeSingle(),
      supabaseAdmin
        .from("company_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("singleton_id", "default")
        .maybeSingle(),
    ]);

    const customerEmail: string | null = (customer as any)?.email ?? null;
    if (!customerEmail) return;

    const customerName = customer
      ? `${(customer as any).first_name} ${(customer as any).last_name}`.trim()
      : "Customer";

    let propertyData: Record<string, unknown> | null = null;
    if ((inv as any).job_id) {
      const { data: job } = await supabaseAdmin.from("jobs").select("property_id").eq("id", (inv as any).job_id).maybeSingle();
      if ((job as any)?.property_id) {
        const { data: prop } = await supabaseAdmin.from("properties").select("address_line1, address_line2, city, county, postcode").eq("id", (job as any).property_id).maybeSingle();
        propertyData = prop as Record<string, unknown> | null;
      }
    }

    const i = inv as any;
    const c = customer as any;
    const s = cs as any;

    const pdfBuffer = generateInvoicePdf({
      type: "invoice",
      invoice_number: i.invoice_number,
      issue_date: i.issue_date,
      due_date: i.due_date,
      expiry_date: i.expiry_date,
      currency: i.currency || "GBP",
      company_name: s?.name || null,
      company_trading_name: s?.trading_name || null,
      company_address_line1: s?.address_line1 || null,
      company_address_line2: s?.address_line2 || null,
      company_city: s?.city || null,
      company_county: s?.county || null,
      company_postcode: s?.postcode || null,
      company_phone: s?.phone || null,
      company_email: s?.email || null,
      company_website: s?.website || null,
      company_vat_number: s?.vat_number || null,
      company_gas_safe_number: s?.gas_safe_number || null,
      company_oftec_number: s?.oftec_number || null,
      company_footer_text: s?.invoice_footer_text || null,
      company_bank_details: s?.show_bank_details_on_invoices === false ? null : (s?.invoice_bank_details || null),
      company_additional_text: s?.invoice_additional_text || null,
      customer_name: customerName,
      customer_address_line1: c?.address_line1 || (propertyData as any)?.address_line1 || null,
      customer_address_line2: c?.address_line2 || (propertyData as any)?.address_line2 || null,
      customer_city: c?.city || (propertyData as any)?.city || null,
      customer_county: c?.county || (propertyData as any)?.county || null,
      customer_postcode: c?.postcode || (propertyData as any)?.postcode || null,
      customer_email: customerEmail,
      customer_phone: c?.phone || c?.mobile || null,
      job_reference: null,
      job_description: null,
      line_items: (lineItems || []).map((l: any) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        total: Number(l.total),
        item_type: l.item_type,
      })),
      subtotal: Number(i.subtotal),
      vat_rate: Number(i.vat_rate),
      vat_amount: Number(i.vat_amount),
      total: Number(i.total),
      works_order: i.works_order || null,
      customer_notes: i.customer_notes || null,
    });

    await sendPaymentReceiptEmail({
      to: customerEmail,
      invoiceNumber: i.invoice_number,
      customerName,
      paidAmount,
      currency: (i.currency || "GBP").toUpperCase(),
      paymentMethod,
      pdfBuffer,
      company: {
        name: s?.name || null,
        trading_name: s?.trading_name || null,
        email: s?.email || null,
        notification_emails: s?.notification_emails || null,
        logo_url: s?.logo_url || null,
        rates_url: s?.rates_url || null,
        trading_terms_url: s?.trading_terms_url || null,
      },
    });
  } catch (err) {
    // Receipt email failure must never break the webhook response
    console.error(`[receipt-email] Failed for invoice ${invoiceId}:`, (err as Error).message);
  }
}

const BILLING_URL = process.env.APP_URL
  ? `${process.env.APP_URL}/billing`
  : "https://tradeworkdesk.co.uk/billing";

router.post(
  "/webhooks/stripe",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = await getPlatformSetting("stripe_webhook_secret", "STRIPE_WEBHOOK_SECRET").catch(() => null);

    if (!webhookSecret) {
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const stripeClient = await getStripe();
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
            id?: string;
            metadata?: {
              tenant_id?: string;
              plan_id?: string;
              billing_cycle?: string;
              type?: string;
              addon_id?: string;
              bundles?: string;
              bundle_size?: string;
            };
            customer?: string;
            subscription?: string;
            payment_status?: string;
          };

          if (session.metadata?.type === "credit_topup") {
            const tenantId = session.metadata.tenant_id;
            const addonId = session.metadata.addon_id;
            const bundles = Math.max(1, Math.floor(Number(session.metadata.bundles || "1") || 1));
            const bundleSize = Math.max(1, Math.floor(Number(session.metadata.bundle_size || "0") || 0));

            if (tenantId && addonId && session.payment_status === "paid") {
              const { data: alreadyProcessed } = await supabaseAdmin
                .from("platform_audit_log")
                .select("id")
                .eq("event_type", "credit_topup_completed")
                .eq("entity_type", "tenant")
                .eq("entity_id", tenantId)
                .contains("detail", { session_id: session.id })
                .maybeSingle();

              if (!alreadyProcessed) {
                await topUpAddonCredits(tenantId, addonId, bundles, bundleSize > 0 ? bundleSize : undefined);
                await supabaseAdmin.from("platform_audit_log").insert({
                  actor_email: "stripe",
                  event_type: "credit_topup_completed",
                  entity_type: "tenant",
                  entity_id: tenantId,
                  detail: {
                    session_id: session.id,
                    addon_id: addonId,
                    bundles,
                    bundle_size: bundleSize,
                  },
                });
              }
            }

            break;
          }

          const tenantId = session.metadata?.tenant_id;
          if (!tenantId) break;

          const updates: Record<string, unknown> = {
            status: "active",
            trial_ends_at: null,
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
          bustInitCache(tenantId);

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
    const webhookSecret = await getPlatformSetting("stripe_connect_webhook_secret", "STRIPE_CONNECT_WEBHOOK_SECRET").catch(() => null);

    if (!webhookSecret) {
      // Not configured — silently ignore rather than erroring
      res.json({ received: true });
      return;
    }

    const stripeClient = await getStripe();
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
            const stripeTotal = session.amount_total != null
              ? session.amount_total / 100
              : Number((inv as any).total);

            await recordInvoicePayment({
              invoiceId,
              tenantId,
              amount: stripeTotal,
              paymentDate: nowIso.slice(0, 10),
              paymentMethod: "card",
              paymentReference: session.id || null,
            });

            console.log(`[webhook-connect] Invoice ${invoiceId} marked paid via Stripe Connect`);
            void sendReceiptForInvoice(invoiceId, tenantId, stripeTotal, "card");
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
            const gcTotal = Number((inv as any).total);

            await recordInvoicePayment({
              invoiceId: (inv as any).id,
              tenantId: (inv as any).tenant_id,
              amount: gcTotal,
              paymentDate: nowIso.slice(0, 10),
              paymentMethod: "direct_debit",
              paymentReference: billingRequestId || null,
            });

            console.log(`[webhook-gc] Invoice ${(inv as any).id} marked paid via GoCardless`);
            void sendReceiptForInvoice((inv as any).id, (inv as any).tenant_id, gcTotal, "gocardless");
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

export default router;
