import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  getProvider,
  getProviderForTenant,
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

router.post(
  "/admin/accounting-integrations/:provider/credentials",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      if (!isEncryptionConfigured()) {
        res.status(500).json({ error: "Encryption is not configured. Please contact your system administrator." });
        return;
      }

      const providerKey = req.params.provider;
      const provider = getProvider(providerKey);
      if (!provider) {
        res.status(400).json({ error: `Unknown provider: ${providerKey}` });
        return;
      }

      const { client_id, client_secret, dc } = req.body as { client_id?: string; client_secret?: string; dc?: string };
      if (!client_id || !client_secret) {
        res.status(400).json({ error: "Both client_id and client_secret are required" });
        return;
      }

      const validDCs = ["uk", "eu", "com", "in", "au", "jp"];
      const selectedDC = dc && validDCs.includes(dc) ? dc : "uk";

      const encryptedConfig = {
        client_id: encryptToken(client_id.trim()),
        client_secret: encryptToken(client_secret.trim()),
        dc: selectedDC,
      };

      const { data: existing } = await supabaseAdmin
        .from("accounting_integrations")
        .select("id, access_token")
        .eq("tenant_id", req.tenantId!)
        .eq("provider", providerKey)
        .maybeSingle();

      const alreadyConnected = !!(existing?.access_token);

      const { error: upsertError } = await supabaseAdmin
        .from("accounting_integrations")
        .upsert(
          {
            tenant_id: req.tenantId!,
            provider: providerKey,
            extra_config: encryptedConfig,
            is_active: alreadyConnected,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,provider" }
        );

      if (upsertError) {
        res.status(500).json({ error: upsertError.message });
        return;
      }

      res.json({ success: true });
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
      const provider = await getProviderForTenant(providerKey, req.tenantId!);
      if (!provider) {
        res.status(400).json({ error: `Unknown provider: ${providerKey}` });
        return;
      }

      if (!provider.hasCredentials()) {
        res.status(400).json({ error: "Please save your API credentials first before connecting." });
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

      const provider = await getProviderForTenant(providerKey, tenantId);
      if (!provider) {
        res.status(400).send(`Unknown provider: ${providerKey}`);
        return;
      }

      const host = req.get("host") || "localhost";
      const redirectUri = `https://${host}/api/admin/accounting-integrations/${providerKey}/callback`;

      console.log(`[accounting] OAuth callback for ${providerKey}, tenant ${tenantId}`);
      const tokens = await provider.exchangeCode(code, redirectUri);
      console.log(`[accounting] Token exchange successful, org: ${tokens.organisation_id || "none"}`);

      await supabaseAdmin
        .from("accounting_integrations")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .neq("provider", providerKey);

      const { data: existingRow } = await supabaseAdmin
        .from("accounting_integrations")
        .select("extra_config")
        .eq("tenant_id", tenantId)
        .eq("provider", providerKey)
        .maybeSingle();

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
            extra_config: existingRow?.extra_config || {},
            connected_at: new Date().toISOString(),
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,provider" }
        );

      if (upsertError) {
        console.error(`[accounting] Failed to save integration:`, upsertError);
        res.status(500).send(`Failed to save integration: ${upsertError.message}`);
        return;
      }
      console.log(`[accounting] Integration saved successfully for tenant ${tenantId}`);

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

router.get(
  "/admin/accounting-integrations/invoice-log",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const tenantId = req.tenantId!;
      const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("id, scheduled_date, status, external_invoice_id, external_invoice_provider, external_invoice_sent_at, customer_id")
        .eq("tenant_id", tenantId)
        .not("external_invoice_id", "is", null)
        .order("external_invoice_sent_at", { ascending: false, nullsFirst: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const customerIds = [...new Set((data || []).map((j) => j.customer_id).filter(Boolean))];
      let customerMap: Record<string, string> = {};
      if (customerIds.length > 0) {
        const { data: customers } = await supabaseAdmin
          .from("customers")
          .select("id, first_name, last_name")
          .in("id", customerIds);
        if (customers) {
          for (const c of customers) {
            const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
            customerMap[c.id] = name || "Unknown";
          }
        }
      }

      const providerNames: Record<string, string> = {
        zoho_invoice: "Zoho Invoice",
        xero: "Xero",
        quickbooks: "QuickBooks",
        sage: "Sage",
        freeagent: "FreeAgent",
      };

      const entries = (data || []).map((j) => ({
        job_id: j.id,
        job_date: j.scheduled_date,
        job_status: j.status,
        customer_name: customerMap[j.customer_id] || "Unknown",
        external_invoice_id: j.external_invoice_id,
        provider: j.external_invoice_provider,
        provider_name: providerNames[j.external_invoice_provider || ""] || j.external_invoice_provider || "Unknown",
        sent_at: j.external_invoice_sent_at,
      }));

      res.json({ entries, total: entries.length });
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

      const isResend = !!job.external_invoice_id;

      const integration = await getActiveIntegration(tenantId);
      if (!integration) {
        const { data: pendingRow } = await supabaseAdmin
          .from("accounting_integrations")
          .select("id, extra_config, access_token")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        const hasCredsBut = pendingRow && pendingRow.extra_config && !pendingRow.access_token;
        res.status(400).json({
          error: hasCredsBut
            ? "Your API credentials are saved but the OAuth connection is not complete. Go to Company Settings → Accounting Integrations and click Connect."
            : "No accounting integration connected. Go to Company Settings to set one up.",
        });
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
          first_name: invoiceData.customer_first_name || undefined,
          last_name: invoiceData.customer_last_name || undefined,
          email: invoiceData.customer_email || undefined,
          phone: invoiceData.customer_phone || undefined,
          mobile: invoiceData.customer_mobile || undefined,
          address_line1: invoiceData.customer_address_line1 || undefined,
          address_line2: invoiceData.customer_address_line2 || undefined,
          city: invoiceData.customer_city || undefined,
          county: invoiceData.customer_county || undefined,
          postcode: invoiceData.customer_postcode || undefined,
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

      const sentAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("jobs")
        .update({
          external_invoice_id: invoiceResult.external_id,
          external_invoice_provider: integration.provider,
          external_invoice_sent_at: sentAt,
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
        sent_at: sentAt,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

export default router;
