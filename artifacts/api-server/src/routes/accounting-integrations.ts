import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  getProvider,
  getAvailableProvidersWithStatus,
  getActiveIntegration,
  ensureFreshToken,
} from "../lib/accounting/registry";
import type { AccountingIntegrationRow } from "../lib/accounting/types";
import { encryptToken, isEncryptionConfigured } from "../lib/accounting/crypto";
import { buildInvoiceData } from "./jobs";

const router: IRouter = Router();

const pendingOAuthStates = new Map<string, { tenantId: string; provider: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingOAuthStates) {
    if (val.expiresAt < now) pendingOAuthStates.delete(key);
  }
}, 60_000);

router.get(
  "/admin/accounting-integrations",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const providers = await getAvailableProvidersWithStatus(req.tenantId!);
      res.json({ providers, encryption_configured: isEncryptionConfigured() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.get(
  "/admin/accounting-integrations/:provider/auth-url",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      if (!isEncryptionConfigured()) {
        res.status(500).json({ error: "Accounting integration encryption is not configured. Please set ACCOUNTING_ENCRYPTION_KEY or SOCIAL_ENCRYPTION_KEY." });
        return;
      }

      const providerKey = req.params.provider;
      const provider = getProvider(providerKey);
      if (!provider) {
        res.status(400).json({ error: `Unknown provider: ${providerKey}` });
        return;
      }

      const state = crypto.randomBytes(32).toString("hex");
      pendingOAuthStates.set(state, {
        tenantId: req.tenantId!,
        provider: providerKey,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const host = req.get("host") || "localhost";
      const redirectUri = `https://${host}/api/admin/accounting-integrations/${providerKey}/callback`;

      const authUrl = provider.getAuthUrl(redirectUri, state);
      res.json({ auth_url: authUrl, state });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.get(
  "/admin/accounting-integrations/:provider/callback",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };

      if (!code || !state) {
        res.status(400).send("Missing code or state parameter");
        return;
      }

      const pending = pendingOAuthStates.get(state);
      if (!pending) {
        res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
        return;
      }

      pendingOAuthStates.delete(state);
      const providerKey = pending.provider;
      const tenantId = pending.tenantId;

      const provider = getProvider(providerKey);
      if (!provider) {
        res.status(400).send(`Unknown provider: ${providerKey}`);
        return;
      }

      const host = req.get("host") || "localhost";
      const redirectUri = `https://${host}/api/admin/accounting-integrations/${providerKey}/callback`;

      const tokens = await provider.exchangeCode(code, redirectUri);

      await supabaseAdmin
        .from("accounting_integrations")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .neq("provider", providerKey);

      const { error: upsertError } = await supabaseAdmin
        .from("accounting_integrations")
        .upsert(
          {
            tenant_id: tenantId,
            provider: providerKey,
            access_token: encryptToken(tokens.access_token),
            refresh_token: encryptToken(tokens.refresh_token),
            token_expires_at: tokens.token_expires_at.toISOString(),
            organisation_id: tokens.organisation_id || null,
            extra_config: tokens.extra_config || {},
            connected_at: new Date().toISOString(),
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,provider" }
        );

      if (upsertError) {
        res.status(500).send(`Failed to save integration: ${upsertError.message}`);
        return;
      }

      const origin = `https://${host}`;
      const html = `<!DOCTYPE html><html><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'accounting-integration-connected', provider: '${providerKey}' }, '${origin}');
            window.close();
          } else {
            window.location.href = '/admin/company-settings';
          }
        </script>
        <p>Connected successfully! You can close this window.</p>
      </body></html>`;

      res.type("html").send(html);
    } catch (err) {
      const msg = (err as Error).message;
      res.status(500).send(`Connection failed: ${msg}. Please try again.`);
    }
  }
);

router.delete(
  "/admin/accounting-integrations/:provider",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const providerKey = req.params.provider;

      const { error } = await supabaseAdmin
        .from("accounting_integrations")
        .delete()
        .eq("tenant_id", req.tenantId!)
        .eq("provider", providerKey);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.get(
  "/accounting-integration/active",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const integration = await getActiveIntegration(req.tenantId!);
      if (!integration) {
        res.json({ connected: false, provider: null });
        return;
      }
      res.json({
        connected: true,
        provider: integration.provider,
        displayName: getProvider(integration.provider)?.displayName || integration.provider,
        organisation_id: integration.organisation_id,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.post(
  "/jobs/:id/send-to-accounting",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const jobId = req.params.id;
      const tenantId = req.tenantId!;

      const { data: job } = await supabaseAdmin
        .from("jobs")
        .select("id, status, external_invoice_id, external_invoice_provider, customer_id")
        .eq("id", jobId)
        .eq("tenant_id", tenantId)
        .single();

      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      if (job.status !== "completed" && job.status !== "invoiced") {
        res.status(400).json({ error: "Job must be completed or invoiced before sending to accounting" });
        return;
      }

      if (job.external_invoice_id) {
        res.status(409).json({
          error: "Invoice already sent",
          external_invoice_id: job.external_invoice_id,
          provider: job.external_invoice_provider,
        });
        return;
      }

      const integration = await getActiveIntegration(tenantId);
      if (!integration) {
        res.status(400).json({ error: "No accounting integration connected" });
        return;
      }

      const provider = getProvider(integration.provider);
      if (!provider) {
        res.status(400).json({ error: `Provider ${integration.provider} not available` });
        return;
      }

      const accessToken = await ensureFreshToken(integration);

      const invoiceData = await buildInvoiceData(jobId, tenantId);
      if (!invoiceData) {
        res.status(400).json({ error: "Could not build invoice data for this job" });
        return;
      }

      const contact = await provider.findOrCreateContact(
        accessToken,
        integration.organisation_id || "",
        {
          name: invoiceData.customer_name,
          email: invoiceData.customer_email || undefined,
          address: invoiceData.customer_address || undefined,
        }
      );

      const invoiceResult = await provider.createInvoice(
        accessToken,
        integration.organisation_id || "",
        {
          contact_id: contact.id,
          invoice_number: invoiceData.invoice_number,
          date: invoiceData.invoice_date,
          due_date: invoiceData.due_date,
          currency: invoiceData.currency,
          line_items: invoiceData.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            tax_percentage: invoiceData.vat_rate,
          })),
          reference: jobId.substring(0, 8),
        }
      );

      const { error: updateError } = await supabaseAdmin
        .from("jobs")
        .update({
          external_invoice_id: invoiceResult.external_id,
          external_invoice_provider: integration.provider,
        })
        .eq("id", jobId)
        .eq("tenant_id", tenantId);

      if (updateError) {
        res.status(500).json({
          error: "Invoice was created in accounting software but failed to save reference locally. Please contact support.",
          external_id: invoiceResult.external_id,
        });
        return;
      }

      res.json({
        success: true,
        external_id: invoiceResult.external_id,
        invoice_number: invoiceResult.invoice_number,
        provider: integration.provider,
        provider_name: provider.displayName,
        status: invoiceResult.status,
        url: invoiceResult.url,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

export default router;
