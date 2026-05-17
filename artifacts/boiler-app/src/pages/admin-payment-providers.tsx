import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Zap,
  CreditCard,
  Banknote,
  Link as LinkIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/use-company-settings";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GcStatus { available: boolean; connected: boolean; organisation_id?: string }
// ─── Helpers ─────────────────────────────────────────────────────────────────

function ConnectedBadge() {
  return (
    <Badge className="bg-green-100 text-green-700 border-0 flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" /> Connected
    </Badge>
  );
}
function NotConnectedBadge() {
  return (
    <Badge variant="outline" className="text-slate-500 flex items-center gap-1">
      <XCircle className="w-3 h-3" /> Not connected
    </Badge>
  );
}

// ─── GoCardless section ───────────────────────────────────────────────────────

function GoCardlessSection({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<GcStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gocardless/status", { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadStatus(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/gocardless/authorize", { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect GoCardless? Future invoices won't include a direct debit link.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/gocardless", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast({ title: "GoCardless disconnected" });
      setStatus({ available: true, connected: false });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) return <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />;
  if (!status?.available) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        GoCardless is not enabled on this platform. Contact your system administrator.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {status.connected ? <ConnectedBadge /> : <NotConnectedBadge />}
        {status.connected && status.organisation_id && (
          <span className="text-xs text-muted-foreground font-mono">Org: {status.organisation_id}</span>
        )}
      </div>
      {status.connected ? (
        <>          <p className="text-sm text-muted-foreground">
            When you send an invoice, a GoCardless payment link is automatically attached so customers can pay by direct debit or instant bank transfer.
          </p>
          <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-lg border">
            <div>
              <p className="text-sm font-medium">Accept bank payments on invoices</p>
              <p className="text-xs text-muted-foreground">When off, no GoCardless link is added and the button is hidden from customers.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => onToggle(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                enabled ? "bg-teal-600" : "bg-slate-200"
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Disconnect GoCardless
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Connect your GoCardless account to let customers pay by direct debit or instant bank transfer. No card fees — ideal for regular customers.
          </p>
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Connect GoCardless
          </Button>
        </>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">Webhook setup</summary>
        <p className="mt-1 pl-3 border-l-2 border-slate-200">
          In your GoCardless dashboard → Developers → Webhooks, add an endpoint:
          <br />
          <code className="bg-slate-100 px-1 rounded">{window.location.origin}/api/webhooks/gocardless</code>
          <br />
          Copy the signing secret to <code className="bg-slate-100 px-1 rounded">GOCARDLESS_WEBHOOK_SECRET</code>.
        </p>
      </details>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPaymentProviders() {
  const searchString = useSearch();
  const { toast } = useToast();
  const { data: settings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const stripeEnabled = settings?.stripe_payments_enabled !== false;
  const gcEnabled = settings?.gocardless_payments_enabled !== false;

  function handleStripeToggle(val: boolean) {
    updateSettings.mutate(
      { stripe_payments_enabled: val },
      { onSuccess: () => toast({ title: val ? "Card payments enabled" : "Card payments disabled" }),
        onError: (e) => toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" }) },
    );
  }

  function handleGcToggle(val: boolean) {
    updateSettings.mutate(
      { gocardless_payments_enabled: val },
      { onSuccess: () => toast({ title: val ? "Bank payments enabled" : "Bank payments disabled" }),
        onError: (e) => toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" }) },
    );
  }

  // Handle OAuth callbacks and success/error params
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("gc_success") === "1") {
      toast({ title: "GoCardless connected", description: "Direct debit payment links will be created automatically on future invoices." });
      window.history.replaceState({}, "", "/admin/payment-providers");
    } else if (params.get("error")) {
      const err = params.get("error") || "Unknown error";
      toast({ title: "Connection failed", description: err, variant: "destructive" });
      window.history.replaceState({}, "", "/admin/payment-providers");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <a
        href="/admin/company-settings"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Company Settings
      </a>

      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-violet-600" /> Payment Providers
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect payment providers so customers can pay invoices online. Funds go directly to your account — TradeWorkDesk never touches your money. Multiple providers can be active at once.
        </p>
      </div>

      {/* Stripe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-violet-600" /> Stripe
          </CardTitle>
          <CardDescription>
            Industry-leading card payments. Customers pay by card via a hosted Stripe Checkout page. Configured separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <a href="/admin/stripe-connect">
            <Button type="button" variant="outline" size="sm" className="flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5" /> Manage Stripe Connection
            </Button>
          </a>
          <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-lg border">
            <div>
              <p className="text-sm font-medium">Accept card payments on invoices</p>
              <p className="text-xs text-muted-foreground">When off, no Stripe link is added and the Pay by Card button is hidden from customers.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={stripeEnabled}
              disabled={updateSettings.isPending}
              onClick={() => handleStripeToggle(!stripeEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                stripeEnabled ? "bg-violet-600" : "bg-slate-200"
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${stripeEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* GoCardless */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="w-4 h-4 text-teal-600" /> GoCardless
          </CardTitle>
          <CardDescription>
            Direct debit &amp; instant bank pay. Popular with UK tradespeople — ideal for regular customers and larger invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoCardlessSection enabled={gcEnabled} onToggle={handleGcToggle} />
        </CardContent>
      </Card>

    </div>
  );
}
