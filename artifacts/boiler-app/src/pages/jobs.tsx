import { useListJobs, useCreateJob, useCreateCustomer, useListProfiles, useListCustomers, useListProperties } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Briefcase, Calendar, MapPin, User, Plus, Filter, X, Download, FileText, Map, List, UserPlus, Mail, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, Receipt } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, lazy, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { useIsSoleTrader } from "@/hooks/use-sole-trader";

const JobMapView = lazy(() => import("@/components/job-map-view"));

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
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("list");
  const [currentPage, setCurrentPage] = useState(1);
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasFeature } = usePlanFeatures();

  const isAdminOrOffice = profile?.role === "admin" || profile?.role === "office_staff";

  const { data: jobsResponse, isLoading } = useListJobs({
    status: statusFilter || undefined,
    page: currentPage,
    limit: 50,
  });
  const jobs = jobsResponse?.jobs;
  const pagination = jobsResponse?.pagination;

  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch("/api/job-types");
      if (!res.ok) return [];
      return res.json();
    },
  });

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
      case 'invoiced': return 'bg-violet-100 text-violet-700';
      case 'cancelled': return 'bg-slate-200 text-slate-600';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const statuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'requires_follow_up', 'invoiced'];

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
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Job</>}
          </Button>
        </div>
      </div>

      {showForm && <AddJobForm onClose={() => setShowForm(false)} jobTypes={jobTypes} />}

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

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !filteredJobs?.length ? (
        <Card className="p-8 text-center border-dashed">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground">No jobs found matching your filters.</p>
        </Card>
      ) : (
        <JobSections
          jobs={filteredJobs}
          getStatusColor={getStatusColor}
          isAdminOrOffice={isAdminOrOffice}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          statusFilter={statusFilter}
        />
      )}

      {pagination && pagination.totalPages > 1 && (
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
}: {
  job: Record<string, any>;
  getStatusColor: (s: string) => string;
  isAdminOrOffice: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
}) {
  const isExportable = job.status === "completed" || job.status === "invoiced";
  const isSelected = selectedIds.has(job.id);
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
      <Link href={`/jobs/${job.id}`} className="flex-1">
        <Card className={`p-4 sm:p-5 border border-border/50 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4 ${isSelected ? "ring-2 ring-emerald-300 border-emerald-300" : ""}`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getStatusColor(job.status)}`}>
                {job.status.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-semibold capitalize text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md">
                {job.job_type_name ?? job.job_type.replace(/_/g, ' ')}
              </span>
            </div>
            <h3 className="font-bold text-lg mb-1">{job.customer_name}</h3>
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
  );
}

function JobSections({
  jobs,
  getStatusColor,
  isAdminOrOffice,
  selectedIds,
  toggleSelect,
  statusFilter,
}: {
  jobs: Record<string, any>[];
  getStatusColor: (s: string) => string;
  isAdminOrOffice: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  statusFilter: string;
}) {
  const [showCompleted, setShowCompleted] = useState(statusFilter === "completed");
  const [showInvoiced, setShowInvoiced] = useState(statusFilter === "invoiced");
  const [showCancelled, setShowCancelled] = useState(statusFilter === "cancelled");

  const active = jobs.filter((j) => {
    const s = j.status as string;
    return s === "scheduled" || s === "in_progress" || s === "requires_follow_up";
  });
  const completed = jobs.filter((j) => j.status === "completed");
  const invoiced = jobs.filter((j) => j.status === "invoiced");
  const cancelled = jobs.filter((j) => j.status === "cancelled");

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

function AddJobForm({ onClose, jobTypes }: { onClose: () => void; jobTypes: JobType[] }) {
  const qc = useQueryClient();
  const createJob = useCreateJob();
  const createCustomer = useCreateCustomer();
  const { data: customers } = useListCustomers();
  const { data: properties } = useListProperties();
  const { data: technicians } = useListProfiles();
  const { register, handleSubmit, watch, setValue } = useForm<JobFormData>();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { isSoleTrader } = useIsSoleTrader();
  const selectedCustomerId = watch("customer_id");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustFirst, setNewCustFirst] = useState("");
  const [newCustLast, setNewCustLast] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [prevCustomerId, setPrevCustomerId] = useState("");
  const [emailPrompt, setEmailPrompt] = useState<{ jobId: string; customerName: string; customerEmail: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const filteredProperties = properties?.filter(p => !selectedCustomerId || p.customer_id === selectedCustomerId);

  if (selectedCustomerId !== prevCustomerId) {
    setPrevCustomerId(selectedCustomerId);
    if (prevCustomerId) {
      setValue("property_id", "");
    }
  }

  const handleCreateCustomer = async () => {
    if (!newCustFirst || !newCustLast) {
      toast({ title: "Error", description: "First and last name are required", variant: "destructive" });
      return;
    }
    setCreatingCustomer(true);
    try {
      const newCustomer = await createCustomer.mutateAsync({
        data: {
          first_name: newCustFirst,
          last_name: newCustLast,
          email: newCustEmail || undefined,
          phone: newCustPhone || undefined,
        } as { first_name: string; last_name: string },
      });
      await qc.refetchQueries({ queryKey: ["/api/customers"] });
      setTimeout(() => setValue("customer_id", newCustomer.id), 50);
      setShowNewCustomer(false);
      setNewCustFirst("");
      setNewCustLast("");
      setNewCustEmail("");
      setNewCustPhone("");
      toast({ title: "Customer created", description: `${newCustFirst} ${newCustLast} added` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create customer";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleSendConfirmation = async (jobId: string) => {
    setSendingEmail(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/send-confirmation`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send email");
      }
      toast({ title: "Confirmation email sent", description: `Email sent to ${emailPrompt?.customerEmail}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      toast({ title: "Email failed", description: message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
      setEmailPrompt(null);
      onClose();
    }
  };

  const onSubmit = async (data: JobFormData) => {
    const selectedType = jobTypes.find((t) => t.id === parseInt(data.job_type_id, 10));
    const jobTypeCategory = (selectedType?.category ?? "service") as "service" | "breakdown" | "installation" | "inspection" | "follow_up";

    try {
      const technicianId = isSoleTrader && profile?.id ? profile.id : (data.assigned_technician_id || undefined);
      const newJob = await createJob.mutateAsync({
        data: {
          customer_id: data.customer_id,
          property_id: data.property_id,
          job_type: jobTypeCategory,
          job_type_id: selectedType ? selectedType.id : undefined,
          priority: data.priority as "low" | "medium" | "high" | "urgent",
          scheduled_date: data.scheduled_date,
          scheduled_end_date: data.scheduled_end_date || undefined,
          scheduled_time: data.scheduled_time || undefined,
          description: data.description || undefined,
          assigned_technician_id: technicianId,
        }
      });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job created successfully" });

      const selectedCustomer = customers?.find(c => c.id === data.customer_id);
      if (selectedCustomer?.email) {
        setEmailPrompt({
          jobId: newJob.id,
          customerName: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`,
          customerEmail: selectedCustomer.email,
        });
      } else {
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create job. Please try again.";
      toast({ title: "Failed to create job", description: message, variant: "destructive" });
    }
  };

  if (emailPrompt) {
    return (
      <Card className="p-6 border-primary/20 shadow-lg bg-primary/5">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Send Confirmation Email?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Send an appointment confirmation to <strong>{emailPrompt.customerName}</strong> at{" "}
              <span className="text-primary">{emailPrompt.customerEmail}</span>
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => handleSendConfirmation(emailPrompt.jobId)}
              disabled={sendingEmail}
            >
              {sendingEmail ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Mail className="w-4 h-4 mr-2" /> Send Email</>}
            </Button>
            <Button variant="outline" onClick={() => { setEmailPrompt(null); onClose(); }} disabled={sendingEmail}>
              Skip
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-primary/20 shadow-lg bg-primary/5">
      <h3 className="font-bold text-lg mb-4">Schedule New Job</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex gap-2 items-end">
            <CustomerAutocomplete
              customers={customers || []}
              selectedId={selectedCustomerId}
              onSelect={(id) => { setValue("customer_id", id); }}
              className="flex-1 space-y-1"
            />
            <Button type="button" variant="outline" size="icon" className="shrink-0 mb-0.5" title="Add new customer" onClick={() => setShowNewCustomer(!showNewCustomer)}>
              {showNewCustomer ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        {showNewCustomer && (
          <div className="md:col-span-2 border border-primary/20 rounded-lg p-4 bg-background space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Quick Add Customer</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="First Name *" value={newCustFirst} onChange={e => setNewCustFirst(e.target.value)} />
              <Input placeholder="Last Name *" value={newCustLast} onChange={e => setNewCustLast(e.target.value)} />
              <Input placeholder="Email" type="email" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} />
              <Input placeholder="Phone" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleCreateCustomer} disabled={creatingCustomer || !newCustFirst || !newCustLast}>
                {creatingCustomer ? "Creating..." : "Create Customer"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewCustomer(false)}>Cancel</Button>
            </div>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Property *</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required {...register("property_id")}>
            <option value="">Select property...</option>
            {filteredProperties?.map(p => (
              <option key={p.id} value={p.id}>{p.address_line1}, {p.postcode}</option>
            ))}
          </select>
          {selectedCustomerId && filteredProperties?.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No properties found for this customer.{" "}
              <Link href={`/customers/${selectedCustomerId}?addProperty=1`} className="underline font-medium">Add a property first</Link>
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Job Type *</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required {...register("job_type_id")}>
            <option value="">Select job type...</option>
            {jobTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Priority</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("priority")}>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Start Date *</label>
          <Input type="date" required {...register("scheduled_date")} />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">End Date <span className="text-xs text-muted-foreground">(multi-day jobs only)</span></label>
          <Input type="date" {...register("scheduled_end_date")} />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Scheduled Time</label>
          <Input type="time" {...register("scheduled_time")} />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Assign Technician</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("assigned_technician_id")}>
            <option value="">Unassigned</option>
            {technicians?.filter(t => (t as unknown as { can_be_assigned_jobs?: boolean }).can_be_assigned_jobs === true || t.role === 'technician').map(t => (
              <option key={t.id} value={t.id}>{t.full_name}{t.role === 'admin' ? ' (Admin)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Description</label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("description")} />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <Button type="submit" disabled={createJob.isPending}>
            {createJob.isPending ? "Creating..." : "Create Job"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
