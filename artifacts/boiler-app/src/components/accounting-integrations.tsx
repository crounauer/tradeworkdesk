import { useState, useEffect, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Link2, Unlink, ExternalLink, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface ProviderInfo {
  key: string;
  displayName: string;
  description: string;
  status: "available" | "coming_soon";
  connected: boolean;
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

export function AccountingIntegrations() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [encryptionConfigured, setEncryptionConfigured] = useState(true);
  const { toast } = useToast();

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
          <div
            key={p.key}
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
              p.connected
                ? "border-green-200 bg-green-50/50"
                : p.status === "coming_soon"
                  ? "border-border/50 bg-muted/30 opacity-60"
                  : "border-border hover:border-primary/30 hover:bg-slate-50"
            }`}
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
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
