import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check } from "lucide-react";

export default function Billing() {
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const res = await fetch("/api/me/tenant");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans/public");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const currentPlan = plans?.find((p: { id: string }) => p.id === tenantInfo?.plan_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Billing & Plan</h1>
        <p className="text-muted-foreground">View your current subscription and available plans</p>
      </div>

      {tenantInfo && (
        <Card>
          <CardHeader><CardTitle>Current Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="secondary" className={
                tenantInfo.status === "active" ? "bg-green-100 text-green-700" :
                tenantInfo.status === "trial" ? "bg-amber-100 text-amber-700" :
                tenantInfo.status === "suspended" ? "bg-red-100 text-red-700" : ""
              }>{tenantInfo.status}</Badge>
            </div>
            {currentPlan && (
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">Plan:</span>
                <span className="font-medium">{currentPlan.name}</span>
              </div>
            )}
            {tenantInfo.trial_ends_at && (
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">Trial ends:</span>
                <span>{new Date(tenantInfo.trial_ends_at).toLocaleDateString()}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground pt-2">
              To upgrade or change your plan, please contact our sales team.
            </p>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(plans || []).map((plan: { id: string; name: string; description: string; monthly_price: number; annual_price: number; max_users: number; max_jobs_per_month: number; features: Record<string, boolean> }) => (
          <Card key={plan.id} className={plan.id === tenantInfo?.plan_id ? "border-blue-300 ring-1 ring-blue-200" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {plan.name}
                {plan.id === tenantInfo?.plan_id && <Badge className="ml-auto">Current</Badge>}
              </CardTitle>
              {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">
                EUR {(plan.monthly_price / 100).toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Up to {plan.max_users} users</p>
                <p>Up to {plan.max_jobs_per_month} jobs/month</p>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
