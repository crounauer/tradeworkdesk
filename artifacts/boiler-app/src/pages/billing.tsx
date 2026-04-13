import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Check, ExternalLink, AlertTriangle, RefreshCw, Loader2,
  ChevronRight, Calendar, Users, Briefcase, X as XIcon, Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_LABELS } from "@/hooks/use-plan-features";

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
  activated_at: string;
  addons: Addon | null;
}

interface TenantInfo {
  id: string;
  company_name: string;
  status: string;
  trial_ends_at: string | null;
  plan_id: string | null;
  stripe_customer_id?: string | null;
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
  const [showAddonManager, setShowAddonManager] = useState(false);

  const isAdmin = profile?.role === "admin";

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
      setShowAddonManager(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-700 border-green-200";
    if (status === "trial") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "payment_overdue") return "bg-orange-100 text-orange-700 border-orange-200";
    if (status === "suspended") return "bg-red-100 text-red-700 border-red-200";
    if (status === "cancelled") return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-slate-100 text-slate-700";
  };

  const statusLabel = (status: string) => status.replace("_", " ");

  const currentPlan = plans?.find((p: Plan) => p.id === tenantInfo?.plan_id);
  const isLegacyPlan = !!(tenantInfo?.plans as Record<string, unknown> | null)?.is_legacy;
  const activeAddonIds = new Set((myAddons || []).map(a => a.addon_id));

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
              {(() => {
                const planData = (tenantInfo.plans || currentPlan) as Record<string, unknown> | null;
                if (!planData) return null;
                return (<>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Max users</span>
                    <span>{planData.max_users as number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Max jobs/mo</span>
                    <span>{(planData.max_jobs_per_month as number) === 9999 ? "Unlimited" : planData.max_jobs_per_month as number}</span>
                  </div>
                </>);
              })()}
            </CardContent>
          </Card>

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

              {isAdmin && tenantInfo.status !== "active" && (
                <Button className="w-full" onClick={() => {
                  const firstPaid = (plans || []).find((p) => p.stripe_price_id);
                  if (firstPaid) { setSelectedPlan(firstPaid.id); }
                  setShowUpgrade(true);
                }}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Upgrade to Paid Plan
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {myAddons && myAddons.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Active Add-ons
            </CardTitle>
            {isAdmin && tenantInfo?.status === "active" && (
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedAddonIds(new Set(myAddons.map(a => a.addon_id)));
                setShowAddonManager(true);
              }}>
                Manage Add-ons
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myAddons.map(ta => (
                <div key={ta.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                  <Package className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{ta.addons?.name || "Add-on"}</p>
                    {ta.addons?.description && (
                      <p className="text-xs text-muted-foreground">{ta.addons.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && tenantInfo?.status === "active" && (!myAddons || myAddons.length === 0) && (
        <Card>
          <CardContent className="py-6 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No add-ons active. Boost your plan with extra features.</p>
            <Button variant="outline" size="sm" onClick={() => {
              setSelectedAddonIds(new Set());
              setShowAddonManager(true);
            }}>
              Browse Add-ons
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" />
              Your Plan
            </CardTitle>
            {isAdmin && (
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
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const currentPlan = (plans || []).find((p: { id: string }) => p.id === tenantInfo?.plan_id) || (plans || [])[0];
            if (!currentPlan) return <p className="text-sm text-muted-foreground">No plan information available</p>;
            const isSoleTrader = tenantInfo?.company_type === "sole_trader";
            const effectiveMonthly = isSoleTrader && currentPlan.sole_trader_price != null ? currentPlan.sole_trader_price : currentPlan.monthly_price;
            const effectiveAnnual = isSoleTrader && currentPlan.sole_trader_price_annual != null ? currentPlan.sole_trader_price_annual : currentPlan.annual_price;
            const price = billingCycle === "annual" ? effectiveAnnual / 12 : effectiveMonthly;
            return (
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{currentPlan.name || "Base Plan"}</h3>
                  {currentPlan.description && <p className="text-sm text-muted-foreground">{currentPlan.description}</p>}
                  <div className="text-sm text-muted-foreground mt-2 space-y-1">
                    <p className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Up to {currentPlan.max_users} users</p>
                    <p className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {currentPlan.max_jobs_per_month === 9999 ? "Unlimited" : `Up to ${currentPlan.max_jobs_per_month}`} jobs/month</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    £{Number(price).toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                  {billingCycle === "annual" && (
                    <p className="text-xs text-muted-foreground">Billed £{Number(effectiveAnnual).toFixed(2)}/year</p>
                  )}
                  {isSoleTrader && currentPlan.sole_trader_price != null && (
                    <p className="text-xs text-green-600 font-medium">Sole trader pricing</p>
                  )}
                </div>
              </div>
            );
          })()}
          {isAdmin && !tenantInfo?.stripe_subscription_id && (
            <Button
              className="w-full"
              onClick={() => {
                const basePlan = (plans || []).find((p: { id: string }) => p.id === tenantInfo?.plan_id) || (plans || [])[0];
                if (basePlan) {
                  setSelectedPlan(basePlan.id);
                  setShowUpgrade(true);
                }
              }}
            >
              Upgrade to Paid Plan <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {showUpgrade && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Confirm Upgrade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const plan = plans?.find((p) => p.id === selectedPlan);
                if (!plan) return null;
                const price = billingCycle === "annual" ? plan.annual_price : plan.monthly_price;
                return (
                  <>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-semibold">{plan.name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Billing</span><span className="capitalize">{billingCycle}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">£{Number(price).toFixed(2)}/{billingCycle === "annual" ? "year" : "mo"}</span></div>
                    </div>

                    {availableAddons && availableAddons.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Select add-ons (optional):</p>
                        <div className="space-y-2">
                          {availableAddons.map(addon => {
                            const selected = selectedAddonIds.has(addon.id);
                            const addonPrice = billingCycle === "annual" ? Number(addon.annual_price) / 12 : Number(addon.monthly_price);
                            return (
                              <label key={addon.id} className={cn(
                                "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                                selected ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                              )}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
                                    setSelectedAddonIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(addon.id)) next.delete(addon.id);
                                      else next.add(addon.id);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{addon.name}</p>
                                  {addon.description && <p className="text-xs text-muted-foreground">{addon.description}</p>}
                                  {addon.is_per_seat && selected && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-muted-foreground">Seats:</span>
                                      <button type="button" className="w-6 h-6 rounded border text-xs font-bold" onClick={(e) => { e.preventDefault(); setAddonQuantities(prev => ({ ...prev, [addon.id]: Math.max(1, (prev[addon.id] || 1) - 1) })); }}>-</button>
                                      <span className="text-xs font-medium w-6 text-center">{addonQuantities[addon.id] || 1}</span>
                                      <button type="button" className="w-6 h-6 rounded border text-xs font-bold" onClick={(e) => { e.preventDefault(); setAddonQuantities(prev => ({ ...prev, [addon.id]: (prev[addon.id] || 1) + 1 })); }}>+</button>
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-semibold shrink-0">£{(addonPrice * (addon.is_per_seat ? (addonQuantities[addon.id] || 1) : 1)).toFixed(2)}/mo{addon.is_per_seat ? ' per seat' : ''}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">You'll be redirected to our secure payment page to complete your subscription.</p>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => checkoutMutation.mutate()}
                        disabled={checkoutMutation.isPending}
                      >
                        {checkoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                        Continue to Payment
                      </Button>
                      <Button variant="outline" onClick={() => { setShowUpgrade(false); setSelectedPlan(null); setSelectedAddonIds(new Set()); }}>Cancel</Button>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {showAddonManager && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Manage Add-ons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Toggle the add-ons you want. Changes will be prorated on your next invoice.</p>

              <div className="space-y-2">
                {(availableAddons || []).map(addon => {
                  const selected = selectedAddonIds.has(addon.id);
                  const addonPrice = billingCycle === "annual" ? Number(addon.annual_price) / 12 : Number(addon.monthly_price);
                  return (
                    <label key={addon.id} className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                      selected ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                    )}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          setSelectedAddonIds(prev => {
                            const next = new Set(prev);
                            if (next.has(addon.id)) next.delete(addon.id);
                            else next.add(addon.id);
                            return next;
                          });
                        }}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{addon.name}</p>
                        {addon.description && <p className="text-xs text-muted-foreground">{addon.description}</p>}
                        {addon.is_per_seat && selected && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">Seats:</span>
                            <button
                              type="button"
                              className="w-6 h-6 rounded border text-xs font-bold"
                              onClick={(e) => {
                                e.preventDefault();
                                setAddonQuantities(prev => ({ ...prev, [addon.id]: Math.max(1, (prev[addon.id] || 1) - 1) }));
                              }}
                            >-</button>
                            <span className="text-xs font-medium w-6 text-center">{addonQuantities[addon.id] || 1}</span>
                            <button
                              type="button"
                              className="w-6 h-6 rounded border text-xs font-bold"
                              onClick={(e) => {
                                e.preventDefault();
                                setAddonQuantities(prev => ({ ...prev, [addon.id]: (prev[addon.id] || 1) + 1 }));
                              }}
                            >+</button>
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-semibold shrink-0">£{(addonPrice * (addon.is_per_seat ? (addonQuantities[addon.id] || 1) : 1)).toFixed(2)}/mo</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => updateAddonsMutation.mutate([...selectedAddonIds])}
                  disabled={updateAddonsMutation.isPending}
                >
                  {updateAddonsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setShowAddonManager(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
