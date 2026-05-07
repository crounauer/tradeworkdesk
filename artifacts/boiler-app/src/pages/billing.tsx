import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Check, ExternalLink, AlertTriangle, Loader2,
  Calendar, Users,
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

  const isAdmin = profile?.role === "admin";
  const { data: initData } = useInitData();
  const usageLimits = initData?.usageLimits;
  const currentUsers = usageLimits?.currentUsers ?? 1;

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
  const monthlyTotal = BASE_PRICE + extraUsers * PER_SEAT_PRICE;

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
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>£{monthlyTotal}/month</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
              <Users className="w-3 h-3" />
              <span>{currentUsers} active user{currentUsers === 1 ? "" : "s"} · extra users charged £{PER_SEAT_PRICE}/mo each</span>
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
    </div>
  );
}
