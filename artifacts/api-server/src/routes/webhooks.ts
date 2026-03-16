import { Router, type Request, type Response } from "express";
import { requireStripe } from "../lib/stripe";
import { supabaseAdmin } from "../lib/supabase";
import {
  sendInvoiceEmail,
  sendPaymentFailedEmail,
} from "../lib/email";

const router = Router();

const BILLING_URL = process.env.APP_URL
  ? `${process.env.APP_URL}/billing`
  : "https://boilertech.app/billing";

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
            metadata?: { tenant_id?: string };
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

          if (session.subscription) {
            const sub = await stripeClient.subscriptions.retrieve(session.subscription as string) as unknown as { current_period_end: number };
            updates.subscription_renewal_at = new Date(sub.current_period_end * 1000).toISOString();
          }

          await supabaseAdmin.from("tenants").update(updates).eq("id", tenantId);

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

export default router;
