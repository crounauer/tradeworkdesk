import { useGetJob, useUpdateJob, useDeleteJob, useListFiles, useDeleteFile, useListJobNotes, useCreateJobNote, useListJobTimeEntries, useCreateJobTimeEntry, useDeleteJobTimeEntry, useUpdateJobTimeEntry, useGetJobCompletionReportByJob, useCreateAppliance, type JobDetail as JobDetailType } from "@workspace/api-client-react";
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
  ClipboardList, Wind, Clock, Camera, Upload, Trash2, Plus, Image as ImageIcon, Bookmark,
  MessageSquare, Send, Pencil, PoundSterling, Mail, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, RefreshCw, CalendarPlus, RotateCcw, AlertCircle, ExternalLink, WifiOff, CloudOff,
  Phone, Smartphone, Receipt, Download, Copy
} from "lucide-react";
import { useOffline } from "@/contexts/offline-context";
import { cacheJob, getCachedJob } from "@/lib/offline-db";
import { formatDateTime, formatDate } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
const PropertyMapPreview = lazy(() => import("@/components/property-map-preview"));
import { useCreateInvoice, useListInvoices, type InvoiceStatus } from "@/hooks/use-invoices";
import { useForm } from "react-hook-form";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useAutoAssign } from "@/hooks/use-auto-assign";
import { SmsSendDialog } from "@/components/sms-send-dialog";
import { RebookDialog } from "@/components/rebook-dialog";
import { PartsSection } from "@/components/line-items/parts-section";
import { ServicesSection } from "@/components/line-items/services-section";
import { TimeSection } from "@/components/line-items/time-section";
import type { CalloutRateOption, PartLine, ServiceLine, TimeLine } from "@/components/line-items/types";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type JobEditData = {
  status: string;
  priority: string;
  visit_intent?: "standard" | "estimate";
  scheduled_date: string;
  scheduled_end_date?: string;
  scheduled_time?: string;
  all_day?: boolean;
  estimated_duration?: string;
  description?: string;
  job_type_id?: string;
  fuel_category?: string;
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

const APPLIANCE_BOILER_TYPE_OPTIONS = [
  { value: "combi", label: "Combi" },
  { value: "system", label: "System" },
  { value: "regular", label: "Regular" },
  { value: "back_boiler", label: "Back Boiler" },
  { value: "boiler", label: "Boiler (Other)" },
  { value: "heat_pump", label: "Heat Pump" },
  { value: "water_heater", label: "Water Heater" },
  { value: "stove", label: "Stove" },
  { value: "fire", label: "Fire" },
  { value: "other", label: "Other" },
];

// Combi/System/Regular/Back Boiler only make sense for gas or oil appliances.
const BOILER_SPECIFIC_TYPES = ["combi", "system", "regular", "back_boiler"];

const APPLIANCE_FUEL_TYPE_OPTIONS = [
  { value: "gas", label: "Gas" },
  { value: "oil", label: "Oil" },
  { value: "lpg", label: "LPG" },
  { value: "electric", label: "Electric" },
  { value: "solid_fuel", label: "Solid Fuel" },
  { value: "other", label: "Other" },
];

const APPLIANCE_NOZZLE_SIZE_OPTIONS = [
  "0.40 60 EH", "0.40 80 EH", "0.45 60 EH", "0.45 80 EH", "0.50 60 EH", "0.50 80 EH", "0.55 60 EH", "0.55 80 EH",
  "0.60 60 EH", "0.60 80 EH", "0.65 60 EH", "0.65 80 EH", "0.75 60 EH", "0.75 80 EH", "0.85 60 EH", "0.85 80 EH",
  "1.00 60 EH", "1.00 80 EH", "1.10 60 EH", "1.10 80 EH",
  "0.40 60 ES", "0.40 80 ES", "0.45 60 ES", "0.45 80 ES", "0.50 60 ES", "0.50 80 ES", "0.55 60 ES", "0.55 80 ES",
  "0.60 60 ES", "0.60 80 ES", "0.65 60 ES", "0.65 80 ES", "0.75 60 ES", "0.75 80 ES", "0.85 60 ES", "0.85 80 ES",
  "1.00 60 ES", "1.00 80 ES", "1.10 60 ES", "1.10 80 ES",
  "0.30 60 H", "0.30 80 H", "0.35 60 H", "0.35 80 H", "0.40 60 H", "0.40 80 H", "0.45 60 H", "0.45 80 H",
  "0.50 45 H", "0.50 60 H", "0.50 80 H", "0.55 45 H", "0.55 60 H", "0.55 80 H", "0.60 45 H", "0.60 60 H",
  "0.60 80 H", "0.65 45 H", "0.65 60 H", "0.65 80 H", "0.75 45 H", "0.75 60 H", "0.75 80 H", "0.85 45 H",
  "0.85 60 H", "0.85 80 H", "1.00 45 H", "1.00 60 H", "1.00 80 H", "1.10 45 H", "1.10 60 H", "1.10 80 H",
  "1.20 45 H", "1.20 60 H", "1.20 80 H", "1.25 45 H", "1.25 60 H", "1.25 80 H", "1.35 45 H", "1.35 60 H",
  "1.35 80 H", "1.50 45 H", "1.50 60 H", "1.50 80 H", "1.65 45 H", "1.65 60 H", "1.65 80 H", "1.75 45 H",
  "1.75 60 H", "1.75 80 H", "2.00 45 H", "2.00 60 H", "2.00 80 H",
  "0.20 60 S", "0.25 60 S", "0.30 60 S", "0.30 80 S", "0.35 60 S", "0.35 80 S", "0.40 45 S", "0.40 60 S",
  "0.40 80 S", "0.45 45 S", "0.45 60 S", "0.45 80 S", "0.50 30 S", "0.50 45 S", "0.50 60 S", "0.50 80 S",
  "0.55 30 S", "0.55 45 S", "0.55 60 S", "0.55 80 S", "0.60 30 S", "0.60 45 S", "0.60 60 S", "0.60 80 S",
  "0.65 30 S", "0.65 45 S", "0.65 60 S", "0.65 80 S", "0.75 30 S", "0.75 45 S", "0.75 60 S", "0.75 80 S",
  "0.85 30 S", "0.85 45 S", "0.85 60 S", "0.85 80 S", "1.00 30 S", "1.00 45 S", "1.00 60 S", "1.00 80 S",
  "1.10 30 S", "1.10 45 S", "1.10 60 S", "1.10 80 S", "1.20 45 S", "1.20 60 S", "1.20 80 S", "1.25 30 S",
  "1.25 45 S", "1.25 60 S", "1.25 80 S", "1.35 30 S", "1.35 45 S", "1.35 60 S", "1.35 80 S", "1.50 30 S",
  "1.50 45 S", "1.50 60 S", "1.50 80 S", "1.65 30 S", "1.65 45 S", "1.65 60 S", "1.65 80 S", "1.75 30 S",
  "1.75 45 S", "1.75 60 S", "1.75 80 S", "2.00 30 S", "2.00 45 S", "2.00 60 S", "2.00 80 S",
  "Custom..."
];

type ApplianceCreateData = {
  manufacturer: string;
  model: string;
  serial_number: string;
  boiler_type: string;
  fuel_type: string;
  system_type: string;
  location: string;
  installation_date: string;
  next_service_due: string;
  warranty_expiry: string;
  nozzle_size: string;
  pump_pressure: string;
  notes: string;
};

function getJobTypeDisplay(job: JobLike): { label: string; isEstimate: boolean } {
  const label = String(job.job_type_name ?? job.job_type ?? "").replace(/_/g, " ").trim() || "Job";
  const intent = job.visit_intent;
  const isEstimate = intent === "estimate" || /\b(estimate|quote)\b/i.test(label);
  return { label, isEstimate };
}

function formatJobDuration(minutesLike: unknown): string {
  const minutes = Number(minutesLike);
  if (!Number.isFinite(minutes) || minutes <= 0) return "Not set";
  if (minutes % 60 === 0) return `${minutes} min (${minutes / 60}h)`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${minutes} min (${hours}h ${remainder}m)`;
}

interface JobPart {
  id: string;
  job_id: string;
  part_name: string;
  quantity: number;
  serial_number: string | null;
  unit_price: number | null;
  catalogue_item_id: string | null;
  status: "fitted" | "to_order";
  tenant_id: string;
  created_at: string;
}

interface JobService {
  id: string;
  job_id: string;
  service_name: string;
  quantity: number;
  unit_price: number | null;
  catalogue_item_id: string | null;
  tenant_id: string;
  created_at: string;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isOnline, queueJobUpdate, pendingMutations, failedMutations } = useOffline();
  const { data: onlineJob, isLoading } = useGetJob(id);
  const { data: completionReport } = useGetJobCompletionReportByJob(id!, { query: { enabled: !!id } } as any);
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
  const { currentUsers } = useAutoAssign();
  const { hasAddon } = usePlanFeatures();
  const [editing, setEditing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailLogRefresh, setEmailLogRefresh] = useState(0);
  const [smsLogRefresh, setSmsLogRefresh] = useState(0);
  const [pricingRefresh, setPricingRefresh] = useState(0);
  const [showReturnVisit, setShowReturnVisit] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [cachedJob, setCachedJob] = useState<Record<string, unknown> | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpPartsDefault, setFollowUpPartsDefault] = useState(false);
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  const [showRebook, setShowRebook] = useState(false);
  const [hasRebookBeenUsedLocal, setHasRebookBeenUsedLocal] = useState(false);
  const [sendingCertificate, setSendingCertificate] = useState(false);
  const [showExtraForms, setShowExtraForms] = useState(false);
  const [downloadingCp12, setDownloadingCp12] = useState(false);
  const [showAddAppliance, setShowAddAppliance] = useState(false);
  const createAppliance = useCreateAppliance();
  const { register: registerAppliance, handleSubmit: handleSubmitAppliance, reset: resetAppliance, watch: watchAppliance, setValue: setApplianceValue } = useForm<ApplianceCreateData>({
    defaultValues: {
      manufacturer: "",
      model: "",
      serial_number: "",
      boiler_type: "regular",
      fuel_type: "gas",
      system_type: "",
      location: "",
      installation_date: "",
      next_service_due: "",
      warranty_expiry: "",
      nozzle_size: "",
      pump_pressure: "",
      notes: "",
    },
  });
  const [customApplianceNozzle, setCustomApplianceNozzle] = useState("");
  const applianceNozzleValue = watchAppliance("nozzle_size") || "";
  const applianceFuelTypeValue = watchAppliance("fuel_type") || "";
  const applianceBoilerTypeValue = watchAppliance("boiler_type") || "";
  const visibleBoilerTypeOptions = APPLIANCE_BOILER_TYPE_OPTIONS.filter(
    (opt) => !BOILER_SPECIFIC_TYPES.includes(opt.value) || applianceFuelTypeValue === "gas" || applianceFuelTypeValue === "oil"
  );

  useEffect(() => {
    if (applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue) && applianceNozzleValue !== "Custom...") {
      setCustomApplianceNozzle(applianceNozzleValue);
    }
  }, [applianceNozzleValue]);

  useEffect(() => {
    if (applianceBoilerTypeValue && BOILER_SPECIFIC_TYPES.includes(applianceBoilerTypeValue) && applianceFuelTypeValue !== "gas" && applianceFuelTypeValue !== "oil") {
      setApplianceValue("boiler_type", "");
    }
  }, [applianceFuelTypeValue, applianceBoilerTypeValue, setApplianceValue]);

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

  useEffect(() => {
    setHasRebookBeenUsedLocal(false);
  }, [id]);
  const effectiveJob = onlineJob || cachedJob;
  const isFromCache = !onlineJob && !!cachedJob;
  const job = effectiveJob ? (effectiveJob as unknown as JobDetailType) : null;

  const jobHasPendingSync = [...pendingMutations, ...failedMutations].some(
    (m) => (m.type === "update-job" || m.type === "create-job-note" || m.type === "create-time-entry" || m.type === "create-job-part") && m.payload.jobId === id
  );

  const customerEmail = (job?.customer as unknown as Record<string, unknown> | undefined)?.email as string || "";
  const jobRecord = (job ?? {}) as unknown as Record<string, unknown>;
  const { data: jobTypesData } = useQuery<Array<{ id: string; name: string; is_active: boolean }>>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/job-type-options`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!job,
  });
  const isOperationalInProgress = job?.status === "in_progress";
  const isOperationalAwaitingParts = job?.status === "awaiting_parts";
  const { label: jobTypeLabel } = getJobTypeDisplay(jobRecord as JobLike);
  const serviceCatalogueId = typeof jobRecord.service_catalogue_id === "string" ? jobRecord.service_catalogue_id : null;
  const selectedJobTypeName = serviceCatalogueId
    ? (jobTypesData || []).find((jt) => jt.id === serviceCatalogueId)?.name
    : null;
  const resolvedJobTypeLabel = selectedJobTypeName || jobTypeLabel;
  const visitIntent = typeof jobRecord.visit_intent === "string" ? jobRecord.visit_intent : null;
  const displayVisitIntent = visitIntent === "estimate"
    ? "Estimate"
    : visitIntent === "standard"
      ? "Standard"
      : /\b(estimate|quote)\b/i.test(resolvedJobTypeLabel)
        ? "Estimate"
        : "Standard";
  const rawPriority = typeof jobRecord.priority === "string" ? jobRecord.priority : "medium";
  const displayPriority = String(rawPriority)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  const isAllDayJob = jobRecord.estimated_duration == null;
  const displayDuration = isAllDayJob ? "All day" : formatJobDuration(jobRecord.estimated_duration);
  const completionDate = jobRecord.status === "completed" && typeof jobRecord.updated_at === "string"
    ? new Date(jobRecord.updated_at)
    : null;
  const completionDateLabel = completionDate && Number.isFinite(completionDate.getTime())
    ? `Completed ${formatDate(completionDate.toISOString().slice(0, 10))}`
    : null;
  const jobRef = typeof jobRecord.job_ref === "string" ? jobRecord.job_ref : null;
  const customerRecord = (jobRecord.customer as Record<string, unknown> | undefined) || undefined;
  const customerDisplayName = `${String(customerRecord?.first_name || "")} ${String(customerRecord?.last_name || "")}`.trim() || "Customer";
  const scheduledDateOnly = String(jobRecord.scheduled_date || "").slice(0, 10);
  const scheduledEndDateOnly = typeof jobRecord.scheduled_end_date === "string" ? String(jobRecord.scheduled_end_date).slice(0, 10) : null;
  const scheduledTime = typeof jobRecord.scheduled_time === "string" ? jobRecord.scheduled_time : null;
  const scheduledSummary = scheduledDateOnly
    ? (scheduledTime
      ? formatDateTime(`${scheduledDateOnly}T${scheduledTime}`)
      : formatDate(scheduledDateOnly))
    : "Date not set";
  const displayScheduledSummary = (() => {
    if (!scheduledDateOnly) return "Date not set";
    const start = formatDate(scheduledDateOnly);
    const end = scheduledEndDateOnly && scheduledEndDateOnly !== scheduledDateOnly ? formatDate(scheduledEndDateOnly) : null;
    if (isAllDayJob) {
      return end ? `${start} – ${end} (All day)` : `${start} (All day)`;
    }
    if (end) {
      return `${start} – ${end}`;
    }
    return scheduledTime ? formatDateTime(`${scheduledDateOnly}T${scheduledTime}`) : start;
  })();
  const fromQuoteId = typeof jobRecord.from_quote_id === "string" ? jobRecord.from_quote_id : null;
  const customerConfirmationStatus =
    typeof jobRecord.customer_confirmation_status === "string"
      ? jobRecord.customer_confirmation_status
      : null;
  const customerConfirmedAt =
    typeof jobRecord.customer_confirmed_at === "string"
      ? jobRecord.customer_confirmed_at
      : null;
  const customerChangeRequestedAt =
    typeof jobRecord.customer_change_requested_at === "string"
      ? jobRecord.customer_change_requested_at
      : null;

  const customerConfirmationUi = (() => {
    switch (customerConfirmationStatus) {
      case "confirmed":
        return {
          label: "Customer Confirmed",
          classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
          timestamp: customerConfirmedAt,
          timestampLabel: "Confirmed",
          icon: CheckCircle2,
        };
      case "change_requested":
        return {
          label: "Customer Requested Change",
          classes: "bg-amber-100 text-amber-800 border-amber-200",
          timestamp: customerChangeRequestedAt,
          timestampLabel: "Requested",
          icon: RefreshCw,
        };
      case "pending":
      default:
        return {
          label: "Awaiting customer booking confirmation",
          classes: "bg-slate-100 text-slate-700 border-slate-200",
          timestamp: null,
          timestampLabel: "",
          icon: Clock,
        };
    }
  })();

  const handleSendConfirmationDirect = async () => {
    setSendingConfirmation(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${job!.id}/send-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          override_email: confirmationEmail.trim() !== customerEmail ? confirmationEmail.trim() : undefined,
          personal_message: confirmationMessage.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send confirmation email");
      }
      const body = await res.json().catch(() => ({}));
      toast({ title: "Email sent", description: `Appointment confirmation sent to ${body.sent_to || confirmationEmail}` });
      setConfirmationOpen(false);
      setConfirmationMessage("");
      setEmailLogRefresh(k => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      toast({ title: "Email error", description: message, variant: "destructive" });
    } finally {
      setSendingConfirmation(false);
    }
  };

  const handleStatusChange = async (newStatus: string, label: string): Promise<boolean> => {
    try {
      if (!isOnline) {
        await queueJobUpdate(job!.id, { status: newStatus });
        toast({ title: "Queued offline", description: `Status change to "${label}" will sync when online.` });
        return false;
      }
      await updateJob.mutateAsync({
        id: job!.id,
        data: {
          status: newStatus as "scheduled" | "in_progress" | "completed" | "cancelled" | "requires_follow_up" | "awaiting_parts" | "invoiced" | "follow_up_scheduled",
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job!.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Status Updated", description: `Job marked as ${label}` });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      toast({ title: "Error", description: msg, variant: "destructive" });
      return false;
    }
  };

  // Records the unfinished visit, then offers to raise the follow-up in one go.
  const handleVisitOutcome = async () => {
    const ok = await handleStatusChange("requires_follow_up", "Requires Follow-up");
    if (!ok) return;
    if (isOfficeOrAdmin && !hasFollowUpLabel) {
      setFollowUpPartsDefault(false);
      setShowFollowUpForm(true);
    }
  };

  const handleEmailCertificate = async () => {
    if (!isOnline) {
      toast({ title: "Offline", description: "Email certificate requires an internet connection.", variant: "destructive" });
      return;
    }
    setSendingCertificate(true);
    try {
      const res = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${job!.id}/email-certificate`, { method: "POST" }) as { success: boolean; message: string; forms_sent: string[] };
      toast({ title: "Certificate sent", description: res.message || "Certificate emailed to customer." });
      setEmailLogRefresh(k => k + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send certificate";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSendingCertificate(false);
    }
  };

  const handleDownloadCp12 = async () => {
    const srForm = (completedForms || []).find(f => f.form_type === "service_record");
    if (!srForm) return;
    setDownloadingCp12(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${job!.id}/forms/service_record/${srForm.form_id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fuelCat = (job as unknown as { fuel_category?: string | null }).fuel_category;
      const label = (fuelCat === "gas" || fuelCat === "lpg") ? "cp12" : "service-record";
      a.download = `${label}-${jobRef || job!.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to download PDF";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setDownloadingCp12(false);
    }
  };

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isOfficeOrAdmin = isAdmin || profile?.role === "office_staff";
  const isReturnVisitPending = job?.status === "follow_up_scheduled";
  const canComplete = job ? job.status !== "completed" && job.status !== "invoiced" && job.status !== "cancelled" && !isReturnVisitPending : false;
  const canInvoice = job?.status === "completed";
  const canCreateFollowUp = !!job && isOfficeOrAdmin && (job.status === "completed" || job.status === "invoiced" || job.status === "awaiting_parts" || job.status === "requires_follow_up");

  const expectedRebookDate = (() => {
    const raw = String(job?.scheduled_date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
    const d = new Date(`${raw}T00:00:00`);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const customerId = typeof jobRecord.customer_id === "string" ? jobRecord.customer_id : "";
  const propertyId = typeof jobRecord.property_id === "string" ? jobRecord.property_id : "";

  const { data: hasYearRebookScheduled = false } = useQuery({
    queryKey: ["job-rebook-indicator", job?.id ?? id ?? "", expectedRebookDate],
    enabled: isAdmin
      && !!job?.id
      && !!expectedRebookDate
      && !!customerId
      && !!propertyId,
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          customer_id: customerId,
          property_id: propertyId,
          date_from: expectedRebookDate,
          date_to: expectedRebookDate,
          limit: "50",
        });
        const data = await customFetch(
          `${import.meta.env.BASE_URL}api/jobs?${params.toString()}`
        ) as { jobs?: Array<{ id: string; status: string }> };
        return (data.jobs || []).some((j) => j.id !== job?.id && j.status !== "cancelled");
      } catch {
        return false;
      }
    },
    staleTime: 60_000,
  });
  const hasRebookBeenUsed = hasYearRebookScheduled || hasRebookBeenUsedLocal;

  const { data: followUpSummary } = useQuery({
    queryKey: ["job-follow-up-summary", job?.id ?? id ?? ""],
    enabled: !!job?.id,
    queryFn: async () => {
      const response = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${job!.id}/follow-ups/count`) as { has_follow_up?: boolean; count?: number };
      return response;
    },
    staleTime: 60_000,
  });
  const hasFollowUpLabel = Boolean(followUpSummary?.has_follow_up) || Number(followUpSummary?.count || 0) > 0;

  if (isLoading || loadingCache) return <div className="p-8">Loading job details...</div>;

  if (!job) return <div>Job not found{!isOnline ? " — this job hasn't been cached for offline viewing." : ""}</div>;

  const onAddAppliance = async (data: ApplianceCreateData) => {
    if (!propertyId) {
      toast({ title: "Property missing", description: "This job is not linked to a property.", variant: "destructive" });
      return;
    }

    try {
      const createdAppliance = await createAppliance.mutateAsync({
        data: {
          property_id: propertyId,
          manufacturer: data.manufacturer.trim() || undefined,
          model: data.model.trim() || undefined,
          serial_number: data.serial_number.trim() || undefined,
          boiler_type: data.boiler_type || undefined,
          fuel_type: data.fuel_type || undefined,
          system_type: data.system_type || undefined,
          location: data.location.trim() || undefined,
          installation_date: data.installation_date || undefined,
          next_service_due: data.next_service_due || undefined,
          warranty_expiry: data.warranty_expiry || undefined,
          nozzle_size: data.nozzle_size || undefined,
          pump_pressure: data.pump_pressure.trim() || undefined,
          notes: data.notes.trim() || undefined,
        },
      });

      await updateJob.mutateAsync({
        id: job.id,
        data: { appliance_id: createdAppliance.id },
      });

      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      qc.invalidateQueries({ queryKey: [`/api/properties/${propertyId}`] });
      qc.invalidateQueries({ queryKey: ["/api/appliances"] });
      setShowAddAppliance(false);
      resetAppliance();
      toast({ title: "Appliance added", description: "The appliance has been created and linked to this job." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add appliance";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20 max-w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
          </Link>
          <Link href="/schedule" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
            <Calendar className="w-4 h-4 mr-1" /> Back to Schedule
          </Link>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span>{jobRef ? `Ref ${jobRef}` : `Ref #${job.id.slice(0, 8)}`}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(jobRef || job.id.slice(0, 8));
                toast({ title: "Copied", description: "Job reference copied" });
              } catch {
                toast({ title: "Copy failed", description: "Could not copy job reference", variant: "destructive" });
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      </div>

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
            <h1 className="text-2xl sm:text-3xl font-display font-bold truncate">{customerDisplayName} • {resolvedJobTypeLabel}</h1>
            {hasFollowUpLabel && (
              <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">Follow-Up</span>
            )}
            {isOperationalInProgress && (
              <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">In Progress</span>
            )}
            {isOperationalAwaitingParts && (
              <span className="inline-flex items-center rounded-md border border-orange-200 bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">Awaiting Parts</span>
            )}
            {job.status === "requires_follow_up" && (
              <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">Return Visit Required</span>
            )}
            {job.status === "follow_up_scheduled" && (
              <span className="inline-flex items-center rounded-md border border-teal-200 bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">Return Visit Scheduled</span>
            )}
            {isAllDayJob && (
              <span className="inline-flex items-center rounded-md border border-cyan-200 bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">All Day</span>
            )}
          </div>
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{displayScheduledSummary}</span>
            {!isAllDayJob && <span>{displayDuration}</span>}
            {completionDateLabel && <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{completionDateLabel}</span>}
          </div>
          {fromQuoteId && (
            <button
              className="text-sm text-muted-foreground hover:text-primary mb-1 text-left"
              onClick={() => navigate(`/invoices/${fromQuoteId}`)}
            >
              From Quote →
            </button>
          )}
          <div className="mt-2 flex flex-col items-start gap-1 text-xs sm:flex-row sm:items-center sm:gap-2 sm:text-sm">
            <span className={`inline-flex items-center rounded-md border px-2.5 py-1 font-semibold ${customerConfirmationUi.classes}`}>
              <customerConfirmationUi.icon className="mr-1 h-3.5 w-3.5 shrink-0" />
              <span>{customerConfirmationUi.label}</span>
            </span>
            {customerConfirmationUi.timestamp && (
              <span className="inline-flex items-start gap-1 text-muted-foreground leading-tight sm:items-center">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" />
                <span className="break-words">
                  <span className="sm:hidden">
                    {customerConfirmationUi.timestampLabel}: {timeAgo(customerConfirmationUi.timestamp)}
                  </span>
                  <span className="hidden sm:inline">
                    {customerConfirmationUi.timestampLabel}: {formatDateTime(customerConfirmationUi.timestamp)}
                  </span>
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canComplete && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleStatusChange("completed", "Complete")} disabled={updateJob.isPending}>
              <ClipboardCheck className="w-4 h-4 mr-2" /> Mark Complete
            </Button>
          )}
          {canComplete && job.status !== "requires_follow_up" && (
            <Button size="sm" variant="outline" className="border-indigo-300 text-indigo-800 hover:bg-indigo-50" onClick={handleVisitOutcome} disabled={updateJob.isPending}>
              <CalendarPlus className="w-4 h-4 mr-2" /> Needs Another Visit
            </Button>
          )}
          {(job.status === "completed" || job.status === "awaiting_parts" || job.status === "requires_follow_up" || job.status === "follow_up_scheduled" || (job.status === "cancelled" && isOfficeOrAdmin)) && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowReturnVisit(!showReturnVisit)} disabled={updateJob.isPending}>
              <CalendarPlus className="w-4 h-4 mr-2" /> {job.status === "cancelled" ? "Reschedule Job" : "Schedule Return Visit"}
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
                  <AlertDialogTitle>Reopen Job {jobRef || `#${job.id.slice(0, 8)}`}?</AlertDialogTitle>
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
          {canCreateFollowUp && !hasFollowUpLabel && (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowFollowUpForm(true)}>
              <ClipboardList className="w-4 h-4 mr-2" /> Create Follow-Up
            </Button>
          )}
          {completedForms && completedForms.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleEmailCertificate} disabled={sendingCertificate || !isOnline}>
              {sendingCertificate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Email Certificate
            </Button>
          )}
          {completedFormTypes.has("service_record") && (
            <Button variant="outline" size="sm" onClick={handleDownloadCp12} disabled={downloadingCp12}>
              {downloadingCp12 ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {(job as unknown as { fuel_category?: string | null }).fuel_category === "gas" ? "CP12 PDF" : "Service Record PDF"}
            </Button>
          )}
          {isAdmin && !isReturnVisitPending && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowRebook(true)}
              disabled={!isOnline}
            >
              {hasRebookBeenUsed ? <CheckCircle2 className="w-4 h-4 mr-2 text-white" /> : <Copy className="w-4 h-4 mr-2" />}
              {hasRebookBeenUsed ? "Rebooked (1yr)" : "Rebook (1yr)"}
            </Button>
          )}
          {isAdmin && !isReturnVisitPending && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Job {jobRef || `#${job.id.slice(0, 8)}`}?</AlertDialogTitle>
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
          defaultPartsRequired={followUpPartsDefault}
          onClose={() => { setShowFollowUpForm(false); setFollowUpPartsDefault(false); }}
          onCreated={() => {
            setShowFollowUpForm(false);
            setFollowUpPartsDefault(false);
            setCreatingFollowUp(false);
            qc.invalidateQueries({ queryKey: ["job-follow-up-summary", job.id] });
            qc.invalidateQueries({ queryKey: ["follow-ups"] });
            qc.invalidateQueries({ queryKey: ["homepage"] });
            qc.invalidateQueries({ queryKey: ["me-init"] });
            toast({ title: "Follow-up created", description: "The follow-up reminder has been saved." });
          }}
        />
      )}

      {editing ? (
        <EditJobForm
          job={job as unknown as JobLike}
          onClose={() => setEditing(false)}
          onEmailSent={() => setEmailLogRefresh(k => k + 1)}
          onFollowUpRequested={() => {
            setEditing(false);
            setShowFollowUpForm(true);
          }}
        />
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
                <button
                  className="text-primary hover:text-primary/80 flex-shrink-0"
                  title="Navigate"
                  onClick={() => {
                    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const hasCoords = job.property?.latitude != null && job.property?.longitude != null;
                    if (hasCoords) {
                      if (isIos) {
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
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </Card>
        <div className="grid lg:grid-cols-3 gap-6 max-w-full min-w-0">
          <div className="lg:col-span-2 space-y-6 min-w-0">
            <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="font-bold text-lg">Job Information</h3>
                <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                  {editing ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Edit className="w-4 h-4 mr-2"/> Edit Job</>}
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-4 h-4"/> Scheduled</p>
                  <p className="font-medium text-foreground">{displayScheduledSummary}</p>
                </div>
                {currentUsers > 1 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><User className="w-4 h-4"/> Technician</p>
                  <p className="font-medium text-foreground">{job.technician?.full_name || 'Unassigned'}</p>
                </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><ClipboardList className="w-4 h-4"/> Job Type</p>
                  <p className="font-medium text-foreground">{resolvedJobTypeLabel}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Job Intent</p>
                  <p className="font-medium text-foreground">{displayVisitIntent}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Bookmark className="w-4 h-4"/> Priority</p>
                  <p className="font-medium text-foreground">{displayPriority}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-4 h-4"/> Job Duration</p>
                  <p className="font-medium text-foreground">{displayDuration}</p>
                </div>
                <div className="sm:col-span-2 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground whitespace-pre-wrap">{job.description || 'No description provided.'}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)}>
                  <Mail className="w-4 h-4 mr-2" /> Email Customer
                </Button>
                {(profile?.role === "admin" || profile?.role === "office_staff") && customerEmail && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => { setConfirmationEmail(customerEmail); setConfirmationMessage(""); setConfirmationOpen(true); }}
                  >
                    <Mail className="w-4 h-4" />
                    Email Appointment Confirmation
                  </Button>
                )}
                {hasAddon("sms_messaging") && (job.customer?.phone || job.customer?.mobile) && (
                  <Button variant="outline" size="sm" onClick={() => setShowSms(true)}>
                    <MessageSquare className="w-4 h-4 mr-2" /> Send SMS
                  </Button>
                )}
              </div>
              {isAdmin && job.scheduled_date && (
                <RebookDialog
                  open={showRebook}
                  onOpenChange={setShowRebook}
                  jobId={job.id}
                  originalDate={String(job.scheduled_date).slice(0, 10)}
                  originalTime={job.scheduled_time ? String(job.scheduled_time) : null}
                  onRebooked={() => setHasRebookBeenUsedLocal(true)}
                />
              )}
            </Card>

            <TimeAttendedSection jobId={job.id} calloutRateId={(job as unknown as Record<string, unknown>).callout_rate_id as string | null} legacyArrival={(job as unknown as Record<string, unknown>).arrival_time as string | null} legacyDeparture={(job as unknown as Record<string, unknown>).departure_time as string | null} onChanged={() => setPricingRefresh(k => k + 1)} />

            <ScheduleHistorySection jobId={job.id} />

            <PartsUsedSection jobId={job.id} onChanged={() => setPricingRefresh(k => k + 1)} />

            <ServicesUsedSection jobId={job.id} onChanged={() => setPricingRefresh(k => k + 1)} />

            {(profile?.role === "admin" || profile?.role === "office_staff") && (
              <PricingSummarySection jobId={job.id} jobStatus={job.status} externalInvoiceId={job.external_invoice_id} externalInvoiceProvider={job.external_invoice_provider} externalInvoiceSentAt={job.external_invoice_sent_at} refreshKey={pricingRefresh} />
            )}

            <PhotosSection jobId={job.id} />

            <CommentsSection jobId={job.id} />

            {(() => {
              const effectiveFuel = (job as unknown as { fuel_category?: string | null }).fuel_category || null;
              const isGeneral = effectiveFuel === "general" || !effectiveFuel;
              const showGasForms = !isGeneral && (effectiveFuel === "gas" || effectiveFuel === "lpg");
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

                    {(showGasForms || showHeatPumpForms || showOilForms) && (
                      <Link href={`/jobs/${job.id}/dhw-cylinder-commissioning`}>
                        <Card className={`p-5 flex items-center gap-4 hover:border-cyan-600 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("dhw_cylinder_commissioning_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-cyan-50/50 to-white"}`}>
                          <div className={`p-3 rounded-xl ${completedFormTypes.has("dhw_cylinder_commissioning_record") ? "bg-emerald-500 text-white" : "bg-cyan-100 text-cyan-700"}`}><Droplets className="w-6 h-6"/></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold">DHW Cylinder Commissioning</h4>
                              {completedFormTypes.has("dhw_cylinder_commissioning_record") && <Check className="w-4 h-4 text-emerald-600" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{completedFormTypes.has("dhw_cylinder_commissioning_record") ? "Completed - tap to view or edit" : "Unvented and DHW cylinder commissioning"}</p>
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
                        <Link href={`/jobs/${job.id}/oil-service-record`}>
                          <Card className={`p-5 flex items-center gap-4 hover:border-amber-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has("service_record") ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-amber-50/50 to-white"}`}>
                            <div className={`p-3 rounded-xl ${completedFormTypes.has("service_record") ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-600"}`}><Wrench className="w-6 h-6" /></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold">Oil Service Record</h4>
                                {completedFormTypes.has("service_record") && <Check className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <p className="text-sm text-muted-foreground">{completedFormTypes.has("service_record") ? "Completed — tap to view or edit" : "Oil boiler service form"}</p>
                            </div>
                          </Card>
                        </Link>

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

                  {/* Add Form picker */}
                  {(() => {
                    const formRequestBody = [
                      "Form needed:",
                      "",
                      "Job context:",
                      `- Job ID: ${job.id}`,
                      `- Job type: ${resolvedJobTypeLabel}`,
                      `- Forms required: ${(job as unknown as { fuel_category?: string | null }).fuel_category || "unknown"}`,
                      "",
                      "Required fields:",
                      "- ",
                      "",
                      "Compliance / standards needed:",
                      "- ",
                      "",
                      "Notes / attachments:",
                      "- ",
                    ].join("\n");
                    const formRequestHref = `/support?prefill=form_request&category=feature_request&priority=normal&subject=${encodeURIComponent("Form Request: New Job Form")}&body=${encodeURIComponent(formRequestBody)}`;

                    const allFormDefs = [
                      { id: "oil-service-record", path: `/jobs/${job.id}/oil-service-record`, label: "Oil Service Record", desc: "Complete oil boiler service record", completedKey: "service_record", visibleByDefault: showOilForms },
                      { id: "breakdown-report", path: `/jobs/${job.id}/breakdown-report`, label: "Breakdown Report", desc: "Record faults and fixes", completedKey: "breakdown_report", visibleByDefault: true },
                      { id: "service-record", path: `/jobs/${job.id}/service-record`, label: "Service Record", desc: "Complete full inspection", completedKey: "service_record", visibleByDefault: showGasForms },
                      { id: "commissioning", path: `/jobs/${job.id}/commissioning`, label: "Commissioning Record", desc: "New installation commissioning", completedKey: "commissioning_record", visibleByDefault: showGasForms && job.job_type === "installation" },
                      { id: "job-completion", path: `/jobs/${job.id}/job-completion`, label: "Job Completion Report", desc: "Summarise work & sign-off", completedKey: "job_completion", visibleByDefault: true },
                      { id: "heat-pump-service", path: `/jobs/${job.id}/heat-pump-service`, label: "Heat Pump Service", desc: "Refrigerant, temps & COP readings", completedKey: "heat_pump_service_record", visibleByDefault: showHeatPumpForms },
                      { id: "heat-pump-commissioning", path: `/jobs/${job.id}/heat-pump-commissioning`, label: "Heat Pump Commissioning", desc: "MCS-style commissioning record", completedKey: "heat_pump_commissioning_record", visibleByDefault: showHeatPumpForms },
                      { id: "dhw-cylinder-commissioning", path: `/jobs/${job.id}/dhw-cylinder-commissioning`, label: "DHW Cylinder Commissioning", desc: "Unvented and DHW cylinder commissioning", completedKey: "dhw_cylinder_commissioning_record", visibleByDefault: showGasForms || showHeatPumpForms || showOilForms },
                      { id: "oil-tank-inspection", path: `/jobs/${job.id}/oil-tank-inspection`, label: "Oil Tank Inspection", desc: "Tank details & condition", completedKey: "oil_tank_inspection", visibleByDefault: showOilForms },
                      { id: "oil-tank-risk-assessment", path: `/jobs/${job.id}/oil-tank-risk-assessment`, label: "Oil Tank Risk Assessment", desc: "Hazards & risk ratings", completedKey: "oil_tank_risk_assessment", visibleByDefault: showOilForms },
                      { id: "combustion-analysis", path: `/jobs/${job.id}/combustion-analysis`, label: "Combustion Analysis", desc: "Flue gas readings & efficiency", completedKey: "combustion_analysis_record", visibleByDefault: showOilForms },
                      { id: "burner-setup", path: `/jobs/${job.id}/burner-setup`, label: "Burner Setup Record", desc: "Nozzle, pressure & electrodes", completedKey: "burner_setup_record", visibleByDefault: showOilForms },
                      { id: "fire-valve-test", path: `/jobs/${job.id}/fire-valve-test`, label: "Fire Valve Test", desc: "Test result & remedial action", completedKey: "fire_valve_test_record", visibleByDefault: showOilForms },
                      { id: "oil-line-vacuum-test", path: `/jobs/${job.id}/oil-line-vacuum-test`, label: "Oil Line Vacuum Test", desc: "Pipework & vacuum readings", completedKey: "oil_line_vacuum_test", visibleByDefault: showOilForms },
                    ];
                    const extraForms = allFormDefs.filter(f => !f.visibleByDefault);
                    if (extraForms.length === 0) return null;
                    return (
                      <div className="mt-6">
                        <Card className="p-4 mb-3 border-dashed border-primary/40 bg-primary/5">
                          <p className="text-sm text-muted-foreground">
                            Need a form that is not listed? Submit a form request ticket and we will review feasibility and add it if suitable.
                          </p>
                          <Link href={formRequestHref}>
                            <Button size="sm" variant="outline" className="mt-3">Request a New Form</Button>
                          </Link>
                        </Card>

                        <button
                          type="button"
                          onClick={() => setShowExtraForms(v => !v)}
                          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {showExtraForms ? "Hide additional forms" : "Add a form not listed above"}
                          {showExtraForms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {showExtraForms && (
                          <div className="mt-3 grid sm:grid-cols-2 gap-3">
                            {extraForms.map(f => (
                              <Link key={f.id} href={f.path}>
                                <Card className={`p-4 flex items-center gap-3 hover:border-primary hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br ${completedFormTypes.has(f.completedKey) ? "from-emerald-100/80 to-emerald-50/50 border-emerald-200" : "from-slate-50 to-white border-dashed"}`}>
                                  <div className={`p-2 rounded-lg ${completedFormTypes.has(f.completedKey) ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="font-semibold text-sm">{f.label}</h4>
                                      {completedFormTypes.has(f.completedKey) && <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{completedFormTypes.has(f.completedKey) ? "Completed — tap to view or edit" : f.desc}</p>
                                  </div>
                                </Card>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              );
            })()}

            <JobInvoicesSection jobId={job.id} />
            <EmailLogSection jobId={job.id} refreshKey={emailLogRefresh} />
            <SmsLogSection jobId={job.id} refreshKey={smsLogRefresh} />
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
              {job.property?.latitude != null && job.property?.longitude != null && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <p className="text-xs text-muted-foreground font-mono">{(job.property.latitude as number).toFixed(6)}, {(job.property.longitude as number).toFixed(6)}</p>
                  <Suspense fallback={<div className="h-[150px] bg-slate-100 rounded animate-pulse" />}>
                    <PropertyMapPreview key={`${job.property.latitude}-${job.property.longitude}`} latitude={job.property.latitude as number} longitude={job.property.longitude as number} />
                  </Suspense>
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

            {propertyId && isOfficeOrAdmin && (
              <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> Appliance</h3>
                  <div className="flex items-center gap-2">
                    {job.appliance && (
                      <Link href={`/appliances/${job.appliance.id}?edit=1`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <Edit className="w-3 h-3" /> Edit
                      </Link>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setShowAddAppliance((v) => !v)}>
                      {showAddAppliance ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> Add Appliance</>}
                    </Button>
                  </div>
                </div>

                {showAddAppliance && (
                  <form onSubmit={handleSubmitAppliance(onAddAppliance)} className="space-y-4 mb-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Manufacturer</Label>
                        <Input placeholder="e.g. Worcester Bosch" {...registerAppliance("manufacturer")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Model</Label>
                        <Input placeholder="e.g. Greenstar 30i" {...registerAppliance("model")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Serial Number</Label>
                        <Input placeholder="Optional" {...registerAppliance("serial_number")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Appliance Type</Label>
                        <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...registerAppliance("boiler_type")}>
                          <option value="">Select...</option>
                          {visibleBoilerTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Fuel Type</Label>
                        <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...registerAppliance("fuel_type")}>
                          <option value="">Select...</option>
                          {APPLIANCE_FUEL_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>System Type</Label>
                        <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...registerAppliance("system_type")}>
                          <option value="">Select...</option>
                          <option value="open_vented">Open Vented</option>
                          <option value="sealed">Sealed</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Appliance Location</Label>
                        <Input placeholder="e.g. Kitchen cupboard" {...registerAppliance("location")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Installation Date</Label>
                        <Input type="date" {...registerAppliance("installation_date")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Next Service Due</Label>
                        <Input type="date" {...registerAppliance("next_service_due")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Warranty Expiry</Label>
                        <Input type="date" {...registerAppliance("warranty_expiry")} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nozzle Size</Label>
                        <select
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                          value={applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue) && applianceNozzleValue !== "Custom..." ? "Custom..." : (applianceNozzleValue || "")}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            if (nextValue === "Custom...") {
                              setCustomApplianceNozzle(applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue) && applianceNozzleValue !== "Custom..." ? applianceNozzleValue : "");
                              setApplianceValue("nozzle_size", "");
                              return;
                            }
                            setCustomApplianceNozzle("");
                            setApplianceValue("nozzle_size", nextValue);
                          }}
                        >
                          <option value="">Select...</option>
                          {APPLIANCE_NOZZLE_SIZE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {(applianceNozzleValue === "" || (applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue) && applianceNozzleValue !== "Custom...")) && (
                          <Input
                            value={customApplianceNozzle}
                            onChange={(event) => {
                              const nextValue = event.target.value.trim();
                              setCustomApplianceNozzle(nextValue);
                              setApplianceValue("nozzle_size", nextValue);
                            }}
                            placeholder="Enter custom nozzle size"
                            className="mt-2"
                          />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pump Pressure</Label>
                        <Input placeholder="e.g. 10 bar" {...registerAppliance("pump_pressure")} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...registerAppliance("notes")} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createAppliance.isPending}>
                        <Check className="w-4 h-4 mr-2" /> {createAppliance.isPending ? "Adding..." : "Add Appliance"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setShowAddAppliance(false); resetAppliance(); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {job.appliance ? (
                  <Link href={`/appliances/${job.appliance.id}`} className="block rounded-lg border border-border/50 bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <p className="font-semibold text-foreground truncate">
                        {[job.appliance.manufacturer, job.appliance.model].filter(Boolean).join(" ") || "Unnamed Appliance"}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Type: <span className="text-foreground capitalize">{String(job.appliance.boiler_type || "n/a").replace(/_/g, " ")}</span></p>
                      <p>Fuel: <span className="text-foreground capitalize">{String(job.appliance.fuel_type || "n/a").replace(/_/g, " ")}</span></p>
                      {job.appliance.serial_number && <p>Serial: <span className="text-foreground font-mono">{job.appliance.serial_number}</span></p>}
                      {job.appliance.next_service_due && <p>Next Service: <span className="text-foreground">{formatDate(job.appliance.next_service_due)}</span></p>}
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-background/80 p-4 text-sm text-muted-foreground">
                    No appliance is linked to this job yet.
                  </div>
                )}
              </Card>
            )}
            
          </div>
        </div>
        </>
      )}

      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" /> Email Appointment Confirmation
            </DialogTitle>
            <DialogDescription>
              Check the details below, then send. The customer also gets Confirm and Request date change buttons.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Send to</Label>
              <Input
                type="email"
                value={confirmationEmail}
                onChange={(e) => setConfirmationEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            <div className="rounded-lg border bg-slate-50/70 p-3 space-y-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Included in the email</p>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-medium text-right">{jobRef || `#${job.id.slice(0, 8)}`}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Type of work</span>
                <span className="font-medium text-right">{jobTypeLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-right">{displayScheduledSummary}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Job duration</span>
                <span className="font-medium text-right">{displayDuration}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Property address, engineer and job description are taken from the job record.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Add a message (optional)</Label>
              <Textarea
                value={confirmationMessage}
                onChange={(e) => setConfirmationMessage(e.target.value)}
                placeholder="e.g. We'll call ahead 30 minutes before arriving."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Appears near the top of the email, above the appointment details.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmationOpen(false)} disabled={sendingConfirmation}>
              Cancel
            </Button>
            <Button onClick={handleSendConfirmationDirect} disabled={sendingConfirmation || !confirmationEmail.trim()}>
              {sendingConfirmation ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sendingConfirmation ? "Sending…" : "Send Confirmation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SmsSendDialog
        open={showSms}
        onOpenChange={setShowSms}
        destination={(job.customer?.mobile || job.customer?.phone) ?? ""}
        jobId={job.id}
        customerId={job.customer_id ?? undefined}
        onSent={() => setSmsLogRefresh(k => k + 1)}
      />

      {emailModalOpen && (
        <EmailFormsModal
          jobId={job.id}
          customerEmail={(job.customer as unknown as Record<string, unknown>)?.email as string || ""}
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
  const [calloutRates, setCalloutRates] = useState<CalloutRateOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`);
        if (Array.isArray(data)) {
          setCalloutRates(
            data.map((row) => {
              const record = row as Record<string, unknown>;
              return {
                id: String(record.id || ""),
                name: String(record.name || "Rate"),
                amount: Number(record.amount || 0),
                hourly_rate: record.hourly_rate != null ? Number(record.hourly_rate) : null,
                is_default: Boolean(record.is_default),
              };
            }),
          );
        }
      } catch { /* silently ignore auth errors */ }
    })();
  }, []);

  // The job stores its chosen callout rate, so persist changes made in the add form.
  const handleCalloutRateChange = async (value: string | null) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callout_rate_id: value }),
      });
      onChanged?.();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to update", variant: "destructive" });
    }
  };

  const canModify = (createdBy: string | null | undefined) =>
    createdBy === profile?.id || profile?.role === "admin" || profile?.role === "super_admin";

  const handleAdd = async (entry: Omit<TimeLine, "key">) => {
    if (!entry.arrival) return;
    const entryData = {
      arrival_time: entry.arrival,
      departure_time: entry.departure,
      notes: entry.notes ?? null,
      hourly_rate: entry.hourlyRate,
      callout_fee: entry.calloutFee,
    };
    if (!isOnline) {
      try {
        await queueTimeEntry(jobId, entryData);
        toast({ title: "Saved offline", description: "Time entry will sync when you're back online." });
      } catch {
        toast({ title: "Error", description: "Failed to save time entry offline", variant: "destructive" });
      }
      return;
    }
    try {
      await createMutation.mutateAsync({ jobId, data: entryData as Record<string, unknown> as never });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/time-entries`] });
      toast({ title: "Added", description: "Time entry added" });
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async (entryId: string, patch: Partial<TimeLine>) => {
    if (patch.arrival && patch.departure && new Date(patch.departure) <= new Date(patch.arrival)) {
      toast({ title: "Error", description: "Departure must be after arrival", variant: "destructive" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        jobId,
        entryId,
        data: {
          arrival_time: patch.arrival,
          departure_time: patch.departure ?? null,
          notes: patch.notes ?? null,
          hourly_rate: patch.hourlyRate ?? null,
          callout_fee: patch.calloutFee ?? null,
        } as Record<string, unknown>,
      });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/time-entries`] });
      toast({ title: "Updated", description: "Time entry updated" });
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
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

  const timeLines: TimeLine[] = (entries || []).map((e) => {
    const record = e as unknown as Record<string, unknown>;
    return {
      key: e.id,
      arrival: e.arrival_time,
      departure: e.departure_time ?? null,
      notes: e.notes ?? null,
      hourlyRate: record.hourly_rate != null ? Number(record.hourly_rate) : null,
      calloutFee: record.callout_fee != null ? Number(record.callout_fee) : null,
      createdByName: e.created_by_name ?? null,
      canModify: canModify(e.created_by),
    };
  });

  const hasEntries = timeLines.length > 0;
  const showLegacy = !hasEntries && (legacyArrival || legacyDeparture);

  return (
    <TimeSection
      entries={timeLines}
      calloutRates={calloutRates}
      defaultCalloutRateId={calloutRateId}
      onCalloutRateChange={handleCalloutRateChange}
      defaultHourlyRate={Number(companySettings?.default_hourly_rate) || 0}
      defaultCalloutFee={Number(companySettings?.call_out_fee) || 0}
      loading={isLoading}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      footer={showLegacy ? (
        <div className="border rounded-lg p-3 bg-slate-50/50 mt-3">
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
      ) : null}
    />
  );
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
    if (!d) return "Date not scheduled";
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  const fmtTime = (t: string | null) => {
    if (!t) return "Time not scheduled";
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

function ServicesUsedSection({ jobId, onChanged }: { jobId: string; onChanged?: () => void }) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const canAddToCatalogue = ["admin", "office_staff", "super_admin"].includes(profile?.role ?? "");
  const [services, setServices] = useState<JobService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/services`);
      setServices(Array.isArray(data) ? data as JobService[] : []);
      setLoadError(false);
    } catch {
      setServices([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const handleAdd = async (svc: Omit<ServiceLine, "key">) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_name: svc.name,
          quantity: svc.quantity,
          unit_price: svc.unitPrice,
          catalogue_item_id: svc.catalogueItemId ?? null,
        }),
      });
      toast({ title: "Added", description: "Service added" });
      fetchServices();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add service";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async (
    serviceId: string,
    patch: Partial<ServiceLine>,
    options?: { updateCataloguePrice?: boolean },
  ) => {
    const body: Record<string, unknown> = {};
    if (patch.quantity !== undefined) body.quantity = patch.quantity;
    if (patch.unitPrice !== undefined) {
      body.unit_price = patch.unitPrice;
      body.update_catalogue_price = options?.updateCataloguePrice ?? false;
    }
    if (Object.keys(body).length === 0) return;
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      fetchServices();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update service";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (serviceId: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/services/${serviceId}`, { method: "DELETE" });
      toast({ title: "Removed", description: "Service removed" });
      fetchServices();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <ServicesSection
      services={services.map(s => ({
        key: s.id,
        name: s.service_name,
        quantity: s.quantity,
        unitPrice: s.unit_price,
        catalogueItemId: s.catalogue_item_id,
      }))}
      loading={loading}
      loadError={loadError}
      onRetry={fetchServices}
      canEditCatalogue={canAddToCatalogue}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
}

function PartsUsedSection({ jobId, onChanged }: { jobId: string; onChanged?: () => void }) {
  const { toast } = useToast();
  const { isOnline, queueJobPart } = useOffline();
  const { profile } = useAuth();
  const canAddToCatalogue = ["admin", "office_staff", "super_admin"].includes(profile?.role ?? "");
  const [parts, setParts] = useState<JobPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts`);
      setParts(Array.isArray(data) ? data as JobPart[] : []);
      setLoadError(false);
    } catch {
      setParts([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  const handleAdd = async (part: Omit<PartLine, "key">) => {
    const partData = {
      part_name: part.name,
      quantity: part.quantity,
      serial_number: part.serialNumber ?? null,
      unit_price: part.unitPrice,
      catalogue_item_id: part.catalogueItemId ?? null,
      status: part.status,
    };
    if (!isOnline) {
      try {
        await queueJobPart(jobId, partData);
        toast({ title: "Saved offline", description: "Part will sync when you're back online." });
      } catch {
        toast({ title: "Error", description: "Failed to save part offline", variant: "destructive" });
      }
      return;
    }
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partData),
      });
      toast({ title: "Added", description: "Part added" });
      fetchParts();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add part";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async (
    partId: string,
    patch: Partial<PartLine>,
    options?: { updateCataloguePrice?: boolean },
  ) => {
    const body: Record<string, unknown> = {};
    if (patch.quantity !== undefined) body.quantity = patch.quantity;
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.unitPrice !== undefined) {
      body.unit_price = patch.unitPrice;
      body.update_catalogue_price = options?.updateCataloguePrice ?? false;
    }
    if (Object.keys(body).length === 0) return;
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/parts/${partId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      fetchParts();
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update part";
      toast({ title: "Error", description: msg, variant: "destructive" });
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

  return (
    <PartsSection
      parts={parts.map(p => ({
        key: p.id,
        name: p.part_name,
        quantity: p.quantity,
        unitPrice: p.unit_price,
        serialNumber: p.serial_number,
        status: (p.status || "fitted") === "to_order" ? "to_order" : "fitted",
        catalogueItemId: p.catalogue_item_id,
      }))}
      loading={loading}
      loadError={loadError}
      onRetry={fetchParts}
      canEditCatalogue={canAddToCatalogue}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
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
  services_total?: number;
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
  const [, navigate] = useLocation();
  const { hasFeature } = usePlanFeatures();
  const { data: companySettings } = useCompanySettings();
  const qc = useQueryClient();
  const [creatingInternalInvoice, setCreatingInternalInvoice] = useState(false);
  const [internalInvoiceResult, setInternalInvoiceResult] = useState<{ id: string; invoice_number: string } | null>(null);
  const { data: linkedInvoicesData } = useListInvoices({ job_id: jobId });
  const linkedInvoices = linkedInvoicesData?.invoices ?? [];
  const hasInvoiceDocs = linkedInvoices.some((doc) => doc.type === "invoice");
  const hasQuoteDocs = linkedInvoices.some((doc) => doc.type === "quote");

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
      const isAuthError = msg.toLowerCase().includes("decrypt") || msg.toLowerCase().includes("reconnect") || msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("authenticate");
      toast({
        title: "Error",
        description: isAuthError
          ? "Zoho connection error — please go to Company Settings → Accounting Integrations, disconnect Zoho Invoice, then reconnect."
          : msg,
        variant: "destructive",
      });
    } finally {
      setSendingToAccounting(false);
    }
  };

  const handleCreateInternalInvoice = async () => {
    setCreatingInternalInvoice(true);
    try {
      const result = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/create-internal-invoice`, {
        method: "POST",
      }) as { id: string; invoice_number: string; refreshed?: boolean };
      setInternalInvoiceResult(result);
      await qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: result.refreshed ? "Invoice refreshed" : "Invoice created",
        description: result.refreshed
          ? `Linked draft ${result.invoice_number} was updated from the latest job pricing.`
          : `Final invoice ${result.invoice_number} created in your invoice facility.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create invoice";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCreatingInternalInvoice(false);
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
  const invProvider = (companySettings?.invoicing_provider || "native") as "native" | "external" | "both";
  const showNativeInvoice = invProvider === "native" || invProvider === "both";
  const showExternalAccounting = invProvider === "external" || invProvider === "both";

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
          <div className="flex flex-col items-end">
            <span className="font-bold text-lg">{sym}{summary.total.toFixed(2)}</span>
            {summary.vat_rate > 0 && (
              <span className="text-xs text-muted-foreground">incl. {summary.vat_rate}% VAT</span>
            )}
          </div>
          {canExport && (
            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200" onClick={() => setShowExport(!showExport)}>
              <FileText className="w-4 h-4 mr-1" /> Export Invoice
            </Button>
          )}
        </div>
      </div>

      {summary.invoice_number && !hasInvoiceDocs && (
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

      {canExport && showExternalAccounting && (!hasInvoiceDocs || sentExternalId) && (accountingStatus?.connected || accountingStatus?.needs_reconnect || sentExternalId) && (
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

      {canExport && showNativeInvoice && hasFeature("invoicing") && companySettings?.invoices_enabled !== false && (
        <div className="border rounded-lg p-4 mb-4 bg-violet-50/50">
          {linkedInvoices.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-violet-800">{hasInvoiceDocs ? `Linked Invoice${linkedInvoices.length > 1 ? "s" : ""}` : "Linked Quote"}</p>
              {linkedInvoices.map((inv) => (
                <div key={inv.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-medium">{inv.invoice_number}</span>
                    <span className="text-xs text-muted-foreground capitalize">{inv.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.type === "invoice" && inv.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={creatingInternalInvoice}
                        onClick={handleCreateInternalInvoice}
                        className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50"
                      >
                        {creatingInternalInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />} Refresh from Job
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Edit Invoice
                    </Button>
                  </div>
                </div>
              ))}
              {hasQuoteDocs && !hasInvoiceDocs && !internalInvoiceResult && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-violet-200 rounded-lg p-3 bg-white/70">
                  <div>
                    <p className="text-sm font-medium">Create Final Invoice</p>
                    <p className="text-xs text-muted-foreground">Include the original quoted scope plus the extra parts, labour and time on this job.</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={creatingInternalInvoice}
                    onClick={handleCreateInternalInvoice}
                    className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {creatingInternalInvoice ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                    ) : (
                      <><Receipt className="w-3.5 h-3.5" /> Create Final Invoice</>
                    )}
                  </Button>
                </div>
              )}
              {internalInvoiceResult && !hasInvoiceDocs && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="font-medium">Invoice {internalInvoiceResult.invoice_number} created</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">Saved to your invoice facility as a draft</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/invoices/${internalInvoiceResult.id}`)}
                    className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Invoice
                  </Button>
                </div>
              )}
            </div>
          ) : internalInvoiceResult ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-medium">Invoice {internalInvoiceResult.invoice_number} created</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">Saved to your invoice facility as a draft</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/invoices/${internalInvoiceResult.id}`)}
                className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View Invoice
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Send to Invoice Facility</p>
                <p className="text-xs text-muted-foreground">Create a pre-filled invoice from this job's time, parts and services</p>
              </div>
              <Button
                size="sm"
                disabled={creatingInternalInvoice}
                onClick={handleCreateInternalInvoice}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {creatingInternalInvoice ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                ) : (
                  <><Receipt className="w-3.5 h-3.5" /> Create Invoice</>
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
            {(summary.services_total ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Services Total</span>
                <span>{sym}{(summary.services_total ?? 0).toFixed(2)}</span>
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
  const { hasAddon } = usePlanFeatures();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files, isLoading, queryKey: filesQueryKey } = useListFiles({ entity_type: "job", entity_id: jobId });
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
      await qc.refetchQueries({ queryKey: filesQueryKey });
      toast({ title: "Uploaded", description: `${fileList.length} photo(s) uploaded` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      const isStorageFull = message.includes("STORAGE_LIMIT_REACHED");
      toast({
        title: isStorageFull ? "Storage limit reached" : "Upload Error",
        description: isStorageFull
          ? "You've used all your photo storage. Upgrade to Extra Photo Storage in Billing to get 500 GB more."
          : message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      await qc.refetchQueries({ queryKey: filesQueryKey });
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
          <Link href={`/jobs/${jobId}/files`}>
            <Button size="sm" variant="outline">
              <FileText className="w-4 h-4 mr-1" /> Documents
            </Button>
          </Link>
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
          status: "scheduled" as "scheduled" | "in_progress" | "completed" | "cancelled" | "requires_follow_up" | "awaiting_parts" | "invoiced" | "follow_up_scheduled",
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

function EditJobForm({ job, onClose, onEmailSent, onFollowUpRequested }: { job: JobLike; onClose: () => void; onEmailSent?: () => void; onFollowUpRequested?: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isOnline, queueJobUpdate } = useOffline();
  const { register, handleSubmit, reset, setValue, watch } = useForm<JobEditData>();
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>(
    (job as unknown as { service_catalogue_id?: string | null }).service_catalogue_id || ""
  );
  const [selectedFuelCategory, setSelectedFuelCategory] = useState<string>(
    (job as unknown as { fuel_category?: string | null }).fuel_category || "general"
  );

  const { data: jobTypesData } = useQuery<Array<{ id: string; name: string; is_active: boolean; booking_duration_minutes?: number | null }>>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/job-type-options`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
  const activeJobTypes = (jobTypesData || []).filter(jt => jt.is_active);

  const handleJobTypeChange = (jobTypeId: string) => {
    setSelectedJobTypeId(jobTypeId);
    const selectedType = activeJobTypes.find((jt) => String(jt.id) === jobTypeId);
    const selectedDuration = Number(selectedType?.booking_duration_minutes ?? 0);
    if (Number.isFinite(selectedDuration) && selectedDuration > 0) {
      setValue("estimated_duration", String(selectedDuration), { shouldDirty: true });
    }
  };

  const customerEmail = (job.customer as Record<string, unknown>)?.email as string || "";
  const customerName = `${(job.customer as Record<string, unknown>)?.first_name || ""} ${(job.customer as Record<string, unknown>)?.last_name || ""}`.trim();
  const isAllDay = watch("all_day");

  useEffect(() => {
    reset({
      status: job.status,
      priority: job.priority,
      visit_intent: ((job as unknown as { visit_intent?: string | null }).visit_intent === "estimate" ? "estimate" : "standard"),
      scheduled_date: (job.scheduled_date as string)?.split('T')[0] || "",
      scheduled_end_date: (job.scheduled_end_date as string)?.split('T')[0] || "",
      scheduled_time: (job.scheduled_time as string) || "",
      all_day: job.estimated_duration == null,
      estimated_duration: job.estimated_duration != null ? String(job.estimated_duration) : "",
      description: (job.description as string) || "",
    });
    setSelectedJobTypeId(String((job as unknown as { service_catalogue_id?: string | null }).service_catalogue_id || ""));
    setSelectedFuelCategory((job as unknown as { fuel_category?: string | null }).fuel_category || "general");
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
    if (data.all_day) {
      data.estimated_duration = "";
    }

    const estimatedDurationValue = String(data.estimated_duration || "").trim();
    const parsedEstimatedDuration = estimatedDurationValue ? Number(estimatedDurationValue) : null;
    if (estimatedDurationValue && !Number.isFinite(parsedEstimatedDuration)) {
      toast({ title: "Invalid duration", description: "Estimated duration must be a number of minutes.", variant: "destructive" });
      return;
    }

    const updatePayload: Record<string, unknown> = {
      status: data.status,
      priority: data.priority,
      visit_intent: data.visit_intent === "estimate" ? "estimate" : "standard",
      scheduled_date: data.scheduled_date,
      scheduled_end_date: data.scheduled_end_date || null,
      scheduled_time: data.scheduled_time || null,
      estimated_duration: data.all_day ? null : parsedEstimatedDuration,
      all_day: Boolean(data.all_day),
      description: (data.description || "").trim() || null,
    };
    if (selectedJobTypeId) {
      updatePayload.service_catalogue_id = selectedJobTypeId;
    }
    if (selectedFuelCategory) {
      updatePayload.fuel_category = selectedFuelCategory;
    }

    setSaving(true);
    try {
      if (!isOnline) {
        await queueJobUpdate(job.id, updatePayload);
        toast({ title: "Queued offline", description: "Job update will sync when online." });
        onClose();
        return;
      }

      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/schedule-history`] });
      toast({ title: "Updated", description: "Job updated successfully" });
      if (data.status === "requires_follow_up" || data.status === "awaiting_parts") {
        onFollowUpRequested?.();
        return;
      }
      if (customerEmail) {
        setShowEmailPrompt(true);
      } else {
        onClose();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
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
            <Label>Job Type</Label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              value={selectedJobTypeId}
              onChange={e => handleJobTypeChange(e.target.value)}
            >
              <option value="">Select job type</option>
              {activeJobTypes.map(jt => (
                <option key={jt.id} value={String(jt.id)}>{jt.name}</option>
              ))}
            </select>
            {selectedJobTypeId && String((job as unknown as { service_catalogue_id?: string | null }).service_catalogue_id || "") !== selectedJobTypeId && (
              <p className="text-xs text-amber-600">Changing job type will update the forms available for this job.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Forms Required</Label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              value={selectedFuelCategory}
              onChange={e => setSelectedFuelCategory(e.target.value)}
            >
              <option value="gas">Gas</option>
              <option value="oil">Oil</option>
              <option value="heat_pump">Heat Pump</option>
              <option value="general">General</option>
            </select>
            {selectedFuelCategory !== ((job as unknown as { fuel_category?: string | null }).fuel_category || "general") && (
              <p className="text-xs text-amber-600">Changing forms required will update the forms shown for this job.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("status")}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="requires_follow_up">Requires Follow-up</option>
              <option value="follow_up_scheduled">Follow-up Scheduled</option>
              <option value="invoiced">Invoiced</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Label>Visit Intent</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("visit_intent")}>
              <option value="standard">Standard Job</option>
              <option value="estimate">Estimate / Quote Visit</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Scheduled Date</Label>
            <Input type="date" {...register("scheduled_date")} required />
          </div>
          <div className="space-y-2">
            <Label>Scheduled Time</Label>
            <Input type="time" {...register("scheduled_time")} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>End Date <span className="text-muted-foreground">(multi-day)</span></Label>
            <Input type="date" {...register("scheduled_end_date")} />
          </div>
          <div className="space-y-2">
            <Label>Estimated Duration</Label>
            <Input {...register("estimated_duration")} placeholder="e.g. 1 hour" disabled={Boolean(isAllDay)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-border"
            {...register("all_day", {
              onChange: (event) => {
                if ((event.target as HTMLInputElement).checked) {
                  setValue("scheduled_time", "", { shouldDirty: true });
                  setValue("estimated_duration", "", { shouldDirty: true });
                }
              },
            })}
          />
          <span className="text-muted-foreground">All day</span>
        </label>
        <div className="space-y-2">
          <Label>Description</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("description")} />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            <Check className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
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
  const [customerMessage, setCustomerMessage] = useState("");
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
    const hasMessage = customerMessage.trim().length > 0;
    if (totalSelected === 0 && !hasMessage) {
      toast({ title: "Error", description: "Add a message or select at least one form or photo to send", variant: "destructive" }); return;
    }
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
          customer_message: customerMessage.trim() || undefined,
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
    if (parts.length === 0 && customerMessage.trim().length > 0) return "Send Message";
    return `Send ${parts.join(" & ") || "Email"}`;
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
          <div className="space-y-2">
            <Label>Message to Customer (optional)</Label>
            <Textarea
              value={customerMessage}
              onChange={e => setCustomerMessage(e.target.value)}
              placeholder="Add a custom note to include in this email..."
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">{customerMessage.length}/2000</p>
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
            <Button onClick={handleSend} disabled={sending || (!to || (totalSelected === 0 && !customerMessage.trim()) || loadingForms)} className="flex-1">
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
  body_text?: string | null;
  forms_included: Array<{ form_type: string; form_label: string; form_id: string }>;
  photos_included: Array<{ url: string; name?: string }> | null;
  created_at: string;
}

function getEmailLogBodyText(entry: EmailLogEntry): string {
  if (entry.body_text && entry.body_text.trim().length > 0) {
    return entry.body_text;
  }

  const lines = [
    `To: ${entry.sent_to}`,
    entry.cc ? `CC: ${entry.cc}` : "",
    `Subject: ${entry.subject}`,
  ].filter(Boolean);

  if (entry.forms_included.length > 0) {
    lines.push("", "Attachments:");
    for (const form of entry.forms_included) {
      lines.push(`- ${form.form_label}`);
    }
  }

  if (entry.photos_included && entry.photos_included.length > 0) {
    lines.push("", `Photos attached: ${entry.photos_included.length}`);
  }

  return lines.join("\n");
}

function EmailLogSection({ jobId, refreshKey }: { jobId: string; refreshKey: number }) {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [openEntries, setOpenEntries] = useState<Set<string>>(new Set());

  const toggleEntry = (id: string) => {
    setOpenEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
        <div className="mt-4 space-y-2">
          {logs.map(entry => {
            const isOpen = openEntries.has(entry.id);
            const hasPhotos = Array.isArray(entry.photos_included) && entry.photos_included.length > 0;
            const emailBody = getEmailLogBodyText(entry);
            return (
              <div key={entry.id} className="border border-border/50 rounded-lg overflow-hidden">
                {/* Header row — always visible, click to expand */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  onClick={() => toggleEntry(entry.id)}
                >
                  <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.sent_by_name || "Unknown"} &middot;{" "}
                      {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                      {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-3 py-3 space-y-3 border-t border-border/50">
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground font-medium">To</span>
                      <span>{entry.sent_to}</span>
                      {entry.cc && (
                        <>
                          <span className="text-muted-foreground font-medium">CC</span>
                          <span>{entry.cc}</span>
                        </>
                      )}
                      <span className="text-muted-foreground font-medium">Subject</span>
                      <span>{entry.subject}</span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email Content</p>
                      <pre className="text-xs whitespace-pre-wrap break-words rounded-md border border-border/50 bg-muted/20 p-2.5">{emailBody}</pre>
                    </div>

                    {entry.forms_included.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Attachments</p>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.forms_included.map((f, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              <FileText className="w-3 h-3" /> {f.form_label}
                            </span>
                          ))}
                          {hasPhotos && (
                            <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              <Camera className="w-3 h-3" /> {entry.photos_included!.length} photo{entry.photos_included!.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface SmsLogEntry {
  id: string;
  destination: string;
  content: string;
  sender_id: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

function SmsLogSection({ jobId, refreshKey }: { jobId: string; refreshKey: number }) {
  const [logs, setLogs] = useState<SmsLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/sms/messages?job_id=${jobId}&limit=50`) as { data: SmsLogEntry[] };
        if (!cancelled) { setLogs(data.data ?? []); setExpanded(true); }
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
        <h3 className="font-bold text-lg flex items-center gap-2 text-green-600">
          <MessageSquare className="w-5 h-5" /> SMS Log ({logs.length})
        </h3>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {logs.map(entry => (
            <div key={entry.id} className="border border-border/50 rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{entry.profiles?.full_name || "Unknown"}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">To: {entry.destination}</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{entry.content}</p>
              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.status === "sent" || entry.status === "SENT" ? "bg-green-100 text-green-700" : entry.status === "failed" || entry.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {entry.status}
                </span>
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

function calcDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function CreateFollowUpForm({ jobId, defaultPartsRequired = false, onClose, onCreated }: { jobId: string; defaultPartsRequired?: boolean; onClose: () => void; onCreated: () => void }) {
  const [workDesc, setWorkDesc] = useState("");
  const [partsRequired, setPartsRequired] = useState(defaultPartsRequired);
  const [partsDesc, setPartsDesc] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (partsRequired && !partsDesc.trim()) {
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
          parts_required: partsRequired,
          parts_description: partsRequired ? partsDesc.trim() : null,
          expected_parts_date: partsRequired ? (expectedDate || null) : null,
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
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={partsRequired}
            onChange={(e) => {
              const checked = e.target.checked;
              setPartsRequired(checked);
              if (!checked) {
                setPartsDesc("");
                setExpectedDate("");
              }
            }}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Parts required for this follow-up
        </label>
        {partsRequired && (
          <>
            <div className="space-y-1.5">
              <Label>Parts Needed *</Label>
              <Textarea
                value={partsDesc}
                onChange={(e) => setPartsDesc(e.target.value)}
                placeholder={"Enter one part per line\nExample:\nBoiler PCB board, Model XYZ-123\nPump gasket kit"}
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Expected Delivery Date</Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            </div>
          </>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Work to Complete</Label>
            <Textarea
              value={workDesc}
              onChange={(e) => setWorkDesc(e.target.value)}
              placeholder="Describe the follow-up work needed..."
              rows={2}
            />
          </div>
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

// ─── Invoices & Quotes section for job detail ──────────────────────────────

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue",
  cancelled: "Cancelled", accepted: "Accepted", declined: "Declined", converted: "Converted",
};

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  draft:     "bg-gray-100 text-gray-700",
  sent:      "bg-blue-100 text-blue-700",
  paid:      "bg-green-100 text-green-700",
  overdue:   "bg-red-100 text-red-700",
  cancelled: "bg-gray-50 text-gray-400",
  accepted:  "bg-teal-100 text-teal-700",
  declined:  "bg-red-50 text-red-500",
  converted: "bg-purple-100 text-purple-700",
};

function JobInvoicesSection({ jobId }: { jobId: string }) {
  const [, navigate] = useLocation();
  const { hasFeature } = usePlanFeatures();
  const { data: settings } = useCompanySettings();

  // Only render if plan feature enabled AND company toggle on
  if (!hasFeature("invoicing") || settings?.invoices_enabled === false) return null;

  return <JobInvoicesSectionInner jobId={jobId} navigate={navigate} />;
}

function JobInvoicesSectionInner({
  jobId,
  navigate,
}: {
  jobId: string;
  navigate: (to: string) => void;
}) {
  const { data, isLoading } = useListInvoices({ job_id: jobId, limit: 20 });
  const createInvoice = useCreateInvoice();
  const { toast } = useToast();
  const docs = data?.invoices ?? [];
  const currency = docs[0]?.currency || "GBP";

  function fmt(amount: number) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  }

  async function createDocument(type: "invoice" | "quote") {
    try {
      const created = await createInvoice.mutateAsync({ job_id: jobId, type });
      navigate(`/invoices/${created.id}?edit=1`);
    } catch (error) {
      toast({
        title: "Could not create document",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm mt-6 max-w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Invoices &amp; Quotes
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => createDocument("quote")}
            disabled={createInvoice.isPending}
          >
            {createInvoice.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />} Quote
          </Button>
          <Button
            size="sm"
            className="text-xs h-7"
            onClick={() => createDocument("invoice")}
            disabled={createInvoice.isPending}
          >
            {createInvoice.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />} Invoice
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No invoices or quotes yet for this job.
        </p>
      ) : (
        <div className="divide-y">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded"
              onClick={() => navigate(`/invoices/${doc.id}`)}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium text-primary">
                  {doc.invoice_number}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLASS[doc.status]}`}>
                  {STATUS_LABEL[doc.status]}
                </span>
              </div>
              <span className="text-sm font-semibold">
                {fmt(Number(doc.total))}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
