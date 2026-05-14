import { Card } from "@/components/ui/card";
import { MessageSquarePlus, AlertTriangle, Plus, FileText, Receipt, CalendarDays, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback, lazy, Suspense } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import AddToHomeScreen from "@/components/add-to-homescreen";
import { useInitData } from "@/hooks/use-init-data";
import { useHomepageData } from "@/hooks/use-homepage-data";
import { QuickEnquiryDialog } from "@/components/quick-enquiry-dialog";
const BookJobDialog = lazy(() => import("@/components/book-job-dialog").then(m => ({ default: m.BookJobDialog })));
const QuickInvoiceDialog = lazy(() => import("@/components/quick-invoice-dialog").then(m => ({ default: m.QuickInvoiceDialog })));

type DashboardJob = {
  id: string;
  job_type: string;
  status: string;
  priority: string;
  scheduled_date: string | Date;
  scheduled_time?: string | null;
  description?: string | null;
  customer_name?: string | null;
  property_address?: string | null;
  technician_name?: string | null;
};

type DashboardData = {
  todays_jobs?: DashboardJob[];
  upcoming_jobs?: DashboardJob[];
  stats?: {
    total_jobs_today: number;
    completed_this_week: number;
    overdue_count: number;
    total_customers: number;
  };
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500" },
  requires_follow_up: { label: "Follow Up", className: "bg-rose-100 text-rose-700" },
  awaiting_parts: { label: "Awaiting Parts", className: "bg-orange-100 text-orange-700" },
  invoiced: { label: "Invoiced", className: "bg-purple-100 text-purple-700" },
};

const JOB_TYPE_LABELS: Record<string, string> = {
  service: "Service",
  breakdown: "Breakdown",
  installation: "Installation",
  inspection: "Inspection",
  follow_up: "Follow Up",
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: initData } = useInitData();
  const { data: homepageData, isLoading: homepageLoading } = useHomepageData();
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddEnquiry, setShowAddEnquiry] = useState(false);
  const [quickDate, setQuickDate] = useState<string | undefined>(undefined);
  const [showQuickInvoice, setShowQuickInvoice] = useState<"invoice" | "quote" | null>(null);
  const { hasFeature: dashHasFeature } = usePlanFeatures();
  const hasJobManagement = dashHasFeature("job_management");

  const dashboard = homepageData?.dashboard as DashboardData | undefined;
  const todaysJobs = dashboard?.todays_jobs ?? [];
  const upcomingJobs = (dashboard?.upcoming_jobs ?? []).slice(0, 5);
  const stats = dashboard?.stats;

  const checkJobLimit = useCallback(() => {
    const limits = initData?.usageLimits;
    if (limits && limits.maxJobsPerMonth !== 9999 && limits.currentJobsThisMonth >= limits.maxJobsPerMonth) {
      toast({
        title: "Monthly job limit reached",
        description: `You've used ${limits.currentJobsThisMonth} of ${limits.maxJobsPerMonth} jobs this month. Upgrade your plan or purchase additional job capacity to create more.`,
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

  const canCreateJobs = hasJobManagement && (profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin");
  const canCreateInvoices = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  const overdueFollowUpsCount = initData?.overdueFollowUpsCount ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AddToHomeScreen />

      {hasJobManagement && overdueFollowUpsCount > 0 && (
        <a href="/follow-ups" className="block">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer text-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="font-medium text-orange-800">{overdueFollowUpsCount} overdue follow-up{overdueFollowUpsCount !== 1 ? "s" : ""}</span>
            <span className="text-orange-600 hidden sm:inline">&mdash; parts expected dates have passed</span>
            <span className="ml-auto text-orange-500 text-xs">Review &rarr;</span>
          </div>
        </a>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-2">
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening today.</p>
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

      {/* Stats */}
      {hasJobManagement && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Today's Jobs</p>
            <p className="text-2xl font-bold mt-1">{homepageLoading ? "—" : (stats?.total_jobs_today ?? 0)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed This Week</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{homepageLoading ? "—" : (stats?.completed_this_week ?? 0)}</p>
          </Card>
          <Card className="p-4 col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overdue Services</p>
            <p className={`text-2xl font-bold mt-1 ${(stats?.overdue_count ?? 0) > 0 ? "text-rose-600" : ""}`}>
              {homepageLoading ? "—" : (stats?.overdue_count ?? 0)}
            </p>
          </Card>
        </div>
      )}

      {/* Today's jobs */}
      {hasJobManagement && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Today's Jobs</h2>
            <Link href="/schedule" className="text-sm text-primary hover:underline flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> Full Schedule
            </Link>
          </div>

          {homepageLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : todaysJobs.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No jobs scheduled for today.</p>
              {canCreateJobs && (
                <Button size="sm" className="mt-3 gap-1.5" onClick={() => handleBookJob()}>
                  <Plus className="w-4 h-4" /> Book a Job
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-2">
              {todaysJobs.map(job => {
                const sc = STATUS_CONFIG[job.status] ?? { label: job.status, className: "bg-slate-100 text-slate-600" };
                const time = job.scheduled_time ? String(job.scheduled_time).slice(0, 5) : null;
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="p-4 border border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        {time && (
                          <div className="shrink-0 min-w-[40px] text-center">
                            <span className="text-sm font-semibold tabular-nums">{time}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{job.customer_name ?? "Unknown Customer"}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${sc.className}`}>{sc.label}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            {job.property_address && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />{job.property_address}
                              </span>
                            )}
                            <span className="shrink-0">{JOB_TYPE_LABELS[job.job_type] ?? job.job_type}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Upcoming jobs */}
      {hasJobManagement && upcomingJobs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
          <div className="space-y-2">
            {upcomingJobs.map(job => {
              const sc = STATUS_CONFIG[job.status] ?? { label: job.status, className: "bg-slate-100 text-slate-600" };
              const dateStr = job.scheduled_date
                ? new Date(job.scheduled_date as string).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
                : null;
              return (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <Card className="p-4 border border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      {dateStr && (
                        <div className="shrink-0 min-w-[56px] text-center">
                          <span className="text-xs font-semibold text-muted-foreground">{dateStr}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{job.customer_name ?? "Unknown Customer"}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${sc.className}`}>{sc.label}</span>
                        </div>
                        {job.property_address && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 truncate mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />{job.property_address}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
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
