import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Check, ExternalLink, AlertTriangle, Loader2,
  Calendar, Users, Package, Zap, ShoppingCart, HardDrive,
} from "lucide-react";
import { useInitData } from "@/hooks/use-init-data";

interface TenantInfo {
  id: string;
  company_name: string;
  status: string;
  trial_ends_at: string | null;
  plan_id: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_renewal_at?: string | null;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface BillingAddon {
  id: string;
  name: string;
  description: string | null;
  feature_keys: string[];
  monthly_price: number;
  annual_price: number;
  is_per_seat: boolean;
  subscribed: boolean;
  quantity: number;
}

interface BillingCreditsRow {
  id: string;
  name: string;
  description: string | null;
  feature_keys: string[];
  usage_unit_label: string | null;
  usage_bundle_size: number | null;
  usage_bundle_price: number | null;
  credits_remaining: number;
  total_purchased: number;
  last_topped_up: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
};

const BASE_PRICE = 25;
const PER_SEAT_PRICE = 10;
const INCLUDED_SEATS = 2;

function statusColor(status: string) {
  if (status === "active") return "bg-green-100 text-green-700 border-green-200";
  if (status === "trial") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "payment_overdue") return "bg-orange-100 text-orange-700 border-orange-200";
  if (status === "suspended") return "bg-red-100 text-red-700 border-red-200";
  if (status === "cancelled") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status: string) {
  return status.replace("_", " ");
}

export default function Billing() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const { data: initData } = useInitData();
  const usageLimits = initData?.usageLimits;
  const currentUsers = usageLimits?.currentUsers ?? 1;

  // Per-addon bundle purchase quantity state
  const [bundleCounts, setBundleCounts] = useState<Record<string, number>>({});

  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantInfo | null>({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const res = await fetch("/api/me/tenant");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: paymentMethod } = useQuery<PaymentMethod | null>({
    queryKey: ["payment-method"],
    queryFn: async () => {
      const res = await fetch("/api/billing/payment-method");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: tenantInfo?.status === "active" || tenantInfo?.status === "payment_overdue",
  });

  const { data: addons } = useQuery<BillingAddon[]>({
    queryKey: ["billing-addons"],
    queryFn: async () => {
      const res = await fetch("/api/billing/addons");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const { data: storageStats } = useQuery<{ used_bytes: number; file_count: number } | null>({
    queryKey: ["billing-storage-usage"],
    queryFn: async () => {
      const res = await fetch("/api/homepage");
      if (!res.ok) return null;
      const d = await res.json();
      return d.storage ?? null;
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const { data: creditsData } = useQuery<BillingCreditsRow[]>({
    queryKey: ["billing-credits"],
    queryFn: async () => {
      const res = await fetch("/api/billing/credits");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const buyCredits = useMutation({
    mutationFn: async ({ addonId, bundles }: { addonId: string; bundles: number }) => {
      const res = await fetch(`/api/billing/credits/${addonId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundles }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Purchase failed"); }
      return res.json();
    },
    onSuccess: (data: { credits_remaining: number; bundles_purchased: number; total_charged: number }) => {
      queryClient.invalidateQueries({ queryKey: ["billing-credits"] });
      toast({ title: `Credits purchased — ${data.credits_remaining.toLocaleString()} remaining` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const subscribeMutation = useMutation({
    mutationFn: async (addonId: string) => {
      const res = await fetch(`/api/billing/addons/${addonId}/subscribe`, { method: "POST" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Subscribe failed (${res.status})`); }
      return res.json();
    },
    onMutate: async (addonId: string) => {
      await queryClient.cancelQueries({ queryKey: ["billing-addons"] });
      const previous = queryClient.getQueryData<BillingAddon[]>(["billing-addons"]);
      queryClient.setQueryData<BillingAddon[]>(["billing-addons"], (old) =>
        old ? old.map(a => a.id === addonId ? { ...a, subscribed: true } : a) : old
      );
      return { previous };
    },
    onSuccess: (_data, addonId) => {
      // Confirm optimistic state — don't immediately refetch (races with DB commit)
      queryClient.setQueryData<BillingAddon[]>(["billing-addons"], (old) =>
        old ? old.map(a => a.id === addonId ? { ...a, subscribed: true } : a) : old
      );
      queryClient.invalidateQueries({ queryKey: ["billing-credits"] });
      queryClient.invalidateQueries({ queryKey: ["me-init"] });
      toast({ title: "Add-on activated" });
    },
    onError: (e: Error, _addonId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["billing-addons"], ctx.previous);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (addonId: string) => {
      const res = await fetch(`/api/billing/addons/${addonId}/subscribe`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Unsubscribe failed (${res.status})`); }
      return res.json();
    },
    onMutate: async (addonId: string) => {
      await queryClient.cancelQueries({ queryKey: ["billing-addons"] });
      const previous = queryClient.getQueryData<BillingAddon[]>(["billing-addons"]);
      queryClient.setQueryData<BillingAddon[]>(["billing-addons"], (old) =>
        old ? old.map(a => a.id === addonId ? { ...a, subscribed: false } : a) : old
      );
      return { previous };
    },
    onSuccess: (_data, addonId) => {
      // Confirm optimistic state — don't immediately refetch (races with DB commit)
      queryClient.setQueryData<BillingAddon[]>(["billing-addons"], (old) =>
        old ? old.map(a => a.id === addonId ? { ...a, subscribed: false } : a) : old
      );
      queryClient.invalidateQueries({ queryKey: ["billing-credits"] });
      queryClient.invalidateQueries({ queryKey: ["me-init"] });
      toast({ title: "Add-on deactivated" });
    },
    onError: (e: Error, _addonId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["billing-addons"], ctx.previous);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const manageBillingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/portal");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to open billing portal");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create checkout session");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const urlParams = new URLSearchParams(window.location.search);
  const justSucceeded = urlParams.get("success") === "1";
  const wasCancelled = urlParams.get("cancelled") === "1";

  // Calculate cost breakdown
  const extraUsers = Math.max(0, currentUsers - INCLUDED_SEATS);
  const subscribedAddons = (addons ?? []).filter(a => a.subscribed);
  const addonMonthlyTotal = subscribedAddons.reduce((sum, a) => sum + Number(a.monthly_price), 0);
  const monthlyTotal = BASE_PRICE + extraUsers * PER_SEAT_PRICE + addonMonthlyTotal;

  // Trial countdown
  const trialDaysLeft = (() => {
    if (!tenantInfo?.trial_ends_at) return null;
    const diff = new Date(tenantInfo.trial_ends_at).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  })();

  if (tenantLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-32 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Billing &amp; Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and payment details</p>
      </div>

      {justSucceeded && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          <span>Subscription activated successfully. Welcome to TradeWorkDesk!</span>
        </div>
      )}

      {wasCancelled && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Checkout was cancelled. Your plan hasn't changed.</span>
        </div>
      )}

      {tenantInfo?.status === "payment_overdue" && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Payment overdue</p>
            <p>Your last payment failed. Please update your payment method to avoid service interruption.</p>
            {isAdmin && (
              <Button size="sm" className="mt-2" onClick={() => manageBillingMutation.mutate()} disabled={manageBillingMutation.isPending}>
                {manageBillingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Update payment method"}
              </Button>
            )}
          </div>
        </div>
      )}

      {tenantInfo?.status === "suspended" && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Account suspended</p>
            <p>Your account has been suspended. Please contact support to resolve this.</p>
          </div>
        </div>
      )}

      {/* Current status card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Subscription Status</CardTitle>
          {tenantInfo && (
            <Badge className={`capitalize text-xs border ${statusColor(tenantInfo.status)}`}>
              {statusLabel(tenantInfo.status)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-slate-900">TradeWorkDesk</p>
              <p className="text-sm text-slate-500">All features included</p>
            </div>
            {tenantInfo?.status === "trial" && trialDaysLeft !== null && (
              <div className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in trial`
                    : "Trial ended"}
                </span>
              </div>
            )}
            {tenantInfo?.subscription_renewal_at && tenantInfo?.status === "active" && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Renews {new Date(tenantInfo.subscription_renewal_at).toLocaleDateString("en-GB")}</span>
              </div>
            )}
          </div>

          {/* Cost breakdown */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
            <h3 className="font-medium text-slate-900 mb-3">Monthly cost breakdown</h3>
            <div className="flex justify-between">
              <span className="text-slate-600">Base plan (includes {INCLUDED_SEATS} users)</span>
              <span className="font-medium">£{BASE_PRICE}/mo</span>
            </div>
            {extraUsers > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {extraUsers} extra user{extraUsers === 1 ? "" : "s"} × £{PER_SEAT_PRICE}
                </span>
                <span className="font-medium">£{extraUsers * PER_SEAT_PRICE}/mo</span>
              </div>
            )}
            {subscribedAddons.map(a => (
              <div key={a.id} className="flex justify-between">
                <span className="text-slate-600">{a.name}{a.is_per_seat ? " (per-user)" : ""}</span>
                <span className="font-medium">£{Number(a.monthly_price).toFixed(2)}/mo</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>£{monthlyTotal}/month</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
              <Users className="w-3 h-3" />
              <span>{currentUsers} active user{currentUsers === 1 ? "" : "s"} · {INCLUDED_SEATS} included in base plan{currentUsers > INCLUDED_SEATS ? `, £${PER_SEAT_PRICE}/mo each above ${INCLUDED_SEATS}` : `, extra users £${PER_SEAT_PRICE}/mo each`}</span>
            </div>
          </div>

          {/* CTA for trial/unsubscribed users */}
          {isAdmin && tenantInfo?.status === "trial" && (
            <Button
              className="w-full"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                : <>Subscribe — £{monthlyTotal}/month</>}
            </Button>
          )}

          {/* Manage billing for active subscribers */}
          {isAdmin && tenantInfo?.status === "active" && tenantInfo.stripe_subscription_id && (
            <Button
              variant="outline"
              onClick={() => manageBillingMutation.mutate()}
              disabled={manageBillingMutation.isPending}
              className="gap-2"
            >
              {manageBillingMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ExternalLink className="w-4 h-4" />}
              Manage billing &amp; invoices
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Payment method */}
      {(tenantInfo?.status === "active" || tenantInfo?.status === "payment_overdue") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethod ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 uppercase">
                    {BRAND_LABEL[paymentMethod.brand] ?? paymentMethod.brand}
                  </div>
                  <span className="text-sm text-slate-700">•••• {paymentMethod.last4}</span>
                  <span className="text-xs text-slate-500">
                    expires {paymentMethod.exp_month.toString().padStart(2, "0")}/{paymentMethod.exp_year}
                  </span>
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => manageBillingMutation.mutate()}
                    disabled={manageBillingMutation.isPending}
                  >
                    Update
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No payment method on file.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add-on packages */}
      {isAdmin && addons && addons.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Add-on Packages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Activate add-ons for your account. Changes take effect immediately.
            </p>
            <div className="divide-y divide-border">
              {/* Per-seat addon: informational only — billed automatically via Stripe */}
              {addons.some(a => a.is_per_seat) && (
                <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <p className="font-medium text-sm">Additional Users</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Add extra engineer or office staff seats to your account. The base plan includes 2 users.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      £{PER_SEAT_PRICE}.00/month per user above {INCLUDED_SEATS} · billed automatically
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-700">{currentUsers} / {INCLUDED_SEATS}+ users</p>
                    <p className="text-xs text-muted-foreground">
                      {currentUsers <= INCLUDED_SEATS ? "No extra charge" : `${currentUsers - INCLUDED_SEATS} extra · £${(currentUsers - INCLUDED_SEATS) * PER_SEAT_PRICE}/mo`}
                    </p>
                  </div>
                </div>
              )}
              {/* Toggleable addons: exclude per-seat ones */}
              {addons.filter(a => !a.is_per_seat).map(addon => {
                const isBusy = subscribeMutation.isPending || unsubscribeMutation.isPending;
                return (
                  <div key={addon.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{addon.name}</p>
                        {addon.subscribed && (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs border">Active</Badge>
                        )}
                      </div>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{addon.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {Number(addon.monthly_price) === 0
                          ? "Credits purchased in bundles · see Usage Credits below"
                          : `£${Number(addon.monthly_price).toFixed(2)}/month${addon.annual_price > 0 ? ` · £${Number(addon.annual_price).toFixed(2)}/year` : ""}`
                        }
                      </p>
                      {addon.feature_keys.includes("photo_storage") && storageStats && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <HardDrive className="w-3 h-3 inline shrink-0" />
                          {formatBytes(storageStats.used_bytes)} used · {storageStats.file_count} file{storageStats.file_count !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={addon.subscribed}
                      disabled={!isAdmin || isBusy}
                      onCheckedChange={(checked) => {
                        if (checked) subscribeMutation.mutate(addon.id);
                        else unsubscribeMutation.mutate(addon.id);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Usage credits */}
      {isAdmin && creditsData && creditsData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Usage Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Some add-ons are billed by usage. Purchase credit bundles as you need them.
            </p>
            <div className="divide-y divide-border">
              {creditsData.map(credit => {
                const bundles = bundleCounts[credit.id] ?? 1;
                const bundleSize = credit.usage_bundle_size ?? 1000;
                const bundlePrice = credit.usage_bundle_price ?? 10;
                const unitLabel = credit.usage_unit_label || "units";
                const isLow = credit.credits_remaining < bundleSize * 0.1;
                return (
                  <div key={credit.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-sm">{credit.name}</p>
                        {credit.description && <p className="text-xs text-muted-foreground mt-0.5">{credit.description}</p>}
                        <p className="text-xs text-slate-500 mt-1">£{bundlePrice.toFixed(2)} per {bundleSize.toLocaleString()} {unitLabel}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${isLow ? "text-orange-600" : "text-slate-800"}`}>
                          {credit.credits_remaining.toLocaleString()}
                        </span>
                        <p className="text-xs text-muted-foreground">{unitLabel} remaining</p>
                        {isLow && credit.credits_remaining > 0 && (
                          <p className="text-xs text-orange-600 font-medium mt-0.5">Running low</p>
                        )}
                        {credit.credits_remaining === 0 && (
                          <p className="text-xs text-red-600 font-medium mt-0.5">No credits left</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Bundles to buy:</label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        className="w-20 h-7 text-sm"
                        value={bundles}
                        onChange={(e) => setBundleCounts(prev => ({ ...prev, [credit.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                      />
                      <span className="text-xs text-muted-foreground">
                        = {(bundles * bundleSize).toLocaleString()} {unitLabel} for £{(bundles * bundlePrice).toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto gap-1.5"
                        disabled={buyCredits.isPending}
                        onClick={() => buyCredits.mutate({ addonId: credit.id, bundles })}
                      >
                        {buyCredits.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                        Buy credits
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
