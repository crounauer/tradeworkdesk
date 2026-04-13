import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Check, ExternalLink, AlertTriangle, RefreshCw, Loader2,
  Calendar, Users, Briefcase, Package, Plus, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInitData } from "@/hooks/use-init-data";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  max_jobs_per_month: number;
  features: Record<string, boolean>;
  stripe_price_id: string | null;
  stripe_price_id_annual: string | null;
  sole_trader_price: number | null;
  sole_trader_price_annual: number | null;
  stripe_sole_trader_price_id: string | null;
  stripe_sole_trader_price_id_annual: string | null;
}

interface Addon {
  id: string;
  name: string;
  description: string | null;
  feature_keys: string[];
  monthly_price: number;
  annual_price: number;
  is_per_seat?: boolean;
}

interface TenantAddon {
  id: string;
  addon_id: string;
  is_active: boolean;
  quantity: number;
  activated_at: string;
  addons: (Addon & { is_per_seat?: boolean }) | null;
}

interface TenantInfo {
  id: string;
  company_name: string;
  status: string;
  trial_ends_at: string | null;
  plan_id: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_renewal_at?: string | null;
  company_type?: "sole_trader" | "company";
  plans?: { name: string; monthly_price: number; max_users: number; max_jobs_per_month: number } | null;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
};

export default function Billing() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isAdmin = profile?.role === "admin";
  const { data: initData } = useInitData();
  const usageLimits = initData?.usageLimits;

  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantInfo | null>({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const res = await fetch("/api/me/tenant");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans/public");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: availableAddons } = useQuery<Addon[]>({
    queryKey: ["public-addons"],
    queryFn: async () => {
      const res = await fetch("/api/platform/addons/public");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myAddons } = useQuery<TenantAddon[]>({
    queryKey: ["my-addons"],
    queryFn: async () => {
      const res = await fetch("/api/me/addons");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantInfo,
  });

  const { data: paymentMethod, isLoading: pmLoading } = useQuery<PaymentMethod | null>({
    queryKey: ["payment-method"],
    queryFn: async () => {
      const res = await fetch("/api/billing/payment-method");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: tenantInfo?.status === "active" || tenantInfo?.status === "payment_overdue",
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
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) throw new Error("No plan selected");
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: selectedPlan,
          billing_cycle: billingCycle,
          addon_ids: [...selectedAddonIds],
          addon_quantities: addonQuantities,
        }),
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
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateAddonsMutation = useMutation({
    mutationFn: async (addonIds: string[]) => {
      const res = await fetch("/api/billing/addons/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon_ids: addonIds, addon_quantities: addonQuantities }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update add-ons");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-addons"] });
      queryClient.invalidateQueries({ queryKey: ["me-init"] });
      toast({ title: "Add-ons updated successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (myAddons && myAddons.length > 0) {
      setSelectedAddonIds(new Set(myAddons.map(a => a.addon_id)));
      const quantities: Record<string, number> = {};
      myAddons.forEach(a => {
        if (a.quantity > 1) quantities[a.addon_id] = a.quantity;
      });
      if (Object.keys(quantities).length > 0) {
        setAddonQuantities(prev => ({ ...prev, ...quantities }));
      }
    }
  }, [myAddons]);

  const statusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-700 border-green-200";
    if (status === "trial") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "payment_overdue") return "bg-orange-100 text-orange-700 border-orange-200";
    if (status === "suspended") return "bg-red-100 text-red-700 border-red-200";
    if (status === "cancelled") return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-slate-100 text-slate-700";
  };

  const statusLabel = (status: string) => status.replace("_", " ");

  const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";
  const currentPlan = plans?.find((p: Plan) => p.id === tenantInfo?.plan_id);
  const isFreePlan = tenantInfo?.plan_id === FREE_PLAN_ID;
  const isLegacyPlan = !!(tenantInfo?.plans as Record<string, unknown> | null)?.is_legacy;
  const urlParams = new URLSearchParams(window.location.search);
  const justSucceeded = urlParams.get("success") === "1";
  const wasCancelled = urlParams.get("cancelled") === "1";

  if (tenantLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-32 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Billing &amp; Plan</h1>
        <p className="text-muted-foreground">Manage your subscription, add-ons, and payment details</p>
      </div>

      {justSucceeded && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          <span><strong>Payment successful!</strong> Your subscription is now active.</span>
        </div>
      )}

      {wasCancelled && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Checkout was cancelled — no charge was made.</span>
        </div>
      )}

      {tenantInfo?.status === "payment_overdue" && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <strong>Payment overdue.</strong> Please update your payment method to avoid service interruption.
          </div>
        </div>
      )}

      {isLegacyPlan && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div className="flex-1">
            <strong>Your plan has been updated.</strong> You are on a legacy pricing tier. We have moved to a flexible base plan + add-ons model. Your current features will continue working, but we recommend upgrading to take advantage of the new pricing.
          </div>
        </div>
      )}

      {tenantInfo?.status === "suspended" && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <strong>Account suspended.</strong> Your payment may have failed. Please update your payment method to restore access.
          </div>
        </div>
      )}

      {tenantInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Current Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={cn("capitalize border", statusColor(tenantInfo.status))}>
                  {statusLabel(tenantInfo.status)}
                </Badge>
              </div>
              {(currentPlan || tenantInfo.plans) && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold">
                    {(tenantInfo.plans as Record<string, unknown> | null)?.name as string || currentPlan?.name || "—"}
                    {isLegacyPlan && <span className="ml-1 text-xs text-amber-600">(Legacy)</span>}
                  </span>
                </div>
              )}
              {tenantInfo.trial_ends_at && tenantInfo.status === "trial" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trial ends</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(tenantInfo.trial_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
              {tenantInfo.subscription_renewal_at && (tenantInfo.status === "active" || tenantInfo.status === "payment_overdue") && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Renews</span>
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {new Date(tenantInfo.subscription_renewal_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
              {usageLimits && (<>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Users</span>
                    <span className="font-medium">
                      {usageLimits.currentUsers} of {usageLimits.maxUsers}
                      {usageLimits.addonExtraUsers > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">({usageLimits.baseMaxUsers} + {usageLimits.addonExtraUsers} add-on)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Jobs this month</span>
                    <span className="font-medium">
                      {usageLimits.maxJobsPerMonth === 9999 ? (
                        <>{usageLimits.currentJobsThisMonth} (Unlimited)</>
                      ) : (
                        <>
                          {usageLimits.currentJobsThisMonth} of {usageLimits.maxJobsPerMonth}
                          {usageLimits.addonExtraJobs > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">({usageLimits.baseMaxJobsPerMonth} + {usageLimits.addonExtraJobs} add-on)</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </>)}
            </CardContent>
          </Card>

          {isFreePlan ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Free Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  You're on the free plan. Upgrade to unlock more features, users, and jobs.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {pmLoading ? (
                  <div className="h-8 bg-slate-100 rounded animate-pulse" />
                ) : paymentMethod ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                    <CreditCard className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="font-medium capitalize">{BRAND_LABEL[paymentMethod.brand] || paymentMethod.brand} ending {paymentMethod.last4}</p>
                      <p className="text-xs text-muted-foreground">Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No payment method on file</p>
                )}

                {isAdmin && (tenantInfo.status === "active" || tenantInfo.status === "payment_overdue") && tenantInfo.stripe_customer_id && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => manageBillingMutation.mutate()}
                    disabled={manageBillingMutation.isPending}
                  >
                    {manageBillingMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Manage Billing
                  </Button>
                )}

              </CardContent>
            </Card>
          )}
        </div>
      )}

      {availableAddons && availableAddons.length > 0 && isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                Add-ons
              </CardTitle>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={cn("px-3 py-1 text-sm rounded-md transition-colors", billingCycle === "monthly" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("annual")}
                  className={cn("px-3 py-1 text-sm rounded-md transition-colors", billingCycle === "annual" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
                >
                  Annual <span className="text-xs text-green-600 font-medium">Save</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Toggle add-ons on or off. Your total updates instantly.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {availableAddons.map(addon => {
                const isActive = selectedAddonIds.has(addon.id);
                const unitPrice = billingCycle === "annual" ? Number(addon.annual_price) / 12 : Number(addon.monthly_price);
                const qty = addon.is_per_seat ? (addonQuantities[addon.id] || 1) : 1;
                const lineTotal = unitPrice * qty;
                return (
                  <div
                    key={addon.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                      isActive
                        ? "border-primary/40 bg-primary/5"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    onClick={() => {
                      setSelectedAddonIds(prev => {
                        const next = new Set(prev);
                        if (next.has(addon.id)) next.delete(addon.id);
                        else next.add(addon.id);
                        return next;
                      });
                    }}
                  >
                    <div className="pt-0.5">
                      {isActive ? (
                        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border-2 border-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm font-medium", !isActive && "text-muted-foreground")}>{addon.name}</p>
                        <span className={cn("text-sm font-semibold whitespace-nowrap", isActive ? "text-foreground" : "text-muted-foreground")}>
                          £{lineTotal.toFixed(2)}<span className="text-xs font-normal">/mo</span>
                        </span>
                      </div>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{addon.description}</p>
                      )}
                      {addon.is_per_seat && isActive && (
                        <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-muted-foreground">Qty:</span>
                          <button
                            type="button"
                            className="w-6 h-6 rounded border border-slate-300 text-xs font-bold flex items-center justify-center hover:bg-slate-50"
                            onClick={() => setAddonQuantities(prev => ({ ...prev, [addon.id]: Math.max(1, (prev[addon.id] || 1) - 1) }))}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{qty}</span>
                          <button
                            type="button"
                            className="w-6 h-6 rounded border border-slate-300 text-xs font-bold flex items-center justify-center hover:bg-slate-50"
                            onClick={() => setAddonQuantities(prev => ({ ...prev, [addon.id]: (prev[addon.id] || 1) + 1 }))}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-xs text-muted-foreground ml-1">× £{unitPrice.toFixed(2)} each</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {(() => {
              const addonsTotal = availableAddons.reduce((sum, addon) => {
                if (!selectedAddonIds.has(addon.id)) return sum;
                const unitPrice = billingCycle === "annual" ? Number(addon.annual_price) / 12 : Number(addon.monthly_price);
                const qty = addon.is_per_seat ? (addonQuantities[addon.id] || 1) : 1;
                return sum + unitPrice * qty;
              }, 0);

              const basePlan = isFreePlan
                ? (plans || []).find((p: Plan) => p.stripe_price_id && p.id !== FREE_PLAN_ID)
                : (plans || []).find((p: { id: string }) => p.id === tenantInfo?.plan_id);
              const cp = basePlan || (plans || [])[0];
              const isSoleTrader = tenantInfo?.company_type === "sole_trader";
              const planMonthly = cp
                ? (isSoleTrader && cp.sole_trader_price != null
                  ? (billingCycle === "annual" ? Number(cp.sole_trader_price_annual || cp.annual_price) / 12 : Number(cp.sole_trader_price))
                  : (billingCycle === "annual" ? Number(cp.annual_price) / 12 : Number(cp.monthly_price)))
                : 0;
              const grandTotal = planMonthly + addonsTotal;

              const currentAddonIds = new Set((myAddons || []).map(a => a.addon_id));
              const idsChanged = selectedAddonIds.size !== currentAddonIds.size ||
                [...selectedAddonIds].some(id => !currentAddonIds.has(id)) ||
                [...currentAddonIds].some(id => !selectedAddonIds.has(id));
              const qtyChanged = (myAddons || []).some(a => {
                if (!selectedAddonIds.has(a.addon_id)) return false;
                const currentQty = a.quantity || 1;
                const newQty = addonQuantities[a.addon_id] || 1;
                return currentQty !== newQty;
              });
              const hasChanges = idsChanged || qtyChanged;

              return (
                <div className="rounded-lg bg-slate-50 border p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Base Plan</span>
                    <span className="font-medium">£{planMonthly.toFixed(2)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Add-ons ({selectedAddonIds.size})</span>
                    <span className="font-medium">£{addonsTotal.toFixed(2)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t text-sm">
                    <span className="font-semibold">Estimated Total</span>
                    <span className="text-lg font-bold">£{grandTotal.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                  </div>
                  {billingCycle === "annual" && (
                    <p className="text-xs text-muted-foreground text-right">Billed £{(grandTotal * 12).toFixed(2)}/year</p>
                  )}

                  {hasChanges && tenantInfo?.status === "active" && (
                    <Button
                      className="w-full mt-2"
                      onClick={() => updateAddonsMutation.mutate([...selectedAddonIds])}
                      disabled={updateAddonsMutation.isPending}
                    >
                      {updateAddonsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
                      Save Add-on Changes
                    </Button>
                  )}

                  {tenantInfo?.status !== "active" && (
                    <Button
                      className="w-full mt-2"
                      onClick={() => {
                        const paidPlan = (plans || []).find((p: Plan) => p.stripe_price_id && p.id !== FREE_PLAN_ID) || (plans || [])[0];
                        if (paidPlan) {
                          setSelectedPlan(paidPlan.id);
                          setShowUpgrade(true);
                        }
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Upgrade to Paid Plan — £{grandTotal.toFixed(2)}/mo
                    </Button>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {availableAddons && availableAddons.length > 0 && !isAdmin && myAddons && myAddons.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Active Add-ons ({myAddons.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myAddons.map(ta => (
                <div key={ta.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ta.addons?.name || "Add-on"}</p>
                    {ta.addons?.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ta.addons.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {showUpgrade && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Confirm Upgrade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const plan = plans?.find((p) => p.id === selectedPlan);
                if (!plan) return null;
                const isSoleTrader = tenantInfo?.company_type === "sole_trader";
                const planMonthly = isSoleTrader && plan.sole_trader_price != null
                  ? (billingCycle === "annual" ? Number(plan.sole_trader_price_annual || plan.annual_price) / 12 : Number(plan.sole_trader_price))
                  : (billingCycle === "annual" ? Number(plan.annual_price) / 12 : Number(plan.monthly_price));

                const selectedAddonsWithPrice = (availableAddons || [])
                  .filter(a => selectedAddonIds.has(a.id))
                  .map(a => {
                    const unitPrice = billingCycle === "annual" ? Number(a.annual_price) / 12 : Number(a.monthly_price);
                    const qty = a.is_per_seat ? (addonQuantities[a.id] || 1) : 1;
                    return { ...a, unitPrice, qty, lineTotal: unitPrice * qty };
                  });
                const addonsTotal = selectedAddonsWithPrice.reduce((sum, a) => sum + a.lineTotal, 0);
                const grandTotal = planMonthly + addonsTotal;

                return (
                  <>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-semibold">{plan.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Billing</span>
                        <span className="capitalize">{billingCycle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Plan</span>
                        <span className="font-medium">£{planMonthly.toFixed(2)}/mo</span>
                      </div>
                      {selectedAddonsWithPrice.length > 0 && (
                        <>
                          <div className="pt-1 border-t">
                            <span className="text-muted-foreground text-xs">Add-ons ({selectedAddonsWithPrice.length}):</span>
                          </div>
                          {selectedAddonsWithPrice.map(a => (
                            <div key={a.id} className="flex justify-between pl-2">
                              <span className="text-muted-foreground">{a.name}{a.qty > 1 ? ` ×${a.qty}` : ""}</span>
                              <span className="font-medium">£{a.lineTotal.toFixed(2)}/mo</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="flex justify-between pt-2 border-t font-semibold">
                        <span>Total</span>
                        <span className="text-lg">£{grandTotal.toFixed(2)}/mo</span>
                      </div>
                      {billingCycle === "annual" && (
                        <p className="text-xs text-muted-foreground text-right">Billed £{(grandTotal * 12).toFixed(2)}/year</p>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">You'll be redirected to our secure payment page to complete your subscription.</p>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => checkoutMutation.mutate()}
                        disabled={checkoutMutation.isPending}
                      >
                        {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                        Continue to Payment — £{grandTotal.toFixed(2)}/mo
                      </Button>
                      <Button variant="outline" onClick={() => { setShowUpgrade(false); setSelectedPlan(null); }}>Cancel</Button>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
