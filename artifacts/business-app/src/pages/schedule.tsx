import { lazy, Suspense, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useInitData } from "@/hooks/use-init-data";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquarePlus, FileText, Receipt } from "lucide-react";
import { QuickEnquiryDialog } from "@/components/quick-enquiry-dialog";

const ScheduleCalendar = lazy(() => import("@/components/schedule-calendar"));
const BookJobDialog = lazy(() => import("@/components/book-job-dialog").then(m => ({ default: m.BookJobDialog })));
const QuickInvoiceDialog = lazy(() => import("@/components/quick-invoice-dialog").then(m => ({ default: m.QuickInvoiceDialog })));
const ScheduleHolidayManager = lazy(() => import("@/components/schedule-holiday-manager"));

export default function SchedulePage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: initData } = useInitData();
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddEnquiry, setShowAddEnquiry] = useState(false);
  const [quickDate, setQuickDate] = useState<string | undefined>(undefined);
  const [showQuickInvoice, setShowQuickInvoice] = useState<"invoice" | "quote" | null>(null);
  const { hasFeature } = usePlanFeatures();
  const hasJobManagement = hasFeature("job_management");

  const checkJobLimit = useCallback(() => {
    const limits = initData?.usageLimits;
    if (limits && limits.maxJobsPerMonth !== 9999 && limits.currentJobsThisMonth >= limits.maxJobsPerMonth) {
      toast({
        title: "Monthly job limit reached",
        description: `You've used ${limits.currentJobsThisMonth} of ${limits.maxJobsPerMonth} jobs this month. Upgrade your plan to create more.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  }, [initData, toast]);

  const handleBookJob = useCallback((date?: string) => {
    if (!checkJobLimit()) return;
    setQuickDate(date);
    setShowQuickBook(true);
  }, [checkJobLimit]);

  const handleDayAction = useCallback((date: string, action: "enquiry" | "job") => {
    if (action === "enquiry") {
      setQuickDate(date);
      setShowAddEnquiry(true);
    } else {
      handleBookJob(date);
    }
  }, [handleBookJob]);

  const canCreateJobs = hasJobManagement && (profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin");
  const canCreateInvoices = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";
  const canManageHolidays = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-2">
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground mt-1">View and manage your job schedule.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateInvoices && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQuickInvoice("quote")}>
              <FileText className="w-4 h-4" /> + Quote
            </Button>
          )}
          {canCreateInvoices && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQuickInvoice("invoice")}>
              <Receipt className="w-4 h-4" /> + Invoice
            </Button>
          )}
          {canCreateJobs && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setQuickDate(undefined); setShowAddEnquiry(true); }}>
              <MessageSquarePlus className="w-4 h-4" /> Add Enquiry
            </Button>
          )}
          {canCreateJobs && (
            <Button size="sm" className="gap-1.5" onClick={() => handleBookJob()}>
              <Plus className="w-4 h-4" /> Book Job
            </Button>
          )}
        </div>
      </div>

      {hasJobManagement && (
        <Suspense fallback={
          <div className="rounded-xl border border-border bg-card animate-pulse" style={{ height: 420 }} />
        }>
          <ScheduleCalendar onDayAction={canCreateJobs ? handleDayAction : undefined} />
        </Suspense>
      )}

      {hasJobManagement && canManageHolidays && (
        <Suspense fallback={<div className="rounded-xl border border-border bg-card animate-pulse" style={{ height: 280 }} />}>
          <ScheduleHolidayManager />
        </Suspense>
      )}

      {hasJobManagement && showQuickBook && (
        <Suspense fallback={null}>
          <BookJobDialog open={showQuickBook} onOpenChange={setShowQuickBook} initialDate={quickDate} />
        </Suspense>
      )}
      {hasJobManagement && showAddEnquiry && (
        <QuickEnquiryDialog open={showAddEnquiry} onOpenChange={setShowAddEnquiry} initialDate={quickDate} />
      )}
      {showQuickInvoice && (
        <Suspense fallback={null}>
          <QuickInvoiceDialog type={showQuickInvoice} onOpenChange={(v) => { if (!v) setShowQuickInvoice(null); }} />
        </Suspense>
      )}
    </div>
  );
}
