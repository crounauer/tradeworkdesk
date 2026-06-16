import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, ExternalLink, Loader2, AlertTriangle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ConnectStatus {
  connected: boolean;
  charges_enabled?: boolean;
  account_id?: string;
}

export default function AdminStripeConnect() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Handle redirect back from Stripe OAuth
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("success") === "1") {
      toast({ title: "Stripe connected", description: "Your Stripe account is now linked. Customers can pay invoices online." });
      // Clean URL
      window.history.replaceState({}, "", "/admin/stripe-connect");
    } else if (params.get("error")) {
      const errMsg = params.get("error") || "Unknown error";
      toast({ title: "Connection failed", description: `Stripe returned: ${errMsg}`, variant: "destructive" });
      window.history.replaceState({}, "", "/admin/stripe-connect");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stripe-connect/status", { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/stripe-connect/authorize", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to start connect flow");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Stripe? Existing checkout links on unpaid invoices will stop working.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/stripe-connect", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast({ title: "Stripe disconnected" });
      setStatus({ connected: false });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <button
        onClick={() => navigate("/admin/company-settings")}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Company Settings
      </button>

      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Zap className="w-6 h-6 text-violet-600" /> Stripe Payments
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your Stripe account so customers can pay invoices online. Funds go directly to your bank — TradeWorkDesk never touches your money.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : status?.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {status.charges_enabled ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              Stripe Account Connected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account ID</span>
                <span className="font-mono text-xs">{status.account_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charges enabled</span>
                <span className={status.charges_enabled ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                  {status.charges_enabled ? "Yes" : "Pending Stripe verification"}
                </span>
              </div>
            </div>

            {!status.charges_enabled && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your Stripe account is connected but charges aren't enabled yet. Complete Stripe's onboarding in your Stripe dashboard to start accepting payments.
              </div>
            )}

            {status.charges_enabled && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Ready to accept payments. When you send an invoice, a personalised "Pay Now" link will be automatically added for the customer.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" /> Open Stripe Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-5 h-5 text-muted-foreground" />
              Not Connected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Stripe account to enable online invoice payments. You'll be redirected to Stripe to authorise the connection.
            </p>

            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <p className="font-medium">How it works:</p>
              <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                <li>You connect your existing Stripe account (or create one)</li>
                <li>When you send an invoice, a payment link is automatically generated</li>
                <li>The customer sees a "Pay Now" button in their portal</li>
                <li>Payments go straight to your Stripe account &amp; bank</li>
                <li>Invoice status updates to "Paid" automatically via webhook</li>
              </ul>
            </div>

            <Button onClick={handleConnect} disabled={connecting} className="gap-2">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {connecting ? "Redirecting to Stripe…" : "Connect Stripe Account"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            To automatically mark invoices as paid, add a webhook in your Stripe dashboard pointing to:
          </p>
          <code className="block bg-muted rounded px-3 py-2 text-xs font-mono text-foreground break-all">
            {window.location.origin}/api/webhooks/stripe-connect
          </code>
          <p>
            Enable the <code className="text-xs bg-muted px-1 rounded">checkout.session.completed</code> event. Set the webhook signing secret as the <code className="text-xs bg-muted px-1 rounded">STRIPE_CONNECT_WEBHOOK_SECRET</code> environment variable.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://dashboard.stripe.com/webhooks", "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> Open Stripe Webhooks
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
