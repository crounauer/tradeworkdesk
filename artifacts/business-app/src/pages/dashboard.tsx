import { Card } from "@/components/ui/card";
import { MessageSquarePlus, AlertTriangle, Plus, FileText, Receipt, CalendarDays, MapPin, ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useCallback, lazy, Suspense, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import AddToHomeScreen from "@/components/add-to-homescreen";
import { useInitData } from "@/hooks/use-init-data";
import { useHomepageData } from "@/hooks/use-homepage-data";
import { useCalendarData } from "@/hooks/use-calendar-data";
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
  follow_up_required?: DashboardJob[];
  stats?: {
    total_jobs_today: number;
    completed_this_week: number;
    overdue_count: number;
    total_customers: number;
    unpaid_invoices_count: number;
  };
};

type CalendarDashboardJob = {
  id: string;
  status: string;
  assigned_technician_id?: string | null;
  scheduled_date: string;
};

type CalendarProfile = {
  id: string;
  full_name: string;
  role: string;
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

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

const ESSENTIAL_SETUP_PROMPT_MAX_SHOWS = 3;
const ESSENTIAL_SETUP_KEY_BASE = "twd-essential-setup-v1";

type EssentialSetupState = {
  shownCount: number;
  dismissed: boolean;
  completed: boolean;
};

type EssentialSetupChecks = {
  hasServices: boolean;
  hasCustomers: boolean;
  hasActiveUser: boolean;
};

function getEssentialSetupStorageKey(userId: string): string {
  return `${ESSENTIAL_SETUP_KEY_BASE}:${userId}`;
}

function readEssentialSetupState(userId: string): EssentialSetupState {
  if (typeof window === "undefined") {
    return { shownCount: 0, dismissed: false, completed: false };
  }
  try {
    const raw = window.localStorage.getItem(getEssentialSetupStorageKey(userId));
    if (!raw) return { shownCount: 0, dismissed: false, completed: false };
    const parsed = JSON.parse(raw) as Partial<EssentialSetupState>;
    return {
      shownCount: Number(parsed.shownCount || 0),
      dismissed: Boolean(parsed.dismissed),
      completed: Boolean(parsed.completed),
    };
  } catch {
    return { shownCount: 0, dismissed: false, completed: false };
  }
}

function writeEssentialSetupState(userId: string, state: EssentialSetupState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getEssentialSetupStorageKey(userId), JSON.stringify(state));
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: initData } = useInitData();
  const { data: homepageData, isLoading: homepageLoading } = useHomepageData();
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddEnquiry, setShowAddEnquiry] = useState(false);
  const [quickDate, setQuickDate] = useState<string | undefined>(undefined);
  const [showQuickInvoice, setShowQuickInvoice] = useState<"invoice" | "quote" | null>(null);
  const [showEssentialSetupPrompt, setShowEssentialSetupPrompt] = useState(false);
  const [essentialSetupState, setEssentialSetupState] = useState<EssentialSetupState>({ shownCount: 0, dismissed: false, completed: false });
  const [hasServices, setHasServices] = useState(false);
  const [engineerFilter, setEngineerFilter] = useState<string>("all");
  const { hasFeature: dashHasFeature } = usePlanFeatures();
  const hasJobManagement = dashHasFeature("job_management");
  const engineerFilterStorageKey = useMemo(
    () => profile?.id ? `twd-dashboard-engineer-filter:${profile.id}` : null,
    [profile?.id]
  );

  const dashboard = homepageData?.dashboard as DashboardData | undefined;
  const todaysJobsBase = dashboard?.todays_jobs ?? [];
  const upcomingJobsBase = dashboard?.upcoming_jobs ?? [];
  const followUpsBase = dashboard?.follow_up_required ?? [];
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
  const hasCustomers = (stats?.total_customers ?? 0) > 0;
  const hasActiveUser = (initData?.usageLimits?.currentUsers ?? 0) > 0;

  const todayIso = useMemo(() => toDateStr(new Date()), []);
  const weekAheadIso = useMemo(() => toDateStr(addDays(new Date(), 7)), []);
  const { data: teamCalendarData } = useCalendarData({ date_from: todayIso, date_to: weekAheadIso });
  const teamCalendarJobs = ((teamCalendarData?.jobs ?? []) as CalendarDashboardJob[]);
  const teamProfiles = ((teamCalendarData?.profiles ?? []) as CalendarProfile[]);
  const engineerProfiles = useMemo(
    () => teamProfiles
      .filter((p) => p.role === "technician")
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [teamProfiles]
  );
  const multiEngineerMode = canCreateJobs && engineerProfiles.length > 1;
  const selectedEngineerName = useMemo(
    () => engineerFilter === "all"
      ? "All Engineers"
      : (engineerProfiles.find((engineer) => engineer.id === engineerFilter)?.full_name || "Selected Engineer"),
    [engineerFilter, engineerProfiles]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!engineerFilterStorageKey) return;
    const saved = window.localStorage.getItem(engineerFilterStorageKey);
    if (saved) setEngineerFilter(saved);
  }, [engineerFilterStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!engineerFilterStorageKey) return;
    window.localStorage.setItem(engineerFilterStorageKey, engineerFilter);
  }, [engineerFilterStorageKey, engineerFilter]);

  useEffect(() => {
    if (engineerFilter === "all") return;
    if (!engineerProfiles.some((engineer) => engineer.id === engineerFilter)) {
      setEngineerFilter("all");
    }
  }, [engineerFilter, engineerProfiles]);

  const activeTeamJobs = useMemo(
    () => teamCalendarJobs.filter((job) => job.status !== "cancelled" && job.status !== "completed"),
    [teamCalendarJobs]
  );

  const scopedEngineerJobIds = useMemo(
    () => engineerFilter === "all"
      ? null
      : new Set(
          teamCalendarJobs
            .filter((job) => (job.assigned_technician_id || null) === engineerFilter)
            .map((job) => job.id)
        ),
    [engineerFilter, teamCalendarJobs]
  );

  const todaysJobs = useMemo(
    () => scopedEngineerJobIds ? todaysJobsBase.filter((job) => scopedEngineerJobIds.has(job.id)) : todaysJobsBase,
    [todaysJobsBase, scopedEngineerJobIds]
  );
  const upcomingJobs = useMemo(
    () => {
      const list = scopedEngineerJobIds
        ? upcomingJobsBase.filter((job) => scopedEngineerJobIds.has(job.id))
        : upcomingJobsBase;
      return list.slice(0, 5);
    },
    [upcomingJobsBase, scopedEngineerJobIds]
  );
  const followUps = useMemo(
    () => scopedEngineerJobIds ? followUpsBase.filter((job) => scopedEngineerJobIds.has(job.id)) : followUpsBase,
    [followUpsBase, scopedEngineerJobIds]
  );
  const inProgressJobs = useMemo(() => {
    const merged = [...todaysJobs, ...upcomingJobs, ...followUps];
    const seen = new Set<string>();
    const list: DashboardJob[] = [];
    for (const job of merged) {
      if (job.status !== "in_progress") continue;
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      list.push(job);
    }
    return list;
  }, [todaysJobs, upcomingJobs, followUps]);

  const scopedTeamJobs = useMemo(
    () => engineerFilter === "all"
      ? activeTeamJobs
      : activeTeamJobs.filter((job) => (job.assigned_technician_id || null) === engineerFilter),
    [activeTeamJobs, engineerFilter]
  );

  const teamTodayCount = useMemo(
    () => scopedTeamJobs.filter((job) => job.scheduled_date === todayIso).length,
    [scopedTeamJobs, todayIso]
  );
  const teamInProgressCount = useMemo(
    () => scopedTeamJobs.filter((job) => job.status === "in_progress").length,
    [scopedTeamJobs]
  );
  const teamRiskCount = useMemo(
    () => scopedTeamJobs.filter((job) => job.status === "requires_follow_up" || job.status === "awaiting_parts").length,
    [scopedTeamJobs]
  );
  const unassignedQueueCount = useMemo(
    () => activeTeamJobs.filter((job) => !job.assigned_technician_id).length,
    [activeTeamJobs]
  );

  const engineerWorkload = useMemo(
    () => engineerProfiles.map((engineer) => {
      const all = activeTeamJobs.filter((job) => job.assigned_technician_id === engineer.id);
      const today = all.filter((job) => job.scheduled_date === todayIso).length;
      const risk = all.filter((job) => job.status === "requires_follow_up" || job.status === "awaiting_parts").length;
      return {
        id: engineer.id,
        name: engineer.full_name,
        today,
        weekTotal: all.length,
        risk,
      };
    }),
    [engineerProfiles, activeTeamJobs, todayIso]
  );

  const overdueFollowUpsCount = initData?.overdueFollowUpsCount ?? 0;

  useEffect(() => {
    const userId = profile?.id;
    if (!userId || typeof window === "undefined") return;

    const state = readEssentialSetupState(userId);
    setEssentialSetupState(state);

    if (state.completed || state.dismissed || state.shownCount >= ESSENTIAL_SETUP_PROMPT_MAX_SHOWS) {
      return;
    }

    const seenThisSessionKey = `${getEssentialSetupStorageKey(userId)}:session-seen`;
    if (window.sessionStorage.getItem(seenThisSessionKey) === "1") {
      return;
    }

    window.sessionStorage.setItem(seenThisSessionKey, "1");
    const next = { ...state, shownCount: state.shownCount + 1 };
    writeEssentialSetupState(userId, next);
    setEssentialSetupState(next);
    setShowEssentialSetupPrompt(true);
  }, [profile?.id]);

  const updateEssentialSetupState = useCallback((update: Partial<EssentialSetupState>) => {
    const userId = profile?.id;
    if (!userId) return;
    setEssentialSetupState((prev) => {
      const next = { ...prev, ...update };
      writeEssentialSetupState(userId, next);
      return next;
    });
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !hasJobManagement || !canCreateJobs) return;
    let cancelled = false;

    const checkServices = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setHasServices(list.some((s) => s && s.is_active !== false));
        }
      } catch {
        if (!cancelled) setHasServices(false);
      }
    };

    checkServices();
    return () => { cancelled = true; };
  }, [profile?.id, hasJobManagement, canCreateJobs]);

  const setupChecks: EssentialSetupChecks = {
    hasServices,
    hasCustomers,
    hasActiveUser,
  };
  const completedChecks = Object.values(setupChecks).filter(Boolean).length;
  const totalChecks = Object.keys(setupChecks).length;
  const checksComplete = completedChecks === totalChecks;

  useEffect(() => {
    if (!hasJobManagement || !checksComplete) return;
    if (essentialSetupState.completed) return;
    updateEssentialSetupState({ completed: true, dismissed: false });
    setShowEssentialSetupPrompt(false);
  }, [hasJobManagement, checksComplete, essentialSetupState.completed, updateEssentialSetupState]);

  const showEssentialSetupCard = !essentialSetupState.completed
    && !showEssentialSetupPrompt
    && (essentialSetupState.dismissed || essentialSetupState.shownCount >= ESSENTIAL_SETUP_PROMPT_MAX_SHOWS);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AddToHomeScreen />

      {showEssentialSetupCard && (
        <Card className="p-4 border-emerald-200 bg-emerald-50/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Complete your essential setup</p>
              <p className="text-xs text-emerald-800 mt-1">Set up company profile, services and team assignment so job-sheet options are ready when booking jobs.</p>
              <p className="text-[11px] text-emerald-700 mt-1">Progress: {completedChecks}/{totalChecks} complete</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate("/getting-started")}>Open setup</Button>
            </div>
          </div>
        </Card>
      )}

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Today's Jobs</p>
            <p className="text-2xl font-bold mt-1">{homepageLoading ? "—" : (stats?.total_jobs_today ?? 0)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed This Week</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{homepageLoading ? "—" : (stats?.completed_this_week ?? 0)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overdue Services</p>
            <p className={`text-2xl font-bold mt-1 ${(stats?.overdue_count ?? 0) > 0 ? "text-rose-600" : ""}`}>
              {homepageLoading ? "—" : (stats?.overdue_count ?? 0)}
            </p>
          </Card>
          {canCreateInvoices && (
            <Link href="/invoices?unpaid=1">
              <Card className="p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unpaid Invoices</p>
                <p className={`text-2xl font-bold mt-1 ${(stats?.unpaid_invoices_count ?? 0) > 0 ? "text-amber-600" : ""}`}>
                  {homepageLoading ? "—" : (stats?.unpaid_invoices_count ?? 0)}
                </p>
              </Card>
            </Link>
          )}
        </div>
      )}

      {hasJobManagement && multiEngineerMode && (
        <div className="-mt-3 flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Current scope: {selectedEngineerName}</p>
          {engineerFilter !== "all" && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEngineerFilter("all")}>
              Reset to All Engineers
            </Button>
          )}
        </div>
      )}

      {hasJobManagement && multiEngineerMode && (
        <Card className="p-4 border border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Team Scheduling Snapshot</h2>
              <p className="text-xs text-muted-foreground">View all engineers or focus one engineer across today and the next 7 days.</p>
            </div>
            <Link href="/schedule" className="text-sm text-primary hover:underline">Open full schedule</Link>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <Button
              size="sm"
              variant={engineerFilter === "all" ? "default" : "outline"}
              onClick={() => setEngineerFilter("all")}
            >
              All Engineers
            </Button>
            {engineerProfiles.map((engineer) => (
              <Button
                key={engineer.id}
                size="sm"
                variant={engineerFilter === engineer.id ? "default" : "outline"}
                onClick={() => setEngineerFilter(engineer.id)}
              >
                {engineer.full_name}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Today</p>
              <p className="text-xl font-bold mt-1">{teamTodayCount}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">In Progress</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{teamInProgressCount}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Follow-Up Risk</p>
              <p className="text-xl font-bold text-orange-700 mt-1">{teamRiskCount}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Unassigned Queue</p>
              <p className="text-xl font-bold text-rose-700 mt-1">{unassignedQueueCount}</p>
            </Card>
          </div>

          <div className="space-y-2">
            {engineerWorkload.map((engineer) => (
              <div key={engineer.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${engineerFilter === engineer.id ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{engineer.name}</p>
                  <p className="text-xs text-muted-foreground">Today: {engineer.today} • 7 days: {engineer.weekTotal}</p>
                </div>
                <div className="text-xs font-medium text-orange-700">Risk: {engineer.risk}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Follow-Ups */}
      {hasJobManagement && followUps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                Follow-Ups
                <span className="text-sm font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{followUps.length}</span>
              </h2>
              {multiEngineerMode && <p className="text-xs text-muted-foreground mt-0.5">Showing: {selectedEngineerName}</p>}
            </div>
            <Link href="/follow-ups" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {followUps.map(job => {
              const dateStr = job.scheduled_date
                ? new Date(job.scheduled_date as string).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
                : null;
              const sc = STATUS_CONFIG[job.status] ?? { label: job.status, className: "bg-slate-100 text-slate-600" };
              return (
                <Link key={job.id} href="/follow-ups">
                  <Card className="p-4 border border-orange-200 bg-orange-50/40 hover:border-orange-400 hover:shadow-sm transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-orange-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{job.customer_name ?? "Unknown Customer"}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${sc.className}`}>{sc.label}</span>
                          {dateStr && <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>}
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
        </div>
      )}

      {/* In Progress */}
      {hasJobManagement && inProgressJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-700" />
                In Progress
                <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{inProgressJobs.length}</span>
              </h2>
              {multiEngineerMode && <p className="text-xs text-muted-foreground mt-0.5">Showing: {selectedEngineerName}</p>}
            </div>
            <Link href="/jobs?status=in_progress" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {inProgressJobs.map(job => {
              const dateStr = job.scheduled_date
                ? new Date(job.scheduled_date as string).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
                : null;
              return (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <Card className="p-4 border border-blue-200 bg-blue-50/40 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-blue-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{job.customer_name ?? "Unknown Customer"}</span>
                          {dateStr && <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>}
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
        </div>
      )}

      {/* Today's jobs */}
      {hasJobManagement && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Today's Jobs</h2>
              {multiEngineerMode && <p className="text-xs text-muted-foreground mt-0.5">Showing: {selectedEngineerName}</p>}
            </div>
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
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Upcoming</h2>
            {multiEngineerMode && <p className="text-xs text-muted-foreground mt-0.5">Showing: {selectedEngineerName}</p>}
          </div>
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

      <Dialog open={showEssentialSetupPrompt} onOpenChange={setShowEssentialSetupPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Essential Setup</DialogTitle>
            <DialogDescription>
              Follow the setup guide to configure services, team assignment and job-sheet options before your first live job.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Add at least one service to catalogue {setupChecks.hasServices ? "(done)" : ""}</p>
            <p>• Add at least one customer {setupChecks.hasCustomers ? "(done)" : ""}</p>
            <p>• Keep an active team user seat {setupChecks.hasActiveUser ? "(done)" : ""}</p>
            <p className="text-xs">Progress: {completedChecks}/{totalChecks} complete</p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                updateEssentialSetupState({ dismissed: true });
                setShowEssentialSetupPrompt(false);
              }}
            >
              Don&apos;t show again
            </Button>
            <Button variant="outline" onClick={() => setShowEssentialSetupPrompt(false)}>Remind me later</Button>
            <Button
              onClick={() => {
                setShowEssentialSetupPrompt(false);
                navigate("/getting-started");
              }}
            >
              Open setup guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
