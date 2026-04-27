import { useState, useEffect, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link2, Unlink, ExternalLink, CheckCircle2, Clock, AlertTriangle, Save, Eye, EyeOff, KeyRound, Info, Copy, Check as CheckIcon } from "lucide-react";

interface ProviderInfo {
  key: string;
  displayName: string;
  description: string;
  status: "available" | "coming_soon";
  connected: boolean;
  has_credentials: boolean;
  organisation_id?: string | null;
  connected_at?: string | null;
}

const PROVIDER_LOGOS: Record<string, string> = {
  zoho_invoice: "Z",
  xero: "X",
  quickbooks: "Q",
  sage: "S",
  freeagent: "F",
};

const PROVIDER_COLORS: Record<string, string> = {
  zoho_invoice: "bg-red-100 text-red-700",
  xero: "bg-blue-100 text-blue-700",
  quickbooks: "bg-green-100 text-green-700",
  sage: "bg-emerald-100 text-emerald-700",
  freeagent: "bg-purple-100 text-purple-700",
};

const ZOHO_DC_CONSOLE_URLS: Record<string, string> = {
  uk: "https://api-console.zoho.uk/",
  eu: "https://api-console.zoho.eu/",
  com: "https://api-console.zoho.com/",
  in: "https://api-console.zoho.in/",
  au: "https://api-console.zoho.com.au/",
  jp: "https://api-console.zoho.jp/",
};

const PROVIDER_HELP: Record<string, { url: string; label: string }> = {
  zoho_invoice: {
    url: "https://api-console.zoho.uk/",
    label: "Get your credentials from the Zoho API Console",
  },
};

export function AccountingIntegrations() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [encryptionConfigured, setEncryptionConfigured] = useState(true);
  const [credentialForms, setCredentialForms] = useState<Record<string, { clientId: string; clientSecret: string; showSecret: boolean; dc: string }>>(() => {
    try {
      const saved = sessionStorage.getItem("acct-cred-forms");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, { clientId: string; clientSecret: string; dc?: string }>;
        const result: Record<string, { clientId: string; clientSecret: string; showSecret: boolean; dc: string }> = {};
        for (const [k, v] of Object.entries(parsed)) {
          result[k] = { ...v, showSecret: false, dc: v.dc || "uk" };
        }
        return result;
      }
    } catch { /* ignore */ }
    return {};
  });
  const [savingCredentials, setSavingCredentials] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const toStore: Record<string, { clientId: string; clientSecret: string; dc: string }> = {};
    for (const [k, v] of Object.entries(credentialForms)) {
      toStore[k] = { clientId: v.clientId, clientSecret: v.clientSecret, dc: v.dc };
    }
    if (Object.keys(toStore).length > 0) {
      sessionStorage.setItem("acct-cred-forms", JSON.stringify(toStore));
    } else {
      sessionStorage.removeItem("acct-cred-forms");
    }
  }, [credentialForms]);

  const fetchProviders = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/accounting-integrations`) as { providers: ProviderInfo[]; encryption_configured: boolean };
      setProviders(data.providers);
      setEncryptionConfigured(data.encryption_configured);
    } catch {
      toast({ title: "Error", description: "Failed to load accounting integrations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "accounting-integration-connected") {
        toast({ title: "Connected", description: `${event.data.provider} connected successfully` });
        fetchProviders();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [toast, fetchProviders]);

  const toggleCredentialForm = (providerKey: string) => {
    setCredentialForms((prev) => {
      if (prev[providerKey]) {
        const next = { ...prev };
        delete next[providerKey];
        return next;
      }
      return { ...prev, [providerKey]: { clientId: "", clientSecret: "", showSecret: false, dc: "uk" } };
    });
  };

  const updateCredentialForm = (providerKey: string, field: "clientId" | "clientSecret" | "showSecret" | "dc", value: string | boolean) => {
    setCredentialForms((prev) => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], [field]: value },
    }));
  };

  const handleSaveCredentials = async (providerKey: string) => {
    const form = credentialForms[providerKey];
    if (!form?.clientId || !form?.clientSecret) {
      toast({ title: "Missing fields", description: "Both Client ID and Client Secret are required", variant: "destructive" });
      return;
    }

    setSavingCredentials(providerKey);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/accounting-integrations/${providerKey}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: form.clientId, client_secret: form.clientSecret, dc: form.dc }),
      });
      toast({ title: "Saved", description: "API credentials saved securely" });
      setCredentialForms((prev) => {
        const next = { ...prev };
        delete next[providerKey];
        return next;
      });
      fetchProviders();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingCredentials(null);
    }
  };

  const handleConnect = async (providerKey: string) => {
    setActionLoading(providerKey);
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/accounting-integrations/${providerKey}/auth-url`) as { auth_url: string };
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      window.open(
        data.auth_url,
        `connect-${providerKey}`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (providerKey: string, displayName: string) => {
    setActionLoading(providerKey);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/accounting-integrations/${providerKey}`, {
        method: "DELETE",
      });
      toast({ title: "Disconnected", description: `${displayName} has been disconnected` });
      fetchProviders();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Accounting Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Accounting Integrations
        </CardTitle>
        <CardDescription>
          Connect your accounting software to send invoices directly from completed jobs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!encryptionConfigured && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Encryption not configured</p>
              <p className="text-amber-700 mt-0.5">An encryption key must be set before connecting accounting integrations. Please contact your system administrator.</p>
            </div>
          </div>
        )}
        {providers.map((p) => (
          <div key={p.key} className="space-y-0">
            <div
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                p.connected
                  ? "border-green-200 bg-green-50/50"
                  : p.status === "coming_soon"
                    ? "border-border/50 bg-muted/30 opacity-60"
                    : "border-border hover:border-primary/30 hover:bg-slate-50"
              } ${credentialForms[p.key] ? "rounded-b-none" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${PROVIDER_COLORS[p.key] || "bg-gray-100 text-gray-600"}`}>
                  {PROVIDER_LOGOS[p.key] || p.displayName[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.displayName}</span>
                    {p.connected && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </span>
                    )}
                    {!p.connected && p.has_credentials && p.status === "available" && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                        <KeyRound className="w-3 h-3" /> Credentials saved
                      </span>
                    )}
                    {p.status === "coming_soon" && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  {p.connected && p.organisation_id && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Org: {p.organisation_id}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {p.connected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive gap-1.5"
                    disabled={actionLoading === p.key}
                    onClick={() => handleDisconnect(p.key, p.displayName)}
                  >
                    {actionLoading === p.key ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unlink className="w-3.5 h-3.5" />
                    )}
                    Disconnect
                  </Button>
                ) : p.status === "available" ? (
                  <>
                    {!p.has_credentials && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={!encryptionConfigured}
                        onClick={() => toggleCredentialForm(p.key)}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {credentialForms[p.key] ? "Cancel" : "Set Up"}
                      </Button>
                    )}
                    {p.has_credentials && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-muted-foreground"
                          disabled={!encryptionConfigured}
                          onClick={() => toggleCredentialForm(p.key)}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {credentialForms[p.key] ? "Cancel" : "Update Keys"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={actionLoading === p.key || !encryptionConfigured}
                          onClick={() => handleConnect(p.key)}
                        >
                          {actionLoading === p.key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          Connect
                        </Button>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {credentialForms[p.key] && (
              <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50 space-y-3">
                <div className="text-sm text-muted-foreground">
                  Enter your {p.displayName} API credentials. These are stored securely using encryption.
                </div>

                {p.key === "zoho_invoice" ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2.5">
                    <p className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" /> How to connect Zoho Invoice
                    </p>
                    <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>
                        Select your <strong>Data Centre Region</strong> below, then open the Zoho API Console:
                        <a
                          href={ZOHO_DC_CONSOLE_URLS[credentialForms[p.key]?.dc || "uk"] || ZOHO_DC_CONSOLE_URLS["uk"]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 ml-1 font-medium underline underline-offset-2"
                        >
                          <ExternalLink className="w-3 h-3" /> Open API Console
                        </a>
                      </li>
                      <li>Click <strong>Add Client</strong> and choose <strong>Server-based Applications</strong>. <em className="text-blue-700">(If you have an existing client, Zoho does not allow changing the redirect URI — you must create a new client.)</em></li>
                      <li>
                        Set the <strong>Homepage URL</strong> to <code className="bg-blue-100 rounded px-1 font-mono">{window.location.origin}</code> and the <strong>Authorized Redirect URI</strong> to:
                        <div className="flex items-center gap-1.5 mt-1">
                          <code className="flex-1 bg-blue-100 rounded px-2 py-1 font-mono text-xs break-all select-all">
                            {`${window.location.origin}/api/admin/accounting-integrations/zoho_invoice/callback`}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/api/admin/accounting-integrations/zoho_invoice/callback`);
                              setCopiedUri(true);
                              setTimeout(() => setCopiedUri(false), 2000);
                            }}
                            className="shrink-0 p-1.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedUri ? <CheckIcon className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </li>
                      <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from Zoho and paste them below.</li>
                      <li>Click <strong>Save Credentials</strong>, then click <strong>Connect</strong> to authorise via your Zoho account.</li>
                    </ol>
                    <div className="pt-2 border-t border-blue-200 space-y-1.5">
                      <p className="text-xs text-blue-800">
                        <strong>Parts &amp; Products:</strong> Parts added to a job are sent to Zoho using an item named{" "}
                        <code className="bg-blue-100 rounded px-1 font-mono">product</code>. Create an item with this exact name in{" "}
                        <em>Zoho Invoice → Items</em> so parts map to it correctly, with the part name as the description.
                      </p>
                      <p className="text-xs text-blue-800">
                        <strong>Payment Terms:</strong> The number of days before payment is due is taken from{" "}
                        <em>Company Settings → Pricing &amp; Invoicing → Payment Terms</em> and sent with every invoice.
                      </p>
                    </div>
                  </div>
                ) : PROVIDER_HELP[p.key] ? (
                  <a
                    href={PROVIDER_HELP[p.key].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {PROVIDER_HELP[p.key].label}
                  </a>
                ) : null}

                <div className="space-y-2">
                  <div>
                    <Label htmlFor={`${p.key}-client-id`} className="text-xs">Client ID</Label>
                    <Input
                      id={`${p.key}-client-id`}
                      placeholder="Enter your Client ID"
                      value={credentialForms[p.key].clientId}
                      onChange={(e) => updateCredentialForm(p.key, "clientId", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${p.key}-client-secret`} className="text-xs">Client Secret</Label>
                    <div className="relative mt-1">
                      <Input
                        id={`${p.key}-client-secret`}
                        type={credentialForms[p.key].showSecret ? "text" : "password"}
                        placeholder="Enter your Client Secret"
                        value={credentialForms[p.key].clientSecret}
                        onChange={(e) => updateCredentialForm(p.key, "clientSecret", e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => updateCredentialForm(p.key, "showSecret", !credentialForms[p.key].showSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {credentialForms[p.key].showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {p.key === "zoho_invoice" && (
                    <div>
                      <Label htmlFor={`${p.key}-dc`} className="text-xs">Data Centre Region</Label>
                      <select
                        id={`${p.key}-dc`}
                        value={credentialForms[p.key].dc}
                        onChange={(e) => updateCredentialForm(p.key, "dc", e.target.value)}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="uk">UK (zoho.uk)</option>
                        <option value="eu">EU (zoho.eu)</option>
                        <option value="com">US (zoho.com)</option>
                        <option value="in">India (zoho.in)</option>
                        <option value="au">Australia (zoho.com.au)</option>
                        <option value="jp">Japan (zoho.jp)</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select the region matching your Zoho account's data centre
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={savingCredentials === p.key || !credentialForms[p.key].clientId || !credentialForms[p.key].clientSecret}
                  onClick={() => handleSaveCredentials(p.key)}
                >
                  {savingCredentials === p.key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Credentials
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
