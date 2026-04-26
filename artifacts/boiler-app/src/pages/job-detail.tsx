import { useGetJob, useUpdateJob, useDeleteJob, useListFiles, useDeleteFile, useListJobNotes, useCreateJobNote, useListJobTimeEntries, useCreateJobTimeEntry, useDeleteJobTimeEntry, useUpdateJobTimeEntry, useGetJobCompletionReportByJob, type JobDetail as JobDetailType } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Calendar, MapPin, User, FileText, Wrench, Flame, Edit, X, Check,
  ClipboardCheck, Droplets, ShieldAlert, Gauge, Settings, ShieldCheck, Pipette,
  ClipboardList, Wind, Clock, Package, Camera, Upload, Trash2, Plus, Image as ImageIcon, Bookmark,
  MessageSquare, Send, Pencil, PoundSterling, Mail, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, RefreshCw, CalendarPlus, RotateCcw, AlertCircle, ExternalLink, WifiOff, CloudOff,
  Play, Timer, Phone, Smartphone
} from "lucide-react";
import { useOffline } from "@/contexts/offline-context";
import { cacheJob, getCachedJob } from "@/lib/offline-db";
import { formatDateTime, formatDate } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type JobEditData = {
  status: string;
  priority: string;
  scheduled_date: string;
  scheduled_end_date?: string;
  scheduled_time?: string;
  estimated_duration?: string;
  description?: string;
};

type JobLike = {
  id: string;
  status: string;
  priority: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  description?: string | null;
  [k: string]: unknown;
};

interface JobPart {
  id: string;
  job_id: string;
  part_name: string;
  quantity: number;
  serial_number: string | null;
  unit_price: number | null;
  tenant_id: string;
  created_at: string;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { isOnline, queueJobUpdate, pendingMutations, failedMutations } = useOffline();
  const { data: onlineJob, isLoading } = useGetJob(id);
  const { data: completionReport } = useGetJobCompletionReportByJob(id!, { query: { enabled: !!id } });
  const { data: completedForms } = useQuery({
    queryKey: [`/api/jobs/${id}/completed-forms`],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/jobs/${id}/completed-forms`) as Promise<Array<{ form_type: string; form_label: string; form_id: string }>>,
    enabled: !!id,
  });
  const completedFormTypes = new Set(completedForms?.map(f => f.form_type) || []);
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailLogRefresh, setEmailLogRefresh] = useState(0);
  const [pricingRefresh, setPricingRefresh] = useState(0);
  const [showReturnVisit, setShowReturnVisit] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [cachedJob, setCachedJob] = useState<Record<string, unknown> | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  const [startingJob, setStartingJob] = useState(false);
  const [finishingJob, setFinishingJob] = useState(false);
  const [sendingCertificate, setSendingCertificate] = useState(false);

  useEffect(() => {
    if (isOnline && onlineJob && id) {
      cacheJob(id, onlineJob as unknown as Record<string, unknown>);
    }
  }, [isOnline, onlineJob, id]);

  useEffect(() => {
    if (!isOnline && !onlineJob && !isLoading && id) {
      setLoadingCache(true);
      getCachedJob(id).then((cached) => {
        setCachedJob(cached);
        setLoadingCache(false);
      });
    }
  }, [isOnline, onlineJob, isLoading, id]);

  if (isLoading || loadingCache) return <div className="p-8">Loading job details...</div>;

  const effectiveJob = onlineJob || cachedJob;
  const isFromCache = !onlineJob && !!cachedJob;

  if (!effectiveJob) return <div>Job not found{!isOnline ? " — this job hasn't been cached for offline viewing." : ""}</div>;

  const job = effectiveJob as unknown as JobDetailType;

  const jobHasPendingSync = [...pendingMutations, ...failedMutations].some(
    (m) => (m.type === "update-job" || m.type === "create-job-note" || m.type === "create-time-entry" || m.type === "create-job-part") && m.payload.jobId === id
  );

  const customerEmail = (job.customer as Record<string, unknown>)?.email as string || "";

  const handleSendConfirmationDirect = async () => {
    setSendingConfirmation(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${job.id}/send-confirmation`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send confirmation email");
      }
      toast({ title: "Email sent", description: `Appointment confirmation sent to ${customerEmail}` });
      setEmailLogRefresh(k => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      toast({ title: "Email error", description: message, variant: "destructive" });
    } finally {
      setSendingConfirmation(false);
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
    requires_follow_up: "bg-rose-100 text-rose-700",
    awaiting_parts: "bg-orange-100 text-orange-700",
    invoiced: "bg-violet-100 text-violet-700",
  };

  const handleStatusChange = async (newStatus: string, label: string) => {
    try {
      if (!isOnline) {
        await queueJobUpdate(job.id, { status: newStatus });
        toast({ title: "Queued offline", description: `Status change to "${label}" will sync when online.` });
        return;
      }
      await updateJob.mutateAsync({
        id: job.id,
        data: {
          status: newStatus as "scheduled" | "in_progress" | "completed" | "cancelled" | "requires_follow_up" | "awaiting_parts" | "invoiced",
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Status Updated", description: `Job marked as ${label}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleStartJob = async () => {
    const now = new Date().toISOString();
    try {
      if (!isOnline) {
        await queueJobUpdate(job.id, { status: "in_progress", arrival_time: now });
        toast({ title: "Queued offline", description: "Job started — will sync when online." });
        return;
      }
      setStartingJob(true);
      await updateJob.mutateAsync({ id: job.id, data: { status: "in_progress", arrival_time: now } as Parameters<typeof updateJob.mutateAsync>[0]["data"] });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job started", description: "Arrival time recorded." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start job";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setStartingJob(false);
    }
  };

  const handleFinishJob = async () => {
    const now = new Date().toISOString();
    try {
      if (!isOnline) {
        await queueJobUpdate(job.id, { departure_time: now });
        toast({ title: "Queued offline", description: "Departure time recorded — will sync when online." });
        return;
      }
      setFinishingJob(true);
      await updateJob.mutateAsync({ id: job.id, data: { departure_time: now } as Parameters<typeof updateJob.mutateAsync>[0]["data"] });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job finished", description: "Departure time recorded." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to finish job";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setFinishingJob(false);
    }
  };

  const handleEmailCertificate = async () => {
    if (!isOnline) {
      toast({ title: "Offline", description: "Email certificate requires an internet connection.", variant: "destructive" });
      return;
    }
    setSendingCertificate(true);
    try {
      const res = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${job.id}/email-certificate`, { method: "POST" }) as { success: boolean; message: string; forms_sent: string[] };
      toast({ title: "Certificate sent", description: res.message || "Certificate emailed to customer." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send certificate";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSendingCertificate(false);
    }
  };

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isOfficeOrAdmin = isAdmin || profile?.role === "office_staff";
  const canComplete = job.status !== "completed" && job.status !== "invoiced" && job.status !== "cancelled";
  const canInvoice = job.status === "completed";
  const canCreateFollowUp = isOfficeOrAdmin && (job.status === "completed" || job.status === "invoiced" || job.status === "awaiting_parts" || job.status === "requires_follow_up");

  return (
    <div className="space-y-6 animate-in fade-in pb-20 max-w-full min-w-0">
      <Link href="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
      </Link>

      {isFromCache && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Viewing cached data from your last visit. Some details may be outdated. Changes you make will sync when you're back online.</span>
        </div>
      )}

      {jobHasPendingSync && !isFromCache && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800">
          <CloudOff className="w-4 h-4 shrink-0" />
          <span>This job has offline changes waiting to sync.</span>
        </div>
      )}

      <div className="flex flex-col gap-4 min-w-0 max-w-full">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-display font-bold truncate">{job.job_ref ? `Job ${job.job_ref}` : `Job #${job.id.slice(0, 8)}`}</h1>
            <span className={`px-3 py-1 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wider ${statusColors[job.status] || "bg-slate-100 text-slate-700"}`}>
              {job.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-base sm:text-lg text-muted-foreground capitalize">{job.job_type.replace('_', ' ')} - Priority: <span className="capitalize font-medium">{job.priority}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {job.status === "scheduled" && (
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white" onClick={handleStartJob} disabled={startingJob || updateJob.isPending}>
              {startingJob ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Start Job
            </Button>
          )}
          {job.status === "in_progress" && !((job as unknown as Record<string, unknown>).departure_time) && (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleFinishJob} disabled={finishingJob || updateJob.isPending}>
              {finishingJob ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Timer className="w-4 h-4 mr-2" />}
              Finish Job
            </Button>
          )}
          {canComplete && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleStatusChange("completed", "Complete")} disabled={updateJob.isPending}>
              <ClipboardCheck className="w-4 h-4 mr-2" /> Mark Complete
            </Button>
          )}
          {canComplete && job.status !== "awaiting_parts" && (
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleStatusChange("awaiting_parts", "Awaiting Parts")} disabled={updateJob.isPending}>
              <Package className="w-4 h-4 mr-2" /> Awaiting Parts
            </Button>
          )}
          {job.status === "awaiting_parts" && (
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white" onClick={() => handleStatusChange("in_progress", "In Progress")} disabled={updateJob.isPending}>
              <RotateCcw className="w-4 h-4 mr-2" /> Resume Job
            </Button>
          )}
          {(job.status === "requires_follow_up" || job.status === "awaiting_parts") && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowReturnVisit(!showReturnVisit)} disabled={updateJob.isPending}>
              <CalendarPlus className="w-4 h-4 mr-2" /> Schedule Return Visit
            </Button>
          )}
          {job.status === "completed" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={updateJob.isPending}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Reopen Job
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reopen Job {job.job_ref || `#${job.id.slice(0, 8)}`}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move the job back to "In Progress". All time entries, notes, and forms will be preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-amber-600 text-white hover:bg-amber-700"
                    disabled={updateJob.isPending}
                    onClick={() => handleStatusChange("in_progress", "In Progress")}
                  >
                    {updateJob.isPending ? "Reopening..." : "Reopen Job"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canInvoice && isAdmin && (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => handleStatusChange("invoiced", "Invoiced")} disabled={updateJob.isPending}>
              <FileText className="w-4 h-4 mr-2" /> Mark as Invoiced
            </Button>
          )}
          {canCreateFollowUp && (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowFollowUpForm(true)}>
              <ClipboardList className="w-4 h-4 mr-2" /> Create Follow-Up
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)}>
            <Mail className="w-4 h-4 mr-2" /> Email Customer
          </Button>
          {completedForms && completedForms.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleEmailCertificate} disabled={sendingCertificate || !isOnline}>
              {sendingCertificate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Email Certificate
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Edit className="w-4 h-4 mr-2"/> Edit</>}
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Job {job.job_ref || `#${job.id.slice(0, 8)}`}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the job and it will no longer appear in your jobs list. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteJob.isPending}
                    onClick={async () => {
                      try {
                        await deleteJob.mutateAsync({ id: job.id });
                        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
                        qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
                        toast({ title: "Job deleted", description: "The job has been removed." });
                        navigate("/jobs");
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : "Failed to delete job";
                        toast({ title: "Delete failed", description: msg, variant: "destructive" });
                      }
                    }}
                  >
                    {deleteJob.isPending ? "Deleting..." : "Delete Job"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {showReturnVisit && (
        <ReturnVisitForm
          job={job}
          onClose={() => setShowReturnVisit(false)}
          onScheduled={() => {
            setShowReturnVisit(false);
            qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
            qc.invalidateQueries({ queryKey: ["/api/jobs"] });
            qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
            qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/schedule-history`] });
          }}
        />
      )}

      {showFollowUpForm && (
        <CreateFollowUpForm
          jobId={job.id}
          onClose={() => setShowFollowUpForm(false)}
          onCreated={() => {
            setShowFollowUpForm(false);
            setCreatingFollowUp(false);
            qc.invalidateQueries({ queryKey: ["follow-ups"] });
            qc.invalidateQueries({ queryKey: ["homepage"] });
            qc.invalidateQueries({ queryKey: ["me-init"] });
            toast({ title: "Follow-up created", description: "The follow-up reminder has been saved." });
          }}
        />
      )}

      {editing ? (
        <EditJobForm job={job as unknown as JobLike} onClose={() => setEditing(false)} onEmailSent={() => setEmailLogRefresh(k => k + 1)} />
      ) : (
        <>
        <Card className="p-4 border border-border/50 shadow-sm bg-slate-50/50 mb-6 lg:hidden">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Link href={`/customers/${job.customer_id}`} className="font-bold text-sm hover:underline truncate">{job.customer?.first_name} {job.customer?.last_name}</Link>
                {job.customer?.phone && <span className="text-xs text-muted-foreground">{job.customer.phone}</span>}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Link href={`/properties/${job.property_id}`} className="text-sm text-muted-foreground hover:underline truncate">
                  {job.property?.address_line1}{job.property?.postcode ? `, ${job.property.postcode}` : ""}
                </Link>
                <a href={job.property?.latitude != null && job.property?.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${job.property.latitude},${job.property.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([job.property?.address_line1, job.property?.postcode].filter(Boolean).join(", "))}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex-shrink-0" title="Open in Maps">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </Card>
        <div className="grid lg:grid-cols-3 gap-6 max-w-full min-w-0">
          <div className="lg:col-span-2 space-y-6 min-w-0">
            <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
              <h3 className="font-bold text-lg mb-4">Job Information</h3>
              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-4 h-4"/> Scheduled</p>
                  <p className="font-medium text-foreground">
                    {(() => {
                      const dateOnly = String(job.scheduled_date).slice(0, 10);
                      return job.scheduled_time
                        ? formatDateTime(`${dateOnly}T${job.scheduled_time}`)
                        : formatDate(dateOnly);
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><User className="w-4 h-4"/> Technician</p>
                  <p className="font-medium text-foreground">{job.technician?.full_name || 'Unassigned'}</p>
                </div>
                {job.estimated_duration && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Estimated Duration</p>
                    <p className="font-medium text-foreground">{job.estimated_duration}</p>
                  </div>
                )}
                <div className="sm:col-span-2 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground whitespace-pre-wrap">{job.description || 'No description provided.'}</p>
                </div>
              </div>
              {(profile?.role === "admin" || profile?.role === "office_staff") && customerEmail && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <Button variant="outline" size="sm" onClick={handleSendConfirmationDirect} disabled={sendingConfirmation} className="gap-2">
                    <Mail className="w-4 h-4" />
                    {sendingConfirmation ? "Sending..." : "Email Appointment Confirmation"}
                  </Button>
                </div>
              )}
            </Card>

            <TimeAttendedSection jobId={job.id} calloutRateId={(job as unknown as Record<string, unknown>).callout_rate_id as string | null} legacyArrival={(job as unknown as Record<string, unknown>).arrival_time as string | null} legacyDeparture={(job as unknown as Record<string, unknown>).departure_time as string | null} onChanged={() => setPricingRefresh(k => k + 1)} />

            <ScheduleHistorySection jobId={job.id} />

            <PartsUsedSection jobId={job.id} onChanged={() => setPricingRefresh(k => k + 1)} />

            {(profile?.role === "admin" || profile?.role === "office_staff") && (
              <PricingSummarySection jobId={job.id} jobStatus={job.status} externalInvoiceId={job.external_invoice_id} externalInvoiceProvider={job.external_invoice_provider} externalInvoiceSentAt={job.external_invoice_sent_at} refreshKey={pricingRefresh} />
            )}

            <PhotosSection jobId={job.id} />

            <CommentsSection jobId={job.id} />

            {(() => {
              const effectiveFuel = (job as unknown as { fuel_category?: string | null }).fuel_category || null;
              const isGeneral = effectiveFuel === "general" || !effectiveFuel;
              const showGasForms = !isGeneral && (effectiveFuel === "gas" || effectiveFuel === "oil");
              const showOilForms = !isGeneral && effectiveFuel === "oil";
              const showHeatPumpForms = !isGeneral && effectiveFuel === "heat_pump";
              return (
                <>
                  <h3 className="font-display font-bold text-xl mt-8 mb-4">Actions & Forms</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {showGasForms && (
                      <Link href={`/jobs/${job.id}/service-record`}>
                        <Card className={`p-5 flex items-center gap-4 hover:border-primary hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("service_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-blue-50/50 to-white"}`}>
                          <div className={`p-3 rounded-xl ${completedFormTypes.has("service_record") ? "bg-emerald-500 text-white" : "bg-blue-100 text-blue-600"}`}><FileText className="w-6 h-6"/></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold">Service Record</h4>
                              {completedFormTypes.has("service_record") && <Check className="w-4 h-4 text-emerald-600" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{completedFormTypes.has("service_record") ? "Completed — tap to view or edit" : "Complete full inspection"}</p>
                          </div>
                        </Card>
                      </Link>
                    )}

                    <Link href={`/jobs/${job.id}/breakdown-report`}>
                      <Card className={`p-5 flex items-center gap-4 hover:border-rose-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("breakdown_report") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-rose-50/50 to-white"}`}>
                        <div className={`p-3 rounded-xl ${completedFormTypes.has("breakdown_report") ? "bg-emerald-500 text-white" : "bg-rose-100 text-rose-600"}`}><Wrench className="w-6 h-6"/></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold">Breakdown Report</h4>
                            {completedFormTypes.has("breakdown_report") && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{completedFormTypes.has("breakdown_report") ? "Completed — tap to view or edit" : "Record faults and fixes"}</p>
                        </div>
                      </Card>
                    </Link>

                    {showGasForms && job.job_type === "installation" && (
                      <Link href={`/jobs/${job.id}/commissioning`}>
                        <Card className={`p-5 flex items-center gap-4 hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("commissioning_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-emerald-50/50 to-white"}`}>
                          <div className={`p-3 rounded-xl ${completedFormTypes.has("commissioning_record") ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-600"}`}><ClipboardCheck className="w-6 h-6"/></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold">Commissioning Record</h4>
                              {completedFormTypes.has("commissioning_record") && <Check className="w-4 h-4 text-emerald-600" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{completedFormTypes.has("commissioning_record") ? "Completed — tap to view or edit" : "New installation commissioning"}</p>
                          </div>
                        </Card>
                      </Link>
                    )}

                    <Link href={`/jobs/${job.id}/job-completion`}>
                      <Card className={`p-5 flex items-center gap-4 hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completionReport ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-emerald-50/50 to-white"}`}>
                        <div className={`p-3 rounded-xl ${completionReport ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-600"}`}><ClipboardList className="w-6 h-6"/></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold">Job Completion Report</h4>
                            {completionReport && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {completionReport ? "Completed — tap to view or edit" : "Summarise work & sign-off"}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  </div>

                  {showHeatPumpForms && (
                    <>
                      <h3 className="font-display font-bold text-xl mt-8 mb-4">Heat Pump Records</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Link href={`/jobs/${job.id}/heat-pump-service`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-cyan-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("heat_pump_service_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-cyan-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("heat_pump_service_record") ? "bg-emerald-500 text-white" : "bg-cyan-100 text-cyan-600"}`}><Wind className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Heat Pump Service</h4>
                                {completedFormTypes.has("heat_pump_service_record") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("heat_pump_service_record") ? "Completed — tap to view or edit" : "Refrigerant, temps & COP readings"}</p>
                            </div>
                          </Card>
                        </Link>
                        <Link href={`/jobs/${job.id}/heat-pump-commissioning`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-cyan-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("heat_pump_commissioning_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-cyan-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("heat_pump_commissioning_record") ? "bg-emerald-500 text-white" : "bg-cyan-100 text-cyan-600"}`}><ClipboardCheck className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Heat Pump Commissioning</h4>
                                {completedFormTypes.has("heat_pump_commissioning_record") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("heat_pump_commissioning_record") ? "Completed — tap to view or edit" : "MCS-style commissioning record"}</p>
                            </div>
                          </Card>
                        </Link>
                      </div>
                    </>
                  )}

                  {showOilForms && (
                    <>
                      <h3 className="font-display font-bold text-xl mt-8 mb-4">Oil Service Records</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Link href={`/jobs/${job.id}/oil-tank-inspection`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("oil_tank_inspection") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-blue-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("oil_tank_inspection") ? "bg-emerald-500 text-white" : "bg-blue-100 text-blue-600"}`}><Droplets className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Oil Tank Inspection</h4>
                                {completedFormTypes.has("oil_tank_inspection") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("oil_tank_inspection") ? "Completed — tap to view or edit" : "Tank details & condition"}</p>
                            </div>
                          </Card>
                        </Link>

                        <Link href={`/jobs/${job.id}/oil-tank-risk-assessment`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-orange-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("oil_tank_risk_assessment") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-orange-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("oil_tank_risk_assessment") ? "bg-emerald-500 text-white" : "bg-orange-100 text-orange-600"}`}><ShieldAlert className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Oil Tank Risk Assessment</h4>
                                {completedFormTypes.has("oil_tank_risk_assessment") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("oil_tank_risk_assessment") ? "Completed — tap to view or edit" : "Hazards & risk ratings"}</p>
                            </div>
                          </Card>
                        </Link>

                        <Link href={`/jobs/${job.id}/combustion-analysis`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("combustion_analysis_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-indigo-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("combustion_analysis_record") ? "bg-emerald-500 text-white" : "bg-indigo-100 text-indigo-600"}`}><Gauge className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Combustion Analysis</h4>
                                {completedFormTypes.has("combustion_analysis_record") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("combustion_analysis_record") ? "Completed — tap to view or edit" : "Flue gas readings & efficiency"}</p>
                            </div>
                          </Card>
                        </Link>

                        <Link href={`/jobs/${job.id}/burner-setup`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-orange-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("burner_setup_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-amber-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("burner_setup_record") ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-600"}`}><Settings className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Burner Setup Record</h4>
                                {completedFormTypes.has("burner_setup_record") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("burner_setup_record") ? "Completed — tap to view or edit" : "Nozzle, pressure & electrodes"}</p>
                            </div>
                          </Card>
                        </Link>

                        <Link href={`/jobs/${job.id}/fire-valve-test`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-red-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("fire_valve_test_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-red-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("fire_valve_test_record") ? "bg-emerald-500 text-white" : "bg-red-100 text-red-600"}`}><ShieldCheck className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Fire Valve Test</h4>
                                {completedFormTypes.has("fire_valve_test_record") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("fire_valve_test_record") ? "Completed — tap to view or edit" : "Test result & remedial action"}</p>
                            </div>
                          </Card>
                        </Link>

                        <Link href={`/jobs/${job.id}/oil-line-vacuum-test`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-teal-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("oil_line_vacuum_test") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-teal-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("oil_line_vacuum_test") ? "bg-emerald-500 text-white" : "bg-teal-100 text-teal-600"}`}><Pipette className="w-6 h-6"/></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Oil Line Vacuum Test</h4>
                                {completedFormTypes.has("oil_line_vacuum_test") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("oil_line_vacuum_test") ? "Completed — tap to view or edit" : "Pipework & vacuum readings"}</p>
                            </div>
                          </Card>
                        </Link>
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            <EmailLogSection jobId={job.id} refreshKey={emailLogRefresh} />
          </div>

          <div className="space-y-6">
            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2"><User className="w-5 h-5"/> Customer</h3>
                {isAdmin && (
                  <Link href={`/customers/${job.customer_id}?edit=1`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    <Edit className="w-3 h-3" /> Edit
                  </Link>
                )}
              </div>
              <p className="font-bold text-lg">{job.customer?.first_name} {job.customer?.last_name}</p>
              {job.customer?.phone && (
                <a href={`tel:${job.customer.phone}`} className="text-sm text-muted-foreground mt-1 hover:text-primary flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {job.customer.phone}
                </a>
              )}
              {job.customer?.mobile && (
                <a href={`tel:${job.customer.mobile}`} className="text-sm text-muted-foreground mt-0.5 hover:text-primary flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> {job.customer.mobile}
                </a>
              )}
              {job.customer?.email && (
                <a href={`mailto:${job.customer.email}`} className="text-sm text-muted-foreground mt-0.5 hover:text-primary flex items-center gap-1 break-all">
                  <Mail className="w-3.5 h-3.5" /> {job.customer.email}
                </a>
              )}
              {(job.customer?.address_line1 || job.customer?.city || job.customer?.postcode) && (
                <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {job.customer.address_line1 && <div>{job.customer.address_line1}</div>}
                  {job.customer.address_line2 && <div>{job.customer.address_line2}</div>}
                  {job.customer.city && <div>{job.customer.city}</div>}
                  {job.customer.county && <div>{job.customer.county}</div>}
                  {job.customer.postcode && <div>{job.customer.postcode}</div>}
                </div>
              )}
              <Link href={`/customers/${job.customer_id}`} className="text-sm text-primary hover:underline mt-2 inline-block">View Profile</Link>
            </Card>

            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2"><MapPin className="w-5 h-5"/> Location</h3>
                {isAdmin && (
                  <Link href={`/properties/${job.property_id}?edit=1`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    <Edit className="w-3 h-3" /> Edit
                  </Link>
                )}
              </div>
              <div className="font-medium text-sm leading-relaxed">
                {job.property?.address_line1 && <div>{job.property.address_line1}</div>}
                {job.property?.address_line2 && <div>{job.property.address_line2}</div>}
                {job.property?.city && <div>{job.property.city}</div>}
                {job.property?.county && <div>{job.property.county}</div>}
                {job.property?.postcode && <div>{job.property.postcode}</div>}
              </div>
              {(job.customer?.first_name || job.customer?.phone || job.customer?.email) && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-0.5">
                  <p className="text-sm font-semibold">{job.customer?.first_name} {job.customer?.last_name}</p>
                  {job.customer?.phone && (
                    <a href={`tel:${job.customer.phone}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {job.customer.phone}
                    </a>
                  )}
                  {job.customer?.mobile && (
                    <a href={`tel:${job.customer.mobile}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5" /> {job.customer.mobile}
                    </a>
                  )}
                  {job.customer?.email && (
                    <a href={`mailto:${job.customer.email}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 break-all">
                      <Mail className="w-3.5 h-3.5" /> {job.customer.email}
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <Link href={`/properties/${job.property_id}`} className="text-sm text-primary hover:underline">View Property</Link>
                <button
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                  onClick={() => {
                    const hasCoords = job.property?.latitude != null && job.property?.longitude != null;
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    if (hasCoords) {
                      if (isIOS) {
                        window.open(`maps://maps.apple.com/?daddr=${job.property!.latitude},${job.property!.longitude}`, "_blank");
                      } else {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.property!.latitude},${job.property!.longitude}`, "_blank");
                      }
                    } else {
                      const addr = [job.property?.address_line1, job.property?.city, job.property?.postcode].filter(Boolean).join(", ");
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, "_blank");
                    }
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Navigate
                </button>
              </div>
            </Card>
            
          </div>
        </div>
        </>
      )}

      {emailModalOpen && (
        <EmailFormsModal
          jobId={job.id}
          customerEmail={(job.customer as Record<string, unknown>)?.email as string || ""}
          customerName={`${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.trim()}
          onClose={() => setEmailModalOpen(false)}
          onSent={() => setEmailLogRefresh(k => k + 1)}
        />
      )}
    </div>
  );
}

function TimeAttendedSection({ jobId, calloutRateId, legacyArrival, legacyDeparture, onChanged }: { jobId: string; calloutRateId?: string | null; legacyArrival: string | null; legacyDeparture: string | null; onChanged?: () => void }) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { isOnline, queueTimeEntry } = useOffline();
  const { data: entries, isLoading } = useListJobTimeEntries(jobId);
  const { data: companySettings } = useCompanySettings();
  const createMutation = useCreateJobTimeEntry();
  const deleteMutation = useDeleteJobTimeEntry();
  const updateMutation = useUpdateJobTimeEntry();
  const [showAdd, setShowAdd] = useState(false);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [notes, setNotes] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editArrival, setEditArrival] = useState("");
  const [editDeparture, setEditDeparture] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const departureInputRef = useRef<HTMLInputElement>(null);
  const editDepartureInputRef = useRef<HTMLInputElement>(null);
  const [calloutRates, setCalloutRates] = useState<{ id: string; name: string; amount: number; hourly_rate: number | null }[]>([]);
  const [selectedCalloutRate, setSelectedCalloutRate] = useState<string>(calloutRateId || "auto");
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`);
        if (Array.isArray(data)) setCalloutRates(data as { id: string; name: string; amount: number }[]);
      } catch { /* silently ignore auth errors */ }
    })();
  }, []);

  const handleCalloutRateChange = async (value: string) => {
    setSelectedCalloutRate(value);
    const selectedRate = value !== "auto" ? calloutRates.find(r => r.id === value) : null;
    const newHourlyRate = selectedRate?.hourly_rate != null
      ? String(Number(selectedRate.hourly_rate))
      : companySettings?.default_hourly_rate != null
        ? String(Number(companySettings.default_hourly_rate))
        : "";
    setHourlyRate(newHourlyRate);
    if (selectedRate?.hourly_rate != null) {
      setHourlyRate(String(Number(selectedRate.hourly_rate)));
    }
    setSavingRate(true);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callout_rate_id: value === "auto" ? null : value }),
      });
      onChanged?.();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to update", variant: "destructive" });
    } finally { setSavingRate(false); }
  };

  useEffect(() => {
    if (!hourlyRate && companySettings?.default_hourly_rate) {
      const selectedRate = selectedCalloutRate !== "auto" ? calloutRates.find(r => r.id === selectedCalloutRate) : null;
      const rateHourly = selectedRate?.hourly_rate;
      const defaultRate = rateHourly != null ? rateHourly : companySettings.default_hourly_rate;
      if (Number(defaultRate) > 0) setHourlyRate(String(Number(defaultRate)));
    }
  }, [companySettings?.default_hourly_rate, calloutRates, selectedCalloutRate]);

  const selectedRateAmount = (() => {
    if (selectedCalloutRate === "auto") return Number(companySettings?.call_out_fee) || 0;
    const found = calloutRates.find(r => r.id === selectedCalloutRate);
    return found ? Number(found.amount) : Number(companySettings?.call_out_fee) || 0;
  })();

  const callOutFee = selectedRateAmount;

  const sortedEntries = [...(entries || [])].sort((a, b) => new Date(a.arrival_time).getTime() - new Date(b.arrival_time).getTime());

  const totalMinutes = sortedEntries.reduce((sum, e) => {
    if (!e.departure_time) return sum;
    const ms = new Date(e.departure_time).getTime() - new Date(e.arrival_time).getTime();
    return sum + Math.max(0, ms / 60000);
  }, 0);

  // Callout fee charged once for the whole job (first entry). The first hour is covered by it.
  const entryBreakdowns = (() => {
    const map = new Map<string, { totalHours: number; calloutHours: number; calloutRate: number; calloutCost: number; billableHours: number; hourlyRate: number; billableCost: number; entryCost: number }>();
    let calloutHoursRemaining = callOutFee > 0 ? 1 : 0;
    for (let i = 0; i < sortedEntries.length; i++) {
      const e = sortedEntries[i];
      const isFirstEntry = i === 0;
      const entryCalloutFee = isFirstEntry ? callOutFee : 0;
      if (!e.departure_time) {
        // Ongoing: callout fee still applies once the technician has arrived
        const calloutCost = isFirstEntry ? callOutFee : 0;
        map.set(e.id, { totalHours: 0, calloutHours: 0, calloutRate: entryCalloutFee, calloutCost, billableHours: 0, hourlyRate: 0, billableCost: 0, entryCost: calloutCost });
        continue;
      }
      const hours = Math.max(0, (new Date(e.departure_time).getTime() - new Date(e.arrival_time).getTime()) / 3600000);
      // Use stored hourly_rate if available, else fall back to the job-level effective rate
      const rate = e.hourly_rate != null ? Number(e.hourly_rate) : effectiveHourlyRate;
      const calloutHours = Math.min(hours, calloutHoursRemaining);
      calloutHoursRemaining = Math.max(0, calloutHoursRemaining - hours);
      const calloutCost = isFirstEntry ? callOutFee : 0;
      const billableHours = hours - calloutHours;
      const billableCost = billableHours > 0 && rate > 0 ? billableHours * rate : 0;
      const entryCost = calloutCost + billableCost;
      map.set(e.id, { totalHours: hours, calloutHours, calloutRate: entryCalloutFee, calloutCost, billableHours, hourlyRate: rate, billableCost, entryCost });
    }
    return map;
  })();

  const totalLabourCost = (() => {
    let cost = 0;
    for (const b of entryBreakdowns.values()) cost += b.entryCost;
    return cost;
  })();

  const hasEntries = sortedEntries.length > 0;
  const showLegacy = !hasEntries && (legacyArrival || legacyDeparture);

  const [offlineSubmitting, setOfflineSubmitting] = useState(false);

  // Derive the effective hourly rate from currently selected callout rate (or company default)
  const effectiveHourlyRate = (() => {
    if (selectedCalloutRate !== "auto") {
      const found = calloutRates.find(r => r.id === selectedCalloutRate);
      if (found?.hourly_rate != null) return Number(found.hourly_rate);
    }
    return Number(companySettings?.default_hourly_rate) || 0;
  })();

  const handleAdd = async () => {
    if (!arrival) return;
    // Read departure directly from the DOM to catch any value not yet reflected in state
    const departureValue = departureInputRef.current?.value || departure;
    const resolvedRate = effectiveHourlyRate > 0 ? effectiveHourlyRate : (hourlyRate ? parseFloat(hourlyRate) : null);
    const arrivalDate = new Date(arrival);
    let departureDate = departureValue ? new Date(departureValue) : null;
    // Auto-advance departure by 1 day if it crosses midnight (departure before or equal to arrival)
    if (departureDate && departureDate <= arrivalDate) {
      departureDate = new Date(departureDate.getTime() + 24 * 60 * 60 * 1000);
    }
    const entryData = {
      arrival_time: arrivalDate.toISOString(),
      departure_time: departureDate ? departureDate.toISOString() : null,
      notes: notes || null,
      hourly_rate: resolvedRate || null,
    };
    if (!isOnline) {
      if (offlineSubmitting) return;
      setOfflineSubmitting(true);
      try {
        await queueTimeEntry(jobId, entryData);
        setArrival(""); setDeparture(""); setNotes(""); setHourlyRate(""); setShowAdd(false);
        toast({ title: "Saved offline", description: "Time entry will sync when you're back online." });
      } catch {
        toast({ title: "Error", description: "Failed to save time entry offline", variant: "destructive" });
      } finally {
        setOfflineSubmitting(false);
      }
      return;
    }
    try {
      await createMutation.mutateAsync({
        jobId,
        data: entryData as Record<string, unknown>,
      });
      setArrival(""); setDeparture(""); setNotes(""); setHourlyRate(""); setShowAdd(false);
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/time-entries`] });
      toast({ title: "Added", description: "Time entry added" });
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteMutation.mutateAsync({ jobId, entryId });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/time-entries`] });
      toast({ title: "Deleted", description: "Time entry removed" });
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const startEdit = (entry: { id: string; arrival_time: string; departure_time?: string | null; notes?: string | null; hourly_rate?: number | string | null }) => {
    setEditingId(entry.id);
    setEditArrival(toLocalDatetimeStr(new Date(entry.arrival_time)));
    setEditDeparture(entry.departure_time ? toLocalDatetimeStr(new Date(entry.departure_time)) : "");
    setEditNotes(entry.notes || "");
    setEditHourlyRate(entry.hourly_rate != null ? String(entry.hourly_rate) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditArrival(""); setEditDeparture(""); setEditNotes(""); setEditHourlyRate("");
  };

  const handleEditCalloutRateChange = (value: string) => {
    const selectedRate = value !== "auto" ? calloutRates.find(r => r.id === value) : null;
    if (selectedRate?.hourly_rate != null) {
      setEditHourlyRate(String(Number(selectedRate.hourly_rate)));
    } else if (companySettings?.default_hourly_rate) {
      setEditHourlyRate(String(Number(companySettings.default_hourly_rate)));
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !editArrival) return;
    // Read departure directly from the DOM to catch any value not yet reflected in state
    const editDepartureValue = editDepartureInputRef.current?.value || editDeparture;
    const resolvedEditRate = editHourlyRate ? parseFloat(editHourlyRate) : (effectiveHourlyRate > 0 ? effectiveHourlyRate : null);
    const editArrivalDate = new Date(editArrival);
    let editDepartureDate = editDepartureValue ? new Date(editDepartureValue) : null;
    // Auto-advance departure by 1 day if it crosses midnight (departure before or equal to arrival)
    if (editDepartureDate && editDepartureDate <= editArrivalDate) {
      editDepartureDate = new Date(editDepartureDate.getTime() + 24 * 60 * 60 * 1000);
    }
    try {
      await updateMutation.mutateAsync({
        jobId,
        entryId: editingId,
        data: {
          arrival_time: editArrivalDate.toISOString(),
          departure_time: editDepartureDate ? editDepartureDate.toISOString() : null,
          notes: editNotes || null,
          hourly_rate: resolvedEditRate,
        } as Record<string, unknown>,
      });
      cancelEdit();
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/time-entries`] });
      toast({ title: "Updated", description: "Time entry updated" });
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const canModify = (createdBy: string | null | undefined) =>
    createdBy === profile?.id || profile?.role === "admin" || profile?.role === "super_admin";

  const formatEntryDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const formatEntryTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2 text-amber-600">
          <Clock className="w-5 h-5" /> Time Attended
        </h3>
        <Button size="sm" variant="outline" onClick={() => {
          if (!showAdd) {
            const selectedRate = selectedCalloutRate !== "auto" ? calloutRates.find(r => r.id === selectedCalloutRate) : null;
            const rateHourly = selectedRate?.hourly_rate;
            const defaultRate = rateHourly != null ? rateHourly : companySettings?.default_hourly_rate;
            setHourlyRate(defaultRate != null && Number(defaultRate) > 0 ? String(Number(defaultRate)) : "");
          }
          setShowAdd(!showAdd);
        }}>
          <Plus className="w-4 h-4 mr-1" /> Add Entry
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Arrival *</Label>
              <div className="flex gap-1.5">
                <Input type="datetime-local" value={arrival} onChange={(e) => {
                  setArrival(e.target.value);
                }} className="flex-1" />
                <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => {
                  const now = toLocalDatetimeStr(new Date());
                  setArrival(now);
                }}>Now</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Departure</Label>
              <div className="flex gap-1.5">
                <Input ref={departureInputRef} type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} onBlur={(e) => setDeparture(e.target.value)} className="flex-1" />
                <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => setDeparture(toLocalDatetimeStr(new Date()))}>Now</Button>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Replaced valve, awaiting part" />
            </div>
            {calloutRates.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Callout Rate</Label>
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                    value={selectedCalloutRate}
                    onChange={(e) => handleCalloutRateChange(e.target.value)}
                    disabled={savingRate}
                  >
                    <option value="auto">Auto (based on time of day)</option>
                    {calloutRates.map(r => (
                      <option key={r.id} value={r.id}>{r.name} - £{Number(r.amount).toFixed(2)}{r.hourly_rate != null ? ` (£${Number(r.hourly_rate).toFixed(2)}/hr)` : ""}</option>
                    ))}
                  </select>
                  {savingRate && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            )}
          </div>
          {arrival && departure && (() => {
            const ms = new Date(departure).getTime() - new Date(arrival).getTime();
            const hours = ms / 3600000;
            const durationStr = calcDuration(arrival, departure);
            const rate = parseFloat(hourlyRate) || 0;
            const hasCallout = callOutFee > 0;
            const billable = hasCallout ? Math.max(0, hours - 1) : Math.max(0, hours);
            const cost = (hasCallout ? callOutFee : 0) + billable * rate;
            return (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Duration: {durationStr}</span>
                {ms > 0 && (callOutFee > 0 || rate > 0) && (
                  <span className="font-medium text-emerald-600">Cost: £{cost.toFixed(2)}</span>
                )}
              </div>
            );
          })()}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending || offlineSubmitting || !arrival}>
              <Check className="w-4 h-4 mr-1" /> {createMutation.isPending || offlineSubmitting ? "Saving..." : "Save Entry"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setArrival(""); setDeparture(""); setNotes(""); setHourlyRate(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading time entries...</p>
      ) : hasEntries ? (
        <>
          <div className="space-y-2">
            {sortedEntries.map((entry) => (
              editingId === entry.id ? (
                <div key={entry.id} className="border rounded-lg p-3 bg-blue-50/50 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Arrival *</Label>
                      <div className="flex gap-1.5">
                        <Input type="datetime-local" value={editArrival} onChange={(e) => {
                          setEditArrival(e.target.value);
                        }} className="flex-1" />
                        <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => {
                          const now = toLocalDatetimeStr(new Date());
                          setEditArrival(now);
                        }}>Now</Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Departure</Label>
                      <div className="flex gap-1.5">
                        <Input ref={editDepartureInputRef} type="datetime-local" value={editDeparture} onChange={(e) => setEditDeparture(e.target.value)} onBlur={(e) => setEditDeparture(e.target.value)} className="flex-1" />
                        <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => setEditDeparture(toLocalDatetimeStr(new Date()))}>Now</Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="e.g. Replaced valve, awaiting part" />
                    </div>
                    {calloutRates.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Callout Rate</Label>
                        <select
                          className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                          defaultValue="auto"
                          onChange={(e) => handleEditCalloutRateChange(e.target.value)}
                        >
                          <option value="auto">Select to change rate...</option>
                          {calloutRates.map(r => (
                            <option key={r.id} value={r.id}>{r.name} - £{Number(r.amount).toFixed(2)}{r.hourly_rate != null ? ` (£${Number(r.hourly_rate).toFixed(2)}/hr)` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {editHourlyRate && (
                    <div className="text-xs text-muted-foreground">
                      Hourly rate: <span className="font-medium">£{parseFloat(editHourlyRate).toFixed(2)}/hr</span>
                    </div>
                  )}
                  {editArrival && editDeparture && (() => {
                    const ms = new Date(editDeparture).getTime() - new Date(editArrival).getTime();
                    const hours = ms / 3600000;
                    const durationStr = calcDuration(editArrival, editDeparture);
                    const rate = parseFloat(editHourlyRate) || 0;
                    const hasCallout = callOutFee > 0;
                    const billable = hasCallout ? Math.max(0, hours - 1) : Math.max(0, hours);
                    const cost = (hasCallout ? callOutFee : 0) + billable * rate;
                    return (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Duration: {durationStr}</span>
                        {ms > 0 && (callOutFee > 0 || rate > 0) && (
                          <span className="font-medium text-emerald-600">Cost: £{cost.toFixed(2)}</span>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending || !editArrival}>
                      <Check className="w-4 h-4 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={entry.id} className="border rounded-lg bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{formatEntryDate(entry.arrival_time)}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatEntryTime(entry.arrival_time)}
                          {entry.departure_time ? ` - ${formatEntryTime(entry.departure_time)}` : " - ongoing"}
                        </span>
                        {entry.departure_time && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                            {calcDuration(entry.arrival_time, entry.departure_time)}
                          </span>
                        )}
                      </div>
                      {entry.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.notes}</p>}
                      {entry.created_by_name && <p className="text-xs text-muted-foreground">{entry.created_by_name}</p>}
                    </div>
                    {canModify(entry.created_by) && (
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEdit(entry)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const bd = entryBreakdowns.get(entry.id);
                    if (!bd || (bd.totalHours === 0 && bd.calloutCost === 0)) return null;
                    if (bd.hourlyRate <= 0 && bd.calloutCost <= 0) return null;
                    const jobCalloutRate = selectedCalloutRate !== "auto" ? calloutRates.find(r => r.id === selectedCalloutRate) : null;
                    return (
                      <div className="border-t border-border/30 bg-slate-50/80 px-3 py-1.5 space-y-0.5">
                        {jobCalloutRate && (
                          <div className="text-xs font-medium text-slate-500">{jobCalloutRate.name}</div>
                        )}
                        {bd.calloutRate > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Call-out (min. 1hr)</span>
                            <span className="font-medium text-emerald-600">£{bd.calloutCost.toFixed(2)}</span>
                          </div>
                        )}
                        {bd.billableHours > 0 && bd.hourlyRate > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">{formatTotalTime(bd.billableHours * 60)} @ £{bd.hourlyRate.toFixed(2)}/hr</span>
                            <span className="font-medium text-emerald-600">£{bd.billableCost.toFixed(2)}</span>
                          </div>
                        )}
                        {bd.entryCost > 0 && (
                          <div className="flex justify-between items-center text-xs pt-0.5 border-t border-border/20">
                            <span className="text-muted-foreground font-medium">Entry total</span>
                            <span className="font-semibold text-emerald-700">£{bd.entryCost.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )
            ))}
          </div>
          <div className="mt-3 pt-3 border-t space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Total Time</span>
              <span className="font-bold text-amber-600">{formatTotalTime(totalMinutes)}</span>
            </div>
            {totalLabourCost > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Labour Total</span>
                <span className="font-bold text-emerald-600">£{totalLabourCost.toFixed(2)}</span>
              </div>
            )}
          </div>
        </>
      ) : showLegacy ? (
        <div className="border rounded-lg p-3 bg-slate-50/50">
          <p className="text-xs text-muted-foreground mb-1 italic">Legacy single entry</p>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            {legacyArrival && <span>Arrival: {formatDateTime(legacyArrival)}</span>}
            {legacyDeparture && <span>Departure: {formatDateTime(legacyDeparture)}</span>}
            {legacyArrival && legacyDeparture && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                {calcDuration(legacyArrival, legacyDeparture)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No time entries yet</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Entry
          </Button>
        </div>
      )}
    </Card>
  );
}

function formatTotalTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ScheduleHistorySection({ jobId }: { jobId: string }) {
  const { data: history, isLoading } = useQuery<Array<{
    id: string;
    previous_date: string | null;
    previous_time: string | null;
    new_date: string | null;
    new_time: string | null;
    reason: string | null;
    created_at: string;
    changed_by_name: string;
  }>>({
    queryKey: [`/api/jobs/${jobId}/schedule-history`],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/schedule-history`) as Promise<Array<{
      id: string;
      previous_date: string | null;
      previous_time: string | null;
      new_date: string | null;
      new_time: string | null;
      reason: string | null;
      created_at: string;
      changed_by_name: string;
    }>>,
  });

  if (isLoading || !history || history.length === 0) return null;

  const fmtDate = (d: string | null) => {
    if (!d) return "Not set";
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  const fmtTime = (t: string | null) => {
    if (!t) return "Not set";
    return t.slice(0, 5);
  };

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <h3 className="font-bold text-lg flex items-center gap-2 text-orange-600 mb-4">
        <Calendar className="w-5 h-5" /> Schedule History
      </h3>
      <div className="space-y-3">
        {history.map((entry) => {
          const dateChanged = entry.previous_date !== entry.new_date;
          const timeChanged = entry.previous_time !== entry.new_time;
          return (
            <div key={entry.id} className="border rounded-lg p-3 bg-slate-50/50 text-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Changed by <strong className="text-foreground">{entry.changed_by_name}</strong></span>
                <span>{new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {dateChanged && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="line-through text-red-500">{fmtDate(entry.previous_date)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-green-600">{fmtDate(entry.new_date)}</span>
                </div>
              )}
              {timeChanged && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="line-through text-red-500">{fmtTime(entry.previous_time)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-green-600">{fmtTime(entry.new_time)}</span>
                </div>
              )}
              {entry.reason && (
                <div className="text-xs text-muted-foreground italic">Reason: {entry.reason}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PartsUsedSection({ jobId, onChanged }: { jobId: string; onChanged?: () => void }) {
  const { toast } = useToast();
  const { isOnline, queueJobPart } = useOffline();
  const [parts, setParts] = useState<JobPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partSerial, setPartSerial] = useState("");
  const [partPrice, setPartPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<{ id: string; name: string; default_price: number | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchError, setSearchError] = useState(false);
  const productSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);

  const fetchParts = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts`);
      setParts(Array.isArray(data) ? data as JobPart[] : []);
    } catch {
      setParts([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  const searchProducts = (query: string) => {
    if (productSearchTimeout.current) clearTimeout(productSearchTimeout.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    if (!query.trim()) { setProductSuggestions([]); setShowSuggestions(false); setSearchedQuery(""); setSearchError(false); return; }
    productSearchTimeout.current = setTimeout(async () => {
      const seq = ++searchSeqRef.current;
      const abortCtrl = new AbortController();
      searchAbortRef.current = abortCtrl;
      try {
        setSearchError(false);
        const data = await customFetch(`${import.meta.env.BASE_URL}api/products/search?q=${encodeURIComponent(query)}`, { signal: abortCtrl.signal });
        if (seq !== searchSeqRef.current) return;
        const results = Array.isArray(data) ? data as { id: string; name: string; default_price: number | null }[] : [];
        setProductSuggestions(results);
        setSearchedQuery(query.trim());
        setShowSuggestions(true);
      } catch (e: unknown) {
        if (seq !== searchSeqRef.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setProductSuggestions([]);
        setSearchedQuery(query.trim());
        setSearchError(true);
        setShowSuggestions(true);
      }
    }, 250);
  };

  const selectProduct = (product: { name: string; default_price: number | null }) => {
    setPartName(product.name);
    if (product.default_price != null) setPartPrice(String(product.default_price));
    setShowSuggestions(false);
  };

  const handleAdd = async () => {
    if (!partName.trim()) return;
    setSubmitting(true);
    const partData = {
      part_name: partName.trim(),
      quantity: Number(partQty) || 1,
      serial_number: partSerial || null,
      unit_price: partPrice ? Number(partPrice) : null,
    };
    if (!isOnline) {
      try {
        await queueJobPart(jobId, partData);
        setPartName(""); setPartQty("1"); setPartSerial(""); setPartPrice(""); setShowAdd(false);
        toast({ title: "Saved offline", description: "Part will sync when you're back online." });
      } catch {
        toast({ title: "Error", description: "Failed to save part offline", variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partData),
      });
      setPartName(""); setPartQty("1"); setPartSerial(""); setPartPrice(""); setShowAdd(false);
      toast({ title: "Added", description: "Part added" });
      fetchParts();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add part";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (partId: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts/${partId}`, { method: "DELETE" });
      toast({ title: "Removed", description: "Part removed" });
      fetchParts();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleSavePrice = async (partId: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts/${partId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_price: editPrice ? Number(editPrice) : null }),
      });
      setEditingId(null);
      fetchParts();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update price";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleSaveQty = async (partId: string) => {
    const qty = Number(editQty);
    if (!qty || qty < 1) return;
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts/${partId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      setEditingQtyId(null);
      fetchParts();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update quantity";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const partsSubtotal = parts.reduce((sum, p) => sum + (Number(p.unit_price) || 0) * p.quantity, 0);

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2 text-blue-600">
          <Package className="w-5 h-5" /> Parts Used
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Part</>}
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1 relative col-span-2 sm:col-span-1">
              <Label className="text-xs">Part Name *</Label>
              <Input
                value={partName}
                onChange={(e) => { setPartName(e.target.value); searchProducts(e.target.value); }}
                onFocus={() => { if (productSuggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Type to search catalogue..."
                autoComplete="off"
              />
              {showSuggestions && searchedQuery && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchError ? (
                    <div className="px-3 py-2 text-sm text-red-500">Failed to search catalogue</div>
                  ) : productSuggestions.length > 0 ? (
                    productSuggestions.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex justify-between items-center"
                        onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
                      >
                        <span>{p.name}</span>
                        {p.default_price != null && <span className="text-muted-foreground">&pound;{Number(p.default_price).toFixed(2)}</span>}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No matching products found — type a custom name</div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min="1" value={partQty} onChange={(e) => setPartQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Price</Label>
              <Input type="number" step="0.01" min="0" value={partPrice} onChange={(e) => setPartPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Serial Number</Label>
              <Input value={partSerial} onChange={(e) => setPartSerial(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={submitting || !partName.trim()}>
            <Check className="w-4 h-4 mr-1" /> {submitting ? "Adding..." : "Add Part"}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading parts...</p>
      ) : parts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No parts recorded yet.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-2 sm:px-4 py-2 font-medium">Part</th>
                <th className="text-left px-2 sm:px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-2 sm:px-4 py-2 font-medium">Price</th>
                <th className="text-right px-2 sm:px-4 py-2 font-medium">Total</th>
                <th className="text-left px-2 sm:px-4 py-2 font-medium hidden sm:table-cell">Serial #</th>
                <th className="w-8 sm:w-10"></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-2 sm:px-4 py-2 break-words max-w-[120px] sm:max-w-none">{p.part_name}</td>
                  <td className="px-2 sm:px-4 py-2">
                    {editingQtyId === p.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min="1" step="1"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveQty(p.id); if (e.key === "Escape") setEditingQtyId(null); }}
                          className="w-14 h-7 text-xs"
                          autoFocus
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveQty(p.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingQtyId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary inline-flex items-center gap-1"
                        onClick={() => { setEditingQtyId(p.id); setEditQty(String(p.quantity)); }}
                      >
                        {p.quantity}
                        <Pencil className="w-3 h-3 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          type="number" step="0.01" min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-16 h-7 text-xs"
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSavePrice(p.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary inline-flex items-center gap-1"
                        onClick={() => { setEditingId(p.id); setEditPrice(p.unit_price != null ? String(p.unit_price) : ""); }}
                      >
                        {p.unit_price != null ? `${Number(p.unit_price).toFixed(2)}` : "—"}
                        <Pencil className="w-3 h-3 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right font-medium">
                    {p.unit_price != null ? (Number(p.unit_price) * p.quantity).toFixed(2) : "—"}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-muted-foreground hidden sm:table-cell">{p.serial_number || "—"}</td>
                  <td className="px-1 sm:px-2 py-2">
                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {partsSubtotal > 0 && (
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td colSpan={3} className="px-2 sm:px-4 py-2 font-semibold text-right">Parts Subtotal</td>
                  <td className="px-2 sm:px-4 py-2 font-bold text-right">{partsSubtotal.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}

interface InvoiceSummary {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  lines: { description: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  parts_total?: number;
  labour_total?: number;
  call_out_fee?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "\u00A3", EUR: "\u20AC", USD: "$" };

interface AccountingIntegrationStatus {
  connected: boolean;
  needs_reconnect?: boolean;
  provider: string | null;
  displayName: string;
}

function PricingSummarySection({ jobId, jobStatus, externalInvoiceId, externalInvoiceProvider, externalInvoiceSentAt, refreshKey = 0 }: { jobId: string; jobStatus: string; externalInvoiceId?: string | null; externalInvoiceProvider?: string | null; externalInvoiceSentAt?: string | null; refreshKey?: number }) {
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(jobStatus === "completed" || jobStatus === "invoiced");
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accountingStatus, setAccountingStatus] = useState<AccountingIntegrationStatus | null>(null);
  const [sendingToAccounting, setSendingToAccounting] = useState(false);
  const [sentExternalId, setSentExternalId] = useState<string | null>(externalInvoiceId || null);
  const [sentProviderName, setSentProviderName] = useState<string | null>(null);
  const [sentTimestamp, setSentTimestamp] = useState<string | null>(externalInvoiceSentAt || null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/invoice-summary`);
        setSummary(data as InvoiceSummary);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId, refreshKey]);

  useEffect(() => {
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/accounting-integration/active`) as AccountingIntegrationStatus;
        setAccountingStatus(data);
      } catch {
        setAccountingStatus(null);
      }
    })();
  }, []);

  const handleSendToAccounting = async () => {
    setSendingToAccounting(true);
    try {
      const result = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/send-to-accounting`, {
        method: "POST",
      }) as { success: boolean; external_id: string; provider_name: string; invoice_number: string; sent_at?: string };
      setSentExternalId(result.external_id);
      setSentProviderName(result.provider_name);
      setSentTimestamp(result.sent_at || new Date().toISOString());
      toast({
        title: "Invoice Sent",
        description: `Invoice ${result.invoice_number} sent to ${result.provider_name}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send invoice";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSendingToAccounting(false);
    }
  };

  const handleExport = async (format: string) => {
    setExporting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/invoice-export?format=${format}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `invoice-${jobId.substring(0, 8)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `Invoice exported as ${format.toUpperCase()}` });
      setShowExport(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Export failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) return null;
  if (!summary) return null;

  const sym = CURRENCY_SYMBOLS[summary.currency] || summary.currency + " ";
  const canExport = jobStatus === "completed" || jobStatus === "invoiced";

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3
          className="font-bold text-lg flex items-center gap-2 text-emerald-600 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <PoundSterling className="w-5 h-5" /> Pricing Summary
          <span className="text-xs text-muted-foreground ml-1">{expanded ? "▲" : "▼"}</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{sym}{summary.total.toFixed(2)}</span>
          {canExport && (
            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200" onClick={() => setShowExport(!showExport)}>
              <FileText className="w-4 h-4 mr-1" /> Export Invoice
            </Button>
          )}
        </div>
      </div>

      {summary.invoice_number && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground mb-3">
          <span><span className="font-medium text-foreground">Invoice #:</span> {summary.invoice_number}</span>
          {summary.due_date && (
            <span><span className="font-medium text-foreground">Due:</span> {new Date(summary.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          )}
        </div>
      )}

      {showExport && (
        <div className="border rounded-lg p-4 mb-4 bg-emerald-50/50 space-y-3">
          <p className="text-sm font-medium">Choose export format:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "csv", label: "Universal CSV" },
              { key: "quickbooks", label: "QuickBooks (IIF)" },
              { key: "xero", label: "Xero CSV" },
              { key: "sage", label: "Sage CSV" },
            ].map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => handleExport(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowExport(false)}>Cancel</Button>
        </div>
      )}

      {canExport && (accountingStatus?.connected || accountingStatus?.needs_reconnect || sentExternalId) && (
        <div className="border rounded-lg p-4 mb-4 bg-blue-50/50">
          {accountingStatus?.needs_reconnect && !sentExternalId ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-amber-700">Reconnect {accountingStatus?.displayName}</p>
                <p className="text-xs text-muted-foreground">Your connection has expired. Please reconnect in Company Settings to send invoices.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => window.location.href = "/admin/company-settings"}
              >
                Reconnect
              </Button>
            </div>
          ) : sentExternalId ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="font-medium">Invoice sent to {sentProviderName || externalInvoiceProvider || accountingStatus?.displayName || "accounting"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pl-6">
                    <span>Invoice ID: <span className="font-mono break-all">{sentExternalId}</span></span>
                    {sentTimestamp && (
                      <span>Sent: {new Date(sentTimestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </div>
                </div>
                {accountingStatus?.connected && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sendingToAccounting}
                    onClick={handleSendToAccounting}
                    className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    {sendingToAccounting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Resending...</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5" /> Resend Invoice</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Send to {accountingStatus?.displayName}</p>
                <p className="text-xs text-muted-foreground">Create this invoice in your accounting software</p>
              </div>
              <Button
                size="sm"
                disabled={sendingToAccounting}
                onClick={handleSendToAccounting}
                className="gap-1.5"
              >
                {sendingToAccounting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Send to {accountingStatus?.displayName}</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="space-y-2 text-sm">
          {summary.lines.map((line, i) => (
            <div key={i} className="flex justify-between border-b border-border/30 pb-1">
              <span>{line.description} <span className="text-muted-foreground">x{line.quantity}</span></span>
              <span>{sym}{line.total.toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-border/30 pt-2 mt-2 space-y-1">
            {(summary.parts_total ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Parts Total</span>
                <span>{sym}{(summary.parts_total ?? 0).toFixed(2)}</span>
              </div>
            )}
            {(summary.labour_total ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Labour Total</span>
                <span>{sym}{(summary.labour_total ?? 0).toFixed(2)}</span>
              </div>
            )}
            {(summary.call_out_fee ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Call-out Fee</span>
                <span>{sym}{(summary.call_out_fee ?? 0).toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-medium">Subtotal</span>
            <span>{sym}{summary.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>VAT ({summary.vat_rate}%)</span>
            <span>{sym}{summary.vat_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Total</span>
            <span>{sym}{summary.total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

async function compressImageClient(file: File): Promise<File> {
  if (file.size < 500 * 1024) return file;
  if (!file.type.startsWith("image/")) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.8,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

function PhotosSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files, isLoading } = useListFiles({ entity_type: "job", entity_id: jobId });
  const deleteMutation = useDeleteFile();

  const imageFiles = (files || []).filter((f) => f.file_type?.startsWith("image/"));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const compressed = await compressImageClient(fileList[i]);
        const formData = new FormData();
        formData.append("file", compressed);
        formData.append("entity_type", "job");
        formData.append("entity_id", jobId);
        await customFetch(`${import.meta.env.BASE_URL}api/files/upload`, { method: "POST", body: formData });
      }
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Uploaded", description: `${fileList.length} photo(s) uploaded` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload Error", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Deleted", description: "Photo removed" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="font-bold text-lg flex items-center gap-2 text-violet-600 shrink-0">
          <Camera className="w-5 h-5" /> Photos
        </h3>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleUpload}
          />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-1" /> {uploading ? "Uploading..." : "Upload / Take Photo"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading photos...</p>
      ) : imageFiles.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>
            <Camera className="w-4 h-4 mr-1" /> Take or Upload Photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {imageFiles.map((file) => {
            const displayUrl = file.thumbnail_signed_url || file.signed_url;
            return (
              <div key={file.id} className="relative group rounded-lg overflow-hidden border bg-slate-100 aspect-square">
                {displayUrl ? (
                  <a href={file.signed_url || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img src={displayUrl} alt={file.file_name} className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(file.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                  {file.file_name}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function CommentsSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { isOnline, queueJobNote } = useOffline();
  const { data: notes, isLoading } = useListJobNotes(jobId);
  const createMutation = useCreateJobNote();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const sortedNotes = [...(notes || [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const handlePost = async () => {
    if (!newComment.trim()) return;

    if (!isOnline) {
      try {
        await queueJobNote(jobId, newComment.trim());
        setNewComment("");
        toast({ title: "Note saved offline", description: "It will sync when you're back online." });
      } catch {
        toast({ title: "Error", description: "Failed to save note offline", variant: "destructive" });
      }
      return;
    }

    try {
      await createMutation.mutateAsync({ jobId, data: { content: newComment.trim() } });
      setNewComment("");
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/notes`] });
      toast({ title: "Posted", description: "Comment added" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to post";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleEdit = async (noteId: string) => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      setEditingId(null);
      setEditContent("");
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/notes`] });
      toast({ title: "Updated", description: "Comment updated" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/notes/${noteId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/notes`] });
      toast({ title: "Deleted", description: "Comment removed" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const isOwn = (authorId: string) => profile?.id === authorId;
  const canDelete = (authorId: string) => isOwn(authorId) || profile?.role === "admin";

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-green-600">
        <MessageSquare className="w-5 h-5" /> Comments
      </h3>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      ) : sortedNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">No comments yet. Be the first to add one.</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {sortedNotes.map((note) => (
            <div key={note.id} className="border rounded-lg p-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{note.author_name || "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(note.created_at)}</span>
                  {note.updated_at !== note.created_at && <span className="text-xs text-muted-foreground italic">(edited)</span>}
                </div>
                <div className="flex gap-1">
                  {isOwn(note.author_id) && editingId !== note.id && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingId(note.id); setEditContent(note.content); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                  {canDelete(note.author_id) && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDeleteNote(note.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleEdit(note.id)} disabled={savingEdit || !editContent.trim()}>
                      <Check className="w-3 h-3 mr-1" /> {savingEdit ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[60px] text-sm flex-1"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && newComment.trim()) { e.preventDefault(); handlePost(); } }}
        />
        <Button size="sm" className="self-end" onClick={handlePost} disabled={createMutation.isPending || !newComment.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

function ReturnVisitForm({ job, onClose, onScheduled }: { job: { id: string; status: string; scheduled_date: string }; onClose: () => void; onScheduled: () => void }) {
  const update = useUpdateJob();
  const createNote = useCreateJobNote();
  const { toast } = useToast();
  const { isOnline, queueJobUpdate, queueJobNote } = useOffline();
  const [submitting, setSubmitting] = useState(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const [returnDate, setReturnDate] = useState(tomorrowStr);
  const [returnTime, setReturnTime] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const handleSchedule = async () => {
    if (!returnDate) {
      toast({ title: "Missing date", description: "Please select a return visit date.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const noteContent = returnNotes.trim()
        ? `Return visit scheduled for ${returnDate}${returnTime ? ` at ${returnTime}` : ""}. Reason: ${returnNotes.trim()}`
        : `Return visit scheduled for ${returnDate}${returnTime ? ` at ${returnTime}` : ""} (previously ${job.status.replace(/_/g, " ")}).`;

      if (!isOnline) {
        await queueJobNote(job.id, noteContent);
        await queueJobUpdate(job.id, {
          status: "scheduled",
          scheduled_date: returnDate,
          scheduled_time: returnTime || undefined,
        });
        toast({ title: "Queued offline", description: "Return visit will sync when online." });
        onScheduled();
        return;
      }

      await createNote.mutateAsync({
        jobId: job.id,
        data: { content: noteContent },
      });
      await update.mutateAsync({
        id: job.id,
        data: {
          status: "scheduled" as "scheduled" | "in_progress" | "completed" | "cancelled" | "requires_follow_up" | "awaiting_parts" | "invoiced",
          scheduled_date: returnDate,
          scheduled_time: returnTime || undefined,
        },
      });
      toast({ title: "Return visit scheduled", description: `Job rescheduled for ${returnDate}${returnTime ? ` at ${returnTime}` : ""}.` });
      onScheduled();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to schedule return visit";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 border-blue-200 bg-blue-50/50 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <CalendarPlus className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-lg">Schedule Return Visit</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Set a new date for the return visit. The job will be moved back to "Scheduled" status. All existing time entries and notes are preserved.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="space-y-1.5">
          <Label>Return Date *</Label>
          <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Time</Label>
          <Input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label>Reason / Notes</Label>
          <Input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="e.g. Waiting for PCB board delivery" />
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleSchedule} disabled={submitting || !returnDate} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          {submitting ? "Scheduling..." : "Schedule Return Visit"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function EditJobForm({ job, onClose, onEmailSent }: { job: JobLike; onClose: () => void; onEmailSent?: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateJob();
  const { toast } = useToast();
  const { isOnline, queueJobUpdate } = useOffline();
  const { register, handleSubmit, reset } = useForm<JobEditData>();
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);

  const customerEmail = (job.customer as Record<string, unknown>)?.email as string || "";
  const customerName = `${(job.customer as Record<string, unknown>)?.first_name || ""} ${(job.customer as Record<string, unknown>)?.last_name || ""}`.trim();

  useEffect(() => {
    reset({
      status: job.status,
      priority: job.priority,
      scheduled_date: (job.scheduled_date as string)?.split('T')[0] || "",
      scheduled_end_date: (job.scheduled_end_date as string)?.split('T')[0] || "",
      scheduled_time: (job.scheduled_time as string) || "",
      estimated_duration: job.estimated_duration != null ? String(job.estimated_duration) : "",
      description: (job.description as string) || "",
    });
  }, [job, reset]);

  const handleSendConfirmation = async () => {
    setSendingConfirmation(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${job.id}/send-confirmation`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send confirmation email");
      }
      toast({ title: "Email sent", description: `Confirmation sent to ${customerEmail}` });
      setShowEmailPrompt(false);
      onEmailSent?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      toast({ title: "Email error", description: message, variant: "destructive" });
    } finally {
      setSendingConfirmation(false);
    }
  };

  const onSubmit = async (data: JobEditData) => {
    try {
      const updatePayload = {
        status: data.status,
        priority: data.priority,
        scheduled_date: data.scheduled_date,
        scheduled_end_date: data.scheduled_end_date || null,
        scheduled_time: data.scheduled_time || undefined,
        estimated_duration: data.estimated_duration ? Number(data.estimated_duration) : undefined,
        description: data.description || undefined,
      };

      if (!isOnline) {
        await queueJobUpdate(job.id, updatePayload);
        toast({ title: "Queued offline", description: "Job update will sync when online." });
        onClose();
        return;
      }

      await update.mutateAsync({
        id: job.id,
        data: {
          status: data.status as "scheduled" | "in_progress" | "completed" | "cancelled" | "requires_follow_up" | "awaiting_parts" | "invoiced",
          priority: data.priority as "low" | "medium" | "high" | "urgent",
          scheduled_date: data.scheduled_date,
          scheduled_end_date: data.scheduled_end_date || null,
          scheduled_time: data.scheduled_time || undefined,
          estimated_duration: data.estimated_duration ? Number(data.estimated_duration) : undefined,
          description: data.description || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/schedule-history`] });
      toast({ title: "Updated", description: "Job updated successfully" });
      if (customerEmail) {
        setShowEmailPrompt(true);
      } else {
        onClose();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  if (showEmailPrompt) {
    return (
      <Card className="p-6 border-primary/20 shadow-lg">
        <h3 className="font-bold text-lg mb-4">Send Updated Confirmation?</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <Mail className="w-8 h-8 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Would you like to send an updated booking confirmation email to the customer?
              </p>
              <div className="mt-2 text-sm text-muted-foreground space-y-1">
                <p><strong>To:</strong> {customerName}</p>
                <p><strong>Email:</strong> {customerEmail}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSendConfirmation} disabled={sendingConfirmation} className="gap-2">
              <Send className="w-4 h-4" />
              {sendingConfirmation ? "Sending..." : "Send Confirmation"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={sendingConfirmation}>
              Skip
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-primary/20 shadow-lg">
      <h3 className="font-bold text-lg mb-4">Edit Job</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("status")}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="requires_follow_up">Requires Follow-up</option>
              <option value="awaiting_parts">Awaiting Parts</option>
              <option value="invoiced">Invoiced</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("priority")}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Scheduled Date</Label>
            <Input type="date" {...register("scheduled_date")} required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>End Date <span className="text-muted-foreground">(multi-day)</span></Label>
            <Input type="date" {...register("scheduled_end_date")} />
          </div>
          <div className="space-y-2">
            <Label>Scheduled Time</Label>
            <Input type="time" {...register("scheduled_time")} />
          </div>
          <div className="space-y-2">
            <Label>Estimated Duration</Label>
            <Input {...register("estimated_duration")} placeholder="e.g. 1 hour" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("description")} />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={update.isPending}>
            <Check className="w-4 h-4 mr-2" /> {update.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

interface CompletedForm {
  form_type: string;
  form_label: string;
  form_id: string;
}

function EmailFormsModal({ jobId, customerEmail, customerName, onClose, onSent }: { jobId: string; customerEmail: string; customerName: string; onClose: () => void; onSent: () => void }) {
  const { toast } = useToast();
  const [to, setTo] = useState(customerEmail);
  const [cc, setCc] = useState("");
  const [completedForms, setCompletedForms] = useState<CompletedForm[]>([]);
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [loadingForms, setLoadingForms] = useState(true);

  const { data: files } = useListFiles({ entity_type: "job", entity_id: jobId });
  const photos = (files || []).filter((f) => f.file_type?.startsWith("image/"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/completed-forms`);
        if (!cancelled) {
          const forms = data as CompletedForm[];
          setCompletedForms(forms);
          setSelectedForms(new Set(forms.map(f => f.form_id)));
        }
      } catch {
        if (!cancelled) toast({ title: "Error", description: "Failed to load completed forms", variant: "destructive" });
      } finally {
        if (!cancelled) setLoadingForms(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  const toggleForm = (formId: string) => {
    setSelectedForms(prev => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId); else next.add(formId);
      return next;
    });
  };

  const togglePhoto = (photoId: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId); else next.add(photoId);
      return next;
    });
  };

  const selectAllForms = () => {
    if (selectedForms.size === completedForms.length) {
      setSelectedForms(new Set());
    } else {
      setSelectedForms(new Set(completedForms.map(f => f.form_id)));
    }
  };

  const selectAllPhotos = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const totalSelected = selectedForms.size + selectedPhotos.size;

  const handleSend = async () => {
    if (!to) { toast({ title: "Error", description: "Recipient email is required", variant: "destructive" }); return; }
    if (totalSelected === 0) { toast({ title: "Error", description: "Select at least one form or photo to send", variant: "destructive" }); return; }
    setSending(true);
    try {
      const formsPayload = completedForms.filter(f => selectedForms.has(f.form_id)).map(f => ({ form_type: f.form_type, form_id: f.form_id }));
      const photoIdsPayload = photos.filter(p => selectedPhotos.has(p.id)).map(p => p.id);
      const result = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/email-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          cc: cc || undefined,
          forms: formsPayload.length > 0 ? formsPayload : undefined,
          photo_ids: photoIdsPayload.length > 0 ? photoIdsPayload : undefined,
        }),
      }) as Record<string, unknown>;
      const parts: string[] = [];
      if (selectedForms.size > 0) parts.push(`${selectedForms.size} form(s)`);
      if (selectedPhotos.size > 0) parts.push(`${selectedPhotos.size} photo(s)`);
      const desc = `${parts.join(" and ")} emailed to ${to}`;
      if (result.warning) {
        toast({ title: "Email Sent (with warnings)", description: `${desc}. ${result.warning}`, variant: "default" });
      } else {
        toast({ title: "Email Sent", description: desc });
      }
      onSent();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send email";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendLabel = () => {
    if (sending) return "Sending...";
    const parts: string[] = [];
    if (selectedForms.size > 0) parts.push(`${selectedForms.size} Form${selectedForms.size !== 1 ? "s" : ""}`);
    if (selectedPhotos.size > 0) parts.push(`${selectedPhotos.size} Photo${selectedPhotos.size !== 1 ? "s" : ""}`);
    return `Send ${parts.join(" & ") || "0 Items"}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 bg-background">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><Mail className="w-5 h-5" /> Email to Customer</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {customerName && <p className="text-sm text-muted-foreground mb-4">Sending to <strong>{customerName}</strong></p>}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>To (Email)</Label>
            <Input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="customer@example.com" />
          </div>
          <div className="space-y-2">
            <Label>CC (optional)</Label>
            <Input type="email" value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Completed Forms</Label>
              {completedForms.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={selectAllForms}>
                  {selectedForms.size === completedForms.length ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>
            {loadingForms ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">Loading forms...</div>
            ) : completedForms.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center border border-border rounded-lg">No completed forms found for this job.</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                {completedForms.map(f => (
                  <label key={f.form_id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <input type="checkbox" checked={selectedForms.has(f.form_id)} onChange={() => toggleForm(f.form_id)} className="rounded border-border" />
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-sm">{f.form_label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Photos ({photos.length})</Label>
                <Button variant="ghost" size="sm" className="text-xs" onClick={selectAllPhotos}>
                  {selectedPhotos.size === photos.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2 border border-border rounded-lg p-2 max-h-48 overflow-y-auto">
                {photos.map(p => (
                  <label key={p.id} className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${selectedPhotos.has(p.id) ? "border-primary" : "border-transparent hover:border-muted-foreground/30"}`}>
                    <input type="checkbox" checked={selectedPhotos.has(p.id)} onChange={() => togglePhoto(p.id)} className="sr-only" />
                    <img
                      src={p.thumbnail_signed_url || p.signed_url || ""}
                      alt={p.file_name || "Photo"}
                      className="w-full aspect-square object-cover"
                    />
                    {selectedPhotos.has(p.id) && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSend} disabled={sending || totalSelected === 0 || !to || loadingForms} className="flex-1">
              <Send className="w-4 h-4 mr-2" /> {sendLabel()}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface EmailLogEntry {
  id: string;
  sent_by_name: string | null;
  sent_to: string;
  cc: string | null;
  subject: string;
  forms_included: Array<{ form_type: string; form_label: string; form_id: string }>;
  created_at: string;
}

function EmailLogSection({ jobId, refreshKey }: { jobId: string; refreshKey: number }) {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/email-log`);
        if (!cancelled) setLogs(data as EmailLogEntry[]);
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId, refreshKey]);

  if (loading) return null;
  if (logs.length === 0) return null;

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm mt-6 max-w-full min-w-0">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-bold text-lg flex items-center gap-2 text-blue-600">
          <Mail className="w-5 h-5" /> Email Log ({logs.length})
        </h3>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {logs.map(entry => (
            <div key={entry.id} className="border border-border/50 rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{entry.sent_by_name || "Unknown"}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                To: {entry.sent_to}{entry.cc ? ` (CC: ${entry.cc})` : ""}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.forms_included.map((f, i) => (
                  <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{f.form_label}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function toLocalDatetimeStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calcDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function CreateFollowUpForm({ jobId, onClose, onCreated }: { jobId: string; onClose: () => void; onCreated: () => void }) {
  const [workDesc, setWorkDesc] = useState("");
  const [partsDesc, setPartsDesc] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partsDesc.trim()) {
      toast({ title: "Missing info", description: "Please describe the parts needed.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_job_id: jobId,
          work_description: workDesc.trim() || null,
          parts_description: partsDesc.trim(),
          expected_parts_date: expectedDate || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create follow-up");
      }
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create follow-up";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 border-2 border-indigo-200 bg-indigo-50/30 shadow-sm">
      <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-indigo-700">
        <ClipboardList className="w-5 h-5" /> Create Follow-Up Reminder
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Parts Needed *</Label>
          <Textarea
            value={partsDesc}
            onChange={(e) => setPartsDesc(e.target.value)}
            placeholder="e.g. Boiler PCB board, Model XYZ-123"
            rows={2}
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Expected Delivery Date</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Work to Complete</Label>
          <Textarea
            value={workDesc}
            onChange={(e) => setWorkDesc(e.target.value)}
            placeholder="Describe the follow-up work needed..."
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
            {submitting ? "Creating..." : "Create Follow-Up"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
