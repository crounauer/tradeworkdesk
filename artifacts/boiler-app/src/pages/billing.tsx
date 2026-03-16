import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Check, ExternalLink, AlertTriangle, RefreshCw, Loader2,
  ChevronRight, Calendar, Users, Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface TenantInfo {
  id: string;
  company_name: string;
  status: string;
  trial_ends_at: string | null;
  plan_id: string | null;
  plans?: { name: string; monthly_price: number; max_users: number; max_jobs_per_month: number } | null;
  subscription_renewal_at?: string | null;
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
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [showUpgrade, setShowUpgrade] = useState(false);

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
        body: JSON.stringify({ plan_id: selectedPlan, billing_cycle: billingCycle }),
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

  const statusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-700 border-green-200";
    if (status === "trial") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "payment_overdue") return "bg-orange-100 text-orange-700 border-orange-200";
    if (status === "suspended") return "bg-red-100 text-red-700 border-red-200";
    if (status === "cancelled") return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-slate-100 text-slate-700";
  };

  const statusLabel = (status: string) => status.replace("_", " ");

  const currentPlan = plans?.find((p) => p.id === tenantInfo?.plan_id);

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
        <p className="text-muted-foreground">Manage your subscription and payment details</p>
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
              {currentPlan && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold">{currentPlan.name}</span>
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
              {currentPlan && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Max users</span>
                    <span>{currentPlan.max_users}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Max jobs/mo</span>
                    <span>{currentPlan.max_jobs_per_month === 9999 ? "Unlimited" : currentPlan.max_jobs_per_month}</span>
                  </div>
                </>
              )}
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

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Available Plans</h2>
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
                Annual <span className="text-xs text-green-600 font-medium">Save ~17%</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(plans || []).map((plan) => {
            const isCurrent = plan.id === tenantInfo?.plan_id;
            const price = billingCycle === "annual" ? plan.annual_price / 12 : plan.monthly_price;
            const hasStripePrice = billingCycle === "annual" ? !!plan.stripe_price_id_annual : !!plan.stripe_price_id;
            return (
              <Card key={plan.id} className={cn(isCurrent ? "border-primary ring-1 ring-primary/30" : "")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="w-4 h-4" />
                    {plan.name}
                    {isCurrent && <Badge className="ml-auto text-xs">Current</Badge>}
                  </CardTitle>
                  {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-bold">
                    £{Number(price).toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                  {billingCycle === "annual" && (
                    <p className="text-xs text-muted-foreground">Billed £{Number(plan.annual_price).toFixed(2)}/year</p>
                  )}
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Up to {plan.max_users} users</p>
                    <p className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {plan.max_jobs_per_month === 9999 ? "Unlimited" : `Up to ${plan.max_jobs_per_month}`} jobs/month</p>
                  </div>
                  {plan.features && (
                    <div className="text-sm space-y-1 pt-2 border-t">
                      {Object.entries(plan.features)
                        .filter(([, v]) => v)
                        .map(([key]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                            <span className="capitalize">{key.replace(/_/g, " ")}</span>
                          </div>
                        ))}
                    </div>
                  )}
                  {isAdmin && !isCurrent && (
                    <Button
                      className="w-full mt-2"
                      variant="outline"
                      size="sm"
                      disabled={!hasStripePrice || checkoutMutation.isPending}
                      onClick={() => {
                        setSelectedPlan(plan.id);
                        setShowUpgrade(true);
                      }}
                    >
                      {!hasStripePrice ? "Coming Soon" : (
                        <>Select Plan <ChevronRight className="w-3.5 h-3.5 ml-1" /></>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {showUpgrade && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
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
