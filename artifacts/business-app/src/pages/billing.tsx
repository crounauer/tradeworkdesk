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
  Calendar, Users, Package, Zap, ShoppingCart, HardDrive, Briefcase, Globe,
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
  small_bundle_size: number | null;
  small_bundle_price: number | null;
  credits_remaining: number;
  total_purchased: number;
  last_topped_up: string | null;
}

interface AvailablePlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  is_popular: boolean;
  sort_order: number;
}

// Bullet points shown under each plan — based on plan name
const PLAN_BULLETS: Record<string, string[]> = {
  "Job Management": [
    "Full job scheduling & calendar",
    "Customer & property records",
    "Invoicing & quotes",
    "Online booking & enquiries",
    "Up to 2 users (£10/mo each above 2)",
  ],
  "Website Builder": [
    "Professional trade website",
    "Custom domain support",
    "Blog & service pages",
    "Contact form with job enquiries",
    "1 user included",
  ],
  "Bundle": [
    "Everything in Job Management",
    "Everything in Website Builder",
    "Best value — save vs. buying separately",
    "Up to 2 users (£10/mo each above 2)",
  ],
};

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
  const [buyingAddonId, setBuyingAddonId] = useState<string | null>(null);

  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantInfo | null>({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const res = await fetch("/api/me/tenant");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // initData.tenant is already cached and available immediately; tenantInfo may
  // still be loading, so fall back to initData to avoid a flash where all plans
  // show "Switch to X" before the tenant-info fetch completes.
  const currentPlanId = initData?.tenant?.plan_id ?? tenantInfo?.plan_id ?? null;

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

  const { data: storageStats } = useQuery<{ used_bytes: number; file_count: number; limit_bytes: number } | null>({
    queryKey: ["billing-storage-usage"],
    queryFn: async () => {
      const res = await fetch("/api/billing/storage-usage");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 10_000,
  });

  const { data: availablePlans } = useQuery<AvailablePlan[]>({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const switchPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch("/api/billing/switch-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to switch plan"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-info"] });
      queryClient.invalidateQueries({ queryKey: ["me-init"] });
      toast({ title: "Plan updated successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
    mutationFn: async ({ addonId, bundles, bundleType }: { addonId: string; bundles: number; bundleType?: "small" | "standard" }) => {
      setBuyingAddonId(addonId);
      const res = await fetch(`/api/billing/credits/${addonId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundles, bundle_type: bundleType ?? "standard" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Purchase failed"); }
      return res.json();
    },
    onSuccess: (data: { credits_remaining: number; bundles_purchased: number; total_charged: number }) => {
      setBuyingAddonId(null);
      queryClient.invalidateQueries({ queryKey: ["billing-credits"] });
      toast({ title: `Credits purchased — ${data.credits_remaining.toLocaleString()} remaining` });
    },
    onError: (e: Error) => {
      setBuyingAddonId(null);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
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

  // Trial countdown
  const trialDaysLeft = (() => {
    if (!tenantInfo?.trial_ends_at) return null;
    const diff = new Date(tenantInfo.trial_ends_at).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  })();
  const trialEndsOn = tenantInfo?.trial_ends_at
    ? new Date(tenantInfo.trial_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const isTrialExpiredSuspended =
    tenantInfo?.status === "suspended" &&
    !!tenantInfo?.trial_ends_at &&
    new Date(tenantInfo.trial_ends_at).getTime() < Date.now();
  const isNoPaidPlanSuspended = tenantInfo?.status === "suspended" && !tenantInfo?.stripe_subscription_id;

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

      {tenantInfo?.status === "trial" && trialDaysLeft !== null && (
        <Card className={trialDaysLeft <= 7 ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                {trialDaysLeft <= 7 ? <AlertTriangle className="w-5 h-5 text-amber-700" /> : <Calendar className="w-5 h-5 text-blue-700" />}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {trialDaysLeft > 0
                      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial`
                      : "Your free trial has ended"}
                  </p>
                  <p className="text-xs text-slate-700">
                    {trialEndsOn ? `Trial end date: ${trialEndsOn}. ` : ""}
                    After trial, access is locked until you start paid billing.
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="sm:ml-auto">
                  <Button onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
                    {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Paid Plan"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(isTrialExpiredSuspended || isNoPaidPlanSuspended) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Your trial has ended and access is locked</p>
            <p>Start a paid plan to restore full site access.</p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
              {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Paid Plan"}
            </Button>
          )}
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
            <p className="font-semibold">{(isTrialExpiredSuspended || isNoPaidPlanSuspended) ? "Trial ended" : "Account suspended"}</p>
            <p>{(isTrialExpiredSuspended || isNoPaidPlanSuspended) ? "Start a paid plan to restore access." : "Your account has been suspended. Please contact support to resolve this."}</p>
            {isAdmin && (isTrialExpiredSuspended || isNoPaidPlanSuspended) && (
              <Button size="sm" className="mt-2" onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
                {checkoutMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Start Paid Plan"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Plan selector */}
      {availablePlans && availablePlans.length > 0 && isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose Your Plan</CardTitle>
            <p className="text-sm text-muted-foreground">Select the plan that works for your business. Changes take effect immediately.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availablePlans.map(plan => {
                const isCurrent = currentPlanId === plan.id;
                const isSwitching = switchPlanMutation.isPending;
                const bullets = PLAN_BULLETS[plan.name] ?? (plan.description ? [plan.description] : []);
                const PlanIcon = plan.name === "Website Builder" ? Globe : plan.name === "Bundle" ? Package : Briefcase;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-all ${
                      isCurrent
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isCurrent ? "bg-primary/10" : "bg-slate-100"}`}>
                          <PlanIcon className={`w-4 h-4 ${isCurrent ? "text-primary" : "text-slate-600"}`} />
                        </div>
                        <h3 className="font-semibold text-sm">{plan.name}</h3>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {plan.is_popular && (
                          <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">Popular</Badge>
                        )}
                        {isCurrent && (
                          <Badge className="bg-green-600 text-white text-xs px-2 py-0.5">Current</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-2xl font-bold">£{Number(plan.monthly_price).toFixed(0)}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                      {plan.annual_price > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">or £{Number(plan.annual_price).toFixed(0)}/year</p>
                      )}
                    </div>
                    {bullets.length > 0 && (
                      <ul className="space-y-1.5 flex-1">
                        {bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!isCurrent && isAdmin && (
                      <Button
                        size="sm"
                        variant={plan.is_popular ? "default" : "outline"}
                        className="w-full mt-auto"
                        disabled={isSwitching}
                        onClick={() => switchPlanMutation.mutate(plan.id)}
                      >
                        {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : `Switch to ${plan.name}`}
                      </Button>
                    )}
                    {isCurrent && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-auto pt-1">
                        <Check className="w-3.5 h-3.5" /> Active plan
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {tenantInfo?.status === "active" && tenantInfo.stripe_subscription_id && (
              <p className="text-xs text-muted-foreground mt-4">
                Plan changes are prorated and applied immediately. Your next invoice will reflect the new price.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Slim status / billing bar — replaces the old Subscription Status card */}
      {tenantInfo && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Badge className={`capitalize text-xs border ${statusColor(tenantInfo.status)}`}>
              {statusLabel(tenantInfo.status)}
            </Badge>
            {tenantInfo.status === "trial" && trialDaysLeft !== null && (
              <div className="flex items-center gap-1.5 text-sm text-amber-700">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in trial` : "Trial ended"}</span>
              </div>
            )}
            {tenantInfo.subscription_renewal_at && tenantInfo.status === "active" && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Renews {new Date(tenantInfo.subscription_renewal_at).toLocaleDateString("en-GB")}</span>
              </div>
            )}
            <div className="ml-auto flex gap-2">
              {isAdmin && tenantInfo.status === "trial" && (
                <Button size="sm" onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
                  {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Paid Plan"}
                </Button>
              )}
              {isAdmin && tenantInfo.status === "active" && tenantInfo.stripe_subscription_id && (
                <Button size="sm" variant="outline" onClick={() => manageBillingMutation.mutate()} disabled={manageBillingMutation.isPending} className="gap-1.5">
                  {manageBillingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Invoices &amp; billing
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                const isStorageAddon = addon.feature_keys.includes("extra_photo_storage");
                return (
                  <div key={addon.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{addon.name}</p>
                        {!isStorageAddon && addon.subscribed && (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs border">Active</Badge>
                        )}
                      </div>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{addon.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {isStorageAddon
                          ? "500 GB included free · buy extra GB in advance below at £4.99/GB/month"
                          : Number(addon.monthly_price) === 0
                            ? "Credits purchased in bundles · see Usage Credits below"
                            : `£${Number(addon.monthly_price).toFixed(2)}/month${addon.annual_price > 0 ? ` · £${Number(addon.annual_price).toFixed(2)}/year` : ""}`
                        }
                      </p>
                      {isStorageAddon && storageStats && (() => {
                        const pct = Math.min(100, (storageStats.used_bytes / storageStats.limit_bytes) * 100);
                        const barColor = pct >= 95 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500";
                        const textColor = pct >= 95 ? "text-red-600" : pct >= 75 ? "text-amber-600" : "text-slate-500";
                        return (
                          <div className="mt-2 space-y-1">
                            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className={`text-xs flex items-center gap-1 ${textColor}`}>
                              <HardDrive className="w-3 h-3 shrink-0" />
                              {formatBytes(storageStats.used_bytes)} of {formatBytes(storageStats.limit_bytes)} used
                              {pct >= 95 && " · Upload limit reached — buy more GB below"}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                    {!isStorageAddon && (
                      <Switch
                        checked={addon.subscribed}
                        disabled={!isAdmin || isBusy}
                        onCheckedChange={(checked) => {
                          if (checked) subscribeMutation.mutate(addon.id);
                          else unsubscribeMutation.mutate(addon.id);
                        }}
                      />
                    )}
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
              Billed in advance — purchase credit bundles before you use them.
            </p>
            <div className="divide-y divide-border">
              {creditsData.map(credit => {
                const isStorage = credit.feature_keys.includes("extra_photo_storage");
                const bundles = bundleCounts[credit.id] ?? 1;
                const bundleSize = credit.usage_bundle_size ?? 1000;
                const bundlePrice = credit.usage_bundle_price ?? 10;
                const hasSmallBundle = credit.small_bundle_size != null && credit.small_bundle_price != null;
                const smallBundleSize = credit.small_bundle_size ?? 0;
                const smallBundlePrice = credit.small_bundle_price ?? 0;
                const unitLabel = credit.usage_unit_label || "units";
                const isLow = !isStorage && credit.credits_remaining < bundleSize * 0.1;
                // For storage: compute effective limit in bytes for the bar
                const storageExtraBytes = isStorage ? credit.credits_remaining * 1024 * 1024 * 1024 : 0;
                const storageTotalBytes = isStorage ? 500 * 1024 * 1024 * 1024 + storageExtraBytes : 0;
                const storagePct = isStorage && storageTotalBytes > 0 && storageStats
                  ? Math.min(100, (storageStats.used_bytes / storageTotalBytes) * 100) : 0;
                const storageBarColor = storagePct >= 95 ? "bg-red-500" : storagePct >= 75 ? "bg-amber-400" : "bg-emerald-500";
                return (
                  <div key={credit.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{credit.name}</p>
                        {credit.description && <p className="text-xs text-muted-foreground mt-0.5">{credit.description}</p>}
                        <p className="text-xs text-slate-500 mt-1">
                          {hasSmallBundle
                            ? <>Starter: £{smallBundlePrice.toFixed(2)} = {smallBundleSize.toLocaleString()} {unitLabel} · Standard: £{bundlePrice.toFixed(2)} = {bundleSize.toLocaleString()} {unitLabel}</>
                            : <>£{bundlePrice.toFixed(2)} per {bundleSize.toLocaleString()} {unitLabel} · billed in advance</>}
                        </p>
                        {isStorage && storageStats && (
                          <div className="mt-2 space-y-1">
                            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${storageBarColor}`} style={{ width: `${storagePct}%` }} />
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <HardDrive className="w-3 h-3 shrink-0" />
                              {formatBytes(storageStats.used_bytes)} of {formatBytes(storageTotalBytes)} used
                              {credit.credits_remaining > 0 && ` · ${credit.credits_remaining} GB extra capacity`}
                            </p>
                          </div>
                        )}
                      </div>
                      {!isStorage && (
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
                      )}
                    </div>
                    {isStorage && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">GB to buy:</label>
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
                          disabled={buyingAddonId === credit.id}
                          onClick={() => buyCredits.mutate({ addonId: credit.id, bundles })}
                        >
                          {buyingAddonId === credit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                          Buy storage
                        </Button>
                      </div>
                    )}
                    {!isStorage && (
                      <div className="flex flex-wrap items-center gap-2">
                        {hasSmallBundle && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={buyingAddonId === credit.id}
                            onClick={() => buyCredits.mutate({ addonId: credit.id, bundles: 1, bundleType: "small" })}
                          >
                            {buyingAddonId === credit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                            Starter — {smallBundleSize.toLocaleString()} credits (£{smallBundlePrice.toFixed(2)})
                          </Button>
                        )}
                        <label className="text-xs text-muted-foreground whitespace-nowrap">
                          {hasSmallBundle ? "Or buy standard:" : "Bundles to buy:"}
                        </label>
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
                          className="gap-1.5"
                          disabled={buyingAddonId === credit.id}
                          onClick={() => buyCredits.mutate({ addonId: credit.id, bundles })}
                        >
                          {buyingAddonId === credit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                          Buy credits
                        </Button>
                      </div>
                    )}
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
