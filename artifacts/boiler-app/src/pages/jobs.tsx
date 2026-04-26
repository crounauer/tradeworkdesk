import { useListJobs, useCreateJob, useCreateCustomer, useCreateProperty, useListProfiles, useListCustomers, useListProperties, useUpdateJob, getListCustomersQueryKey, getListPropertiesQueryKey, getListProfilesQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { Briefcase, Calendar, MapPin, User, Plus, Filter, X, Download, FileText, Map, List, UserPlus, Mail, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, Receipt, CloudOff, WifiOff, Home, Check, CalendarCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { useIsSoleTrader } from "@/hooks/use-sole-trader";
import { useOffline } from "@/contexts/offline-context";
import { getCachedCustomers, getCachedProperties, getCachedJobTypes, getCachedTechnicians, useCacheJobTypes } from "@/hooks/use-offline-data";
import { PendingSyncBadge, OfflineMutationsList } from "@/components/offline-indicator";
import { cacheJob, getAllCachedJobs, type CachedJob } from "@/lib/offline-db";
import { BookJobDialog } from "@/components/book-job-dialog";

const JobMapView = lazy(() => import("@/components/job-map-view"));
const PostcodeAddressFinder = lazy(() => import("@/components/postcode-address-finder").then(m => ({ default: m.PostcodeAddressFinder })));

interface JobType {
  id: number;
  name: string;
  slug: string;
  category: string;
  color: string;
  default_duration_minutes: number | null;
  is_active: boolean;
}

type JobFormData = {
  customer_id: string;
  property_id: string;
  job_type_id: string;
  fuel_category: string;
  priority: string;
  scheduled_date: string;
  scheduled_end_date?: string;
  scheduled_time?: string;
  description?: string;
  assigned_technician_id?: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Jobs() {
  const { hasFeature } = usePlanFeatures();
  if (!hasFeature("job_management")) {
    return <UpgradePrompt feature="job_management" />;
  }
  return <JobsContent />;
}

type ViewTab = "list" | "map";

function JobsContent() {
  const [statusFilter, setStatusFilter] = useState("");
  const [jobTypeIdFilter, setJobTypeIdFilter] = useState("");
  const [showBookJob, setShowBookJob] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("list");
  const [currentPage, setCurrentPage] = useState(1);
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasFeature } = usePlanFeatures();

  const isAdminOrOffice = profile?.role === "admin" || profile?.role === "office_staff";

  const { data: jobsResponse, isLoading: onlineLoading } = useListJobs({
    status: statusFilter || undefined,
    page: currentPage,
    limit: 50,
  }, {
    query: { staleTime: 30_000 },  // server cache is 30s; avoid redundant refetches on tab-switch
  });
  const onlineJobs = jobsResponse?.jobs;
  const pagination = jobsResponse?.pagination;

  const { isOnline, pendingMutations, failedMutations } = useOffline();

  const [cachedJobsList, setCachedJobsList] = useState<Record<string, unknown>[] | null>(null);
  const [cachedLoading, setCachedLoading] = useState(!isOnline);

  useEffect(() => {
    if (onlineJobs && onlineJobs.length > 0) {
      for (const j of onlineJobs) {
        cacheJob(j.id, j as unknown as Record<string, unknown>);
      }
    }
  }, [onlineJobs]);

  useEffect(() => {
    if (!isOnline) {
      setCachedLoading(true);
      getAllCachedJobs().then((cached: CachedJob[]) => {
        let list = cached.map((c) => c.data);
        if (statusFilter) {
          list = list.filter((j) => j.status === statusFilter);
        }
        list.sort((a, b) => {
          const da = a.scheduled_date ? new Date(a.scheduled_date as string).getTime() : 0;
          const db = b.scheduled_date ? new Date(b.scheduled_date as string).getTime() : 0;
          return db - da;
        });
        setCachedJobsList(list);
        setCachedLoading(false);
      });
    } else {
      setCachedJobsList(null);
      setCachedLoading(false);
    }
  }, [isOnline, statusFilter]);

  const jobs = isOnline ? onlineJobs : cachedJobsList;
  const isLoading = isOnline ? onlineLoading : cachedLoading;

  const pendingJobIds = new Set<string>();
  [...pendingMutations, ...failedMutations].forEach((m) => {
    if (m.type === "update-job" || m.type === "create-job-note" || m.type === "create-time-entry" || m.type === "create-job-part") {
      const jobId = m.payload.jobId as string | undefined;
      if (jobId) pendingJobIds.add(jobId);
    }
  });

  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch("/api/job-types");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOnline,
  });

  useCacheJobTypes(jobTypes.length > 0 ? jobTypes : undefined);

  const filteredJobs = jobTypeIdFilter
    ? jobs?.filter((j) => {
        const selectedType = jobTypes.find((t) => t.id === parseInt(jobTypeIdFilter, 10));
        if (!selectedType) return true;
        if (j.job_type_name) return j.job_type_name === selectedType.name;
        return j.job_type === selectedType.category;
      })
    : jobs;

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-amber-100 text-amber-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'requires_follow_up': return 'bg-rose-100 text-rose-700';
      case 'awaiting_parts': return 'bg-orange-100 text-orange-700';
      case 'invoiced': return 'bg-violet-100 text-violet-700';
      case 'cancelled': return 'bg-slate-200 text-slate-600';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const statuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'requires_follow_up', 'awaiting_parts', 'invoiced'];

  const exportableJobs = filteredJobs?.filter((j) => j.status === "completed" || j.status === "invoiced") || [];
  const selectedExportable = [...selectedIds].filter((id) => exportableJobs.some((j) => j.id === id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedExportable.length === exportableJobs.length && exportableJobs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exportableJobs.map((j) => j.id)));
    }
  };

  const handleBulkExport = async (format: string) => {
    if (selectedExportable.length === 0) return;
    setBulkExporting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/bulk-invoice-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ job_ids: selectedExportable, format }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `bulk-invoices.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `${selectedExportable.length} invoice(s) exported` });
      setShowBulkExport(false);
      setSelectedIds(new Set());
    } catch {
      toast({ title: "Error", description: "Bulk export failed", variant: "destructive" });
    } finally {
      setBulkExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Jobs</h1>
          <PendingSyncBadge />
          <p className="text-muted-foreground mt-1">Manage all service visits</p>
        </div>
        <div className="flex gap-2">
          {hasFeature("geo_mapping") && (
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewTab("list")}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${viewTab === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewTab("map")}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${viewTab === "map" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Map className="w-3.5 h-3.5" />
                Map
              </button>
            </div>
          )}
          {!hasFeature("geo_mapping") && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setViewTab("map")}>
              <Map className="w-4 h-4 mr-2" /> Map
            </Button>
          )}
          {isAdminOrOffice && selectedExportable.length > 0 && (
            <Button variant="outline" className="text-emerald-600 border-emerald-200" onClick={() => setShowBulkExport(!showBulkExport)}>
              <Download className="w-4 h-4 mr-2" /> Export {selectedExportable.length} Invoice{selectedExportable.length !== 1 ? "s" : ""}
            </Button>
          )}
          <Button onClick={() => setShowBookJob(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Job
          </Button>
        </div>
      </div>

      <BookJobDialog open={showBookJob} onOpenChange={setShowBookJob} />

      <OfflineMutationsList />

      {viewTab === "map" && !hasFeature("geo_mapping") && (
        <UpgradePrompt feature="geo_mapping" />
      )}

      {viewTab === "map" && hasFeature("geo_mapping") && (
        <Suspense fallback={<div className="h-[500px] bg-slate-100 rounded-xl animate-pulse flex items-center justify-center text-muted-foreground">Loading map...</div>}>
          <JobMapView />
        </Suspense>
      )}

      {viewTab === "list" && <>
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="">All Statuses</option>
          {statuses.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
          value={jobTypeIdFilter}
          onChange={(e) => { setJobTypeIdFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="">All Job Types</option>
          {jobTypes.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {(statusFilter || jobTypeIdFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setJobTypeIdFilter(""); setCurrentPage(1); }}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
        {pagination && (
          <span className="text-xs text-muted-foreground ml-auto">
            {jobTypeIdFilter
              ? `${filteredJobs?.length ?? 0} of ${pagination.total} shown`
              : `${pagination.total} job${pagination.total !== 1 ? "s" : ""} total`}
          </span>
        )}
        {isAdminOrOffice && exportableJobs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="ml-auto text-xs">
            {selectedExportable.length === exportableJobs.length ? "Deselect All" : `Select All (${exportableJobs.length})`}
          </Button>
        )}
      </div>

      {showBulkExport && (
        <Card className="p-4 border-emerald-200 bg-emerald-50/50">
          <p className="text-sm font-medium mb-3">Choose export format for {selectedExportable.length} job(s):</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "csv", label: "Universal CSV" },
              { key: "quickbooks", label: "QuickBooks (IIF)" },
              { key: "xero", label: "Xero CSV" },
              { key: "sage", label: "Sage CSV" },
            ].map((f) => (
              <Button key={f.key} size="sm" variant="outline" disabled={bulkExporting} onClick={() => handleBulkExport(f.key)}>
                <FileText className="w-4 h-4 mr-1" /> {f.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setShowBulkExport(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {!isOnline && !isLoading && jobs && jobs.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          Showing cached jobs. Changes will sync when you're back online.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !filteredJobs?.length ? (
        <Card className="p-8 text-center border-dashed">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground">{!isOnline ? "No cached jobs available. Jobs will appear after viewing them online." : "No jobs found matching your filters."}</p>
        </Card>
      ) : (
        <JobSections
          jobs={filteredJobs}
          getStatusColor={getStatusColor}
          isAdminOrOffice={isAdminOrOffice}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          statusFilter={statusFilter}
          pendingJobIds={pendingJobIds}
        />
      )}

      {isOnline && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
      </>}
    </div>
  );
}

function JobCard({
  job,
  getStatusColor,
  isAdminOrOffice,
  selectedIds,
  toggleSelect,
  hasPending,
}: {
  job: Record<string, any>;
  getStatusColor: (s: string) => string;
  isAdminOrOffice: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  hasPending?: boolean;
}) {
  const isExportable = job.status === "completed" || job.status === "invoiced";
  const isSelected = selectedIds.has(job.id);
  const updateJob = useUpdateJob();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Swipe gesture state
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const cardRef = useRef<HTMLAnchorElement>(null);

  const canSwipeComplete = job.status === "scheduled" || job.status === "in_progress" || job.status === "requires_follow_up" || job.status === "awaiting_parts";

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    swipedRef.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      e.preventDefault();
      setIsSwiping(true);
      const clamped = Math.max(-100, Math.min(100, dx));
      setSwipeX(clamped);
      if (Math.abs(dx) > 50) swipedRef.current = true;
    }
  };

  const onPointerUp = async () => {
    const sx = swipeX;
    startXRef.current = null;
    startYRef.current = null;
    setSwipeX(0);
    setIsSwiping(false);

    if (sx < -70 && canSwipeComplete) {
      // Swipe left = complete
      try {
        await updateJob.mutateAsync({ id: job.id, data: { status: "completed" } });
        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
        toast({ title: "Job completed", description: `${job.customer_name} — marked as complete.` });
      } catch {
        toast({ title: "Error", description: "Failed to complete job", variant: "destructive" });
      }
    } else if (sx > 70) {
      // Swipe right = navigate to job to reschedule
      navigate(`/jobs/${job.id}`);
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (swipedRef.current) e.preventDefault();
  };

  return (
    <div className="flex items-stretch gap-2">
      {isAdminOrOffice && isExportable && (
        <div className="flex items-center px-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(job.id)}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
        </div>
      )}
      {isAdminOrOffice && !isExportable && <div className="w-[28px]" />}
      <div className="flex-1 relative overflow-hidden rounded-lg">
        {/* Swipe action hints */}
        {isSwiping && swipeX < -20 && canSwipeComplete && (
          <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-emerald-500 rounded-lg">
            <Check className="w-5 h-5 text-white mr-1" />
            <span className="text-white text-sm font-medium">Complete</span>
          </div>
        )}
        {isSwiping && swipeX > 20 && (
          <div className="absolute inset-y-0 left-0 flex items-center justify-start pl-4 bg-blue-500 rounded-lg">
            <CalendarCheck className="w-5 h-5 text-white mr-1" />
            <span className="text-white text-sm font-medium">View</span>
          </div>
        )}
        <Link
          ref={cardRef}
          href={`/jobs/${job.id}`}
          className="block"
          onClick={handleLinkClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { startXRef.current = null; setSwipeX(0); setIsSwiping(false); }}
          style={{ transform: isSwiping ? `translateX(${swipeX}px)` : undefined, transition: isSwiping ? "none" : "transform 0.2s ease" }}
        >
        <Card className={`p-4 sm:p-5 border border-border/50 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4 ${isSelected ? "ring-2 ring-emerald-300 border-emerald-300" : ""}`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getStatusColor(job.status)}`}>
                {job.status.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-semibold capitalize text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md">
                {job.job_type_name ?? job.job_type.replace(/_/g, ' ')}
              </span>
              {hasPending && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  <CloudOff className="w-3 h-3" /> Pending sync
                </span>
              )}
            </div>
            <h3 className="font-bold text-lg mb-1">
              {job.job_ref && <span className="text-muted-foreground font-mono text-sm mr-2">{job.job_ref}</span>}
              {job.customer_name}
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.property_address}</span>
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 sm:border-l border-border/50 sm:pl-5">
            <div className="flex items-center gap-1.5 text-foreground font-medium bg-slate-50 px-3 py-1.5 rounded-lg w-full sm:w-auto justify-center">
              <Calendar className="w-4 h-4 text-primary" />
              {(() => {
                const startStr = String(job.scheduled_date).slice(0, 10);
                const endStr = job.scheduled_end_date ? String(job.scheduled_end_date).slice(0, 10) : null;
                if (endStr && endStr !== startStr) {
                  return `${formatDate(startStr)} – ${formatDate(endStr)}`;
                }
                return job.scheduled_time
                  ? formatDateTime(`${startStr}T${job.scheduled_time}`)
                  : formatDate(startStr);
              })()}
            </div>
            {job.technician_name && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-4 h-4" /> {job.technician_name}
              </div>
            )}
          </div>
        </Card>
        </Link>
      </div>
    </div>
  );
}

function JobSections({
  jobs,
  getStatusColor,
  isAdminOrOffice,
  selectedIds,
  toggleSelect,
  statusFilter,
  pendingJobIds,
}: {
  jobs: Record<string, any>[];
  getStatusColor: (s: string) => string;
  isAdminOrOffice: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  statusFilter: string;
  pendingJobIds?: Set<string>;
}) {
  const [showCompleted, setShowCompleted] = useState(statusFilter === "completed");
  const [showInvoiced, setShowInvoiced] = useState(statusFilter === "invoiced");
  const [showCancelled, setShowCancelled] = useState(statusFilter === "cancelled");

  const sortByDate = (a: Record<string, any>, b: Record<string, any>) => {
    const da = a.scheduled_date ? new Date(a.scheduled_date + "T" + (a.scheduled_time || "00:00")).getTime() : 0;
    const db = b.scheduled_date ? new Date(b.scheduled_date + "T" + (b.scheduled_time || "00:00")).getTime() : 0;
    return da - db;
  };
  const active = jobs.filter((j) => {
    const s = j.status as string;
    return s === "scheduled" || s === "in_progress" || s === "requires_follow_up" || s === "awaiting_parts";
  }).sort(sortByDate);
  const completed = jobs.filter((j) => j.status === "completed").sort(sortByDate);
  const invoiced = jobs.filter((j) => j.status === "invoiced").sort(sortByDate);
  const cancelled = jobs.filter((j) => j.status === "cancelled").sort(sortByDate);

  const renderCards = (items: Record<string, any>[]) => (
    <div className="space-y-3">
      {items.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          getStatusColor={getStatusColor}
          isAdminOrOffice={isAdminOrOffice}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          hasPending={pendingJobIds?.has(job.id)}
        />
      ))}
    </div>
  );

  if (!!statusFilter) {
    return renderCards(jobs);
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-lg text-foreground">Active Jobs</h2>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{active.length}</span>
          </div>
          {renderCards(active)}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <button
            className="w-full flex items-center gap-2 mb-3 group"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-lg text-emerald-700">Completed</h2>
            <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{completed.length}</span>
            <div className="flex-1 border-t border-border/50" />
            {showCompleted ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showCompleted && renderCards(completed)}
        </div>
      )}

      {invoiced.length > 0 && (
        <div>
          <button
            className="w-full flex items-center gap-2 mb-3 group"
            onClick={() => setShowInvoiced(!showInvoiced)}
          >
            <Receipt className="w-5 h-5 text-violet-600" />
            <h2 className="font-bold text-lg text-violet-700">Invoiced</h2>
            <span className="text-xs font-medium bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{invoiced.length}</span>
            <div className="flex-1 border-t border-border/50" />
            {showInvoiced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showInvoiced && renderCards(invoiced)}
        </div>
      )}

      {cancelled.length > 0 && (
        <div>
          <button
            className="w-full flex items-center gap-2 mb-3 group"
            onClick={() => setShowCancelled(!showCancelled)}
          >
            <XCircle className="w-5 h-5 text-slate-400" />
            <h2 className="font-bold text-lg text-slate-500">Cancelled</h2>
            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{cancelled.length}</span>
            <div className="flex-1 border-t border-border/50" />
            {showCancelled ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showCancelled && renderCards(cancelled)}
        </div>
      )}

      {active.length === 0 && completed.length === 0 && invoiced.length === 0 && cancelled.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground">No jobs found.</p>
        </Card>
      )}
    </div>
  );
}

