import { Suspense, lazy } from "react";
import { CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";

const ScheduleHolidayManager = lazy(() => import("@/components/schedule-holiday-manager"));

export default function LeaveHolidaysPage() {
  const { profile } = useAuth();
  const { hasFeature } = usePlanFeatures();

  const hasJobManagement = hasFeature("job_management");
  const canManageHolidays = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  if (!hasJobManagement) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-display font-bold text-foreground">Leave & Holidays</h1>
        <p className="text-sm text-muted-foreground">This feature requires job management to be enabled on your plan.</p>
      </div>
    );
  }

  if (!canManageHolidays) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-display font-bold text-foreground">Leave & Holidays</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to manage leave and holidays.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Leave & Holidays</h1>
          <p className="text-muted-foreground mt-1">
            Manage technician leave blocks, public holidays, and UK bank holiday imports.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="rounded-xl border border-border bg-card animate-pulse" style={{ height: 360 }} />}>
        <ScheduleHolidayManager />
      </Suspense>
    </div>
  );
}
