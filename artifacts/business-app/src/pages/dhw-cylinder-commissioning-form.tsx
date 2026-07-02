import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import SignatureCanvas from "react-signature-canvas";
import { useParams } from "wouter";
import { Link } from "wouter";
import { ArrowLeft, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileDown, Lock, Unlock, Upload } from "lucide-react";

import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type PassFailNa = "pass" | "fail" | "not_applicable" | "";
type YesNoNa = "yes" | "no" | "not_applicable" | "";

type FileRef = {
  id?: string;
  file_name?: string;
  signed_url?: string | null;
  thumbnail_signed_url?: string | null;
};

type FormValues = {
  cylinder_type: string;
  work_type: string;
  jurisdiction: string;
  compliance_route: string;
  notification_reference: string;

  manufacturer: string;
  model: string;
  serial_number: string;
  capacity_litres: string;
  heat_source: string[];
  max_working_pressure_bar: string;
  operating_pressure_bar: string;
  manufacturer_instructions_available: "yes" | "no" | "";

  cylinder_thermostat: PassFailNa;
  thermal_cut_out: PassFailNa;
  immersion_thermostat_overheat: PassFailNa;
  motorised_valve_operation: PassFailNa;
  tp_relief_valve: PassFailNa;
  expansion_relief_valve: PassFailNa;
  safety_valve_ratings_recorded: "yes" | "no" | "";
  no_isolation_valve_before_relief: PassFailNa;
  safety_valves_manually_tested: PassFailNa;
  discharge_visible_at_tundish: PassFailNa;

  incoming_static_pressure_bar: string;
  prv_fitted: YesNoNa;
  prv_setting_bar: string;
  expansion_method: string;
  vessel_size_litres: string;
  vessel_precharge_checked: YesNoNa;
  vessel_precharge_pressure_bar: string;
  cold_control_group: PassFailNa;
  strainer_check_valve: PassFailNa;
  no_leaks: PassFailNa;

  tundish_fitted: YesNoNa;
  tundish_visible_positioned: PassFailNa;
  valve_to_tundish_length_ok: PassFailNa;
  d1_pipe_size: string;
  d2_pipe_size: string;
  d2_continuous_fall: PassFailNa;
  d2_terminates_safely: PassFailNa;
  discharge_termination_location: string;

  cylinder_thermostat_setting_c: string;
  stored_hot_water_temp_c: string;
  nearest_hot_outlet_temp_c: string;
  bath_present: "yes" | "no" | "";
  bath_hot_water_temperature_c: string;
  tmv_fitted: YesNoNa;
  tmv_absence_note: string;

  filled_and_purged: PassFailNa;
  heated_to_operating_temp: PassFailNa;
  controls_cycled: PassFailNa;
  safety_valves_tested: PassFailNa;
  no_leaks_after_heat_up: PassFailNa;
  no_unwanted_discharge: PassFailNa;
  warning_label_visible: YesNoNa;
  user_instructions_explained: "yes" | "no" | "";

  defects_found: "yes" | "no" | "";
  defect_severity: "" | "Advisory" | "Compliance issue" | "Safety issue" | "Immediate danger / do not use";
  defect_notes: string;
  remedial_action: string;
  further_work_required: string;
  defects_resolved: boolean;

  final_status: "" | "Commissioned and safe to use" | "Commissioned with advisory notes" | "Not commissioned" | "Isolated / not safe to use" | "Further work required";
  engineer_declaration: boolean;
  customer_handover: boolean;
  engineer_signature_data: string;
  customer_signature_data: string;
};

type ExistingRecord = {
  id: string;
  locked: boolean;
  form_status: "draft" | "completed";
  audit_log?: unknown;
  photo_uploads?: Record<string, unknown>;
  installation_type?: Record<string, unknown>;
  cylinder_details?: Record<string, unknown>;
  safety_controls?: Record<string, unknown>;
  expansion_cold_inlet?: Record<string, unknown>;
  discharge_pipework?: Record<string, unknown>;
  temperature_readings?: Record<string, unknown>;
  functional_tests?: Record<string, unknown>;
  defects?: Record<string, unknown>;
  final_status?: string | null;
  jurisdiction?: string | null;
  cylinder_type?: string | null;
  engineer_signature_data?: string | null;
  customer_signature_data?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fail: "bg-red-50 text-red-700 border-red-200",
  not_applicable: "bg-slate-50 text-slate-700 border-slate-200",
  yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no: "bg-red-50 text-red-700 border-red-200",
};

const defaultValues: FormValues = {
  cylinder_type: "",
  work_type: "",
  jurisdiction: "",
  compliance_route: "",
  notification_reference: "",

  manufacturer: "",
  model: "",
  serial_number: "",
  capacity_litres: "",
  heat_source: [],
  max_working_pressure_bar: "",
  operating_pressure_bar: "",
  manufacturer_instructions_available: "",

  cylinder_thermostat: "",
  thermal_cut_out: "",
  immersion_thermostat_overheat: "",
  motorised_valve_operation: "",
  tp_relief_valve: "",
  expansion_relief_valve: "",
  safety_valve_ratings_recorded: "",
  no_isolation_valve_before_relief: "",
  safety_valves_manually_tested: "",
  discharge_visible_at_tundish: "",

  incoming_static_pressure_bar: "",
  prv_fitted: "",
  prv_setting_bar: "",
  expansion_method: "",
  vessel_size_litres: "",
  vessel_precharge_checked: "",
  vessel_precharge_pressure_bar: "",
  cold_control_group: "",
  strainer_check_valve: "",
  no_leaks: "",

  tundish_fitted: "",
  tundish_visible_positioned: "",
  valve_to_tundish_length_ok: "",
  d1_pipe_size: "",
  d2_pipe_size: "",
  d2_continuous_fall: "",
  d2_terminates_safely: "",
  discharge_termination_location: "",

  cylinder_thermostat_setting_c: "",
  stored_hot_water_temp_c: "",
  nearest_hot_outlet_temp_c: "",
  bath_present: "",
  bath_hot_water_temperature_c: "",
  tmv_fitted: "",
  tmv_absence_note: "",

  filled_and_purged: "",
  heated_to_operating_temp: "",
  controls_cycled: "",
  safety_valves_tested: "",
  no_leaks_after_heat_up: "",
  no_unwanted_discharge: "",
  warning_label_visible: "",
  user_instructions_explained: "",

  defects_found: "",
  defect_severity: "",
  defect_notes: "",
  remedial_action: "",
  further_work_required: "",
  defects_resolved: false,

  final_status: "",
  engineer_declaration: false,
  customer_handover: false,
  engineer_signature_data: "",
  customer_signature_data: "",
};

function isUnvented(values: FormValues) {
  return values.cylinder_type === "Unvented";
}

function isSafetyFailure(values: FormValues): boolean {
  const checks = [
    values.cylinder_thermostat,
    values.thermal_cut_out,
    values.immersion_thermostat_overheat,
    values.motorised_valve_operation,
    values.tp_relief_valve,
    values.expansion_relief_valve,
    values.no_isolation_valve_before_relief,
    values.safety_valves_manually_tested,
    values.d2_terminates_safely,
    values.safety_valves_tested,
    values.no_leaks_after_heat_up,
    values.no_unwanted_discharge,
  ];
  return checks.some((c) => c === "fail");
}

function parseNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function requiredMissing(v: unknown): boolean {
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return !v;
}

function chipsClass(value: string, active: string) {
  return cn(
    "px-2.5 py-1.5 rounded-md border text-xs font-medium",
    value === active ? STATUS_COLORS[value] || "bg-primary/10 border-primary text-primary" : "bg-white text-muted-foreground border-border",
  );
}

function StatusButtons({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt.value} type="button" className={chipsClass(opt.value, value)} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="p-0 overflow-hidden border-border/60">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left p-4 bg-slate-50/50 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm sm:text-base">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-4">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PhotoUploadField({
  label,
  required,
  fileRef,
  jobId,
  disabled,
  onChange,
}: {
  label: string;
  required?: boolean;
  fileRef: FileRef | null;
  jobId: string;
  disabled?: boolean;
  onChange: (next: FileRef | null) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity_type", "job");
      formData.append("entity_id", jobId);
      const result = await customFetch(`${import.meta.env.BASE_URL}api/files/upload`, { method: "POST", body: formData }) as FileRef;
      onChange(result);
      toast({ title: "Photo uploaded" });
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</Label>
      <div className="rounded-lg border p-2.5 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />

        {fileRef?.signed_url ? (
          <a href={fileRef.signed_url || "#"} target="_blank" rel="noreferrer" className="block">
            <img src={fileRef.thumbnail_signed_url || fileRef.signed_url || ""} alt={label} className="h-28 w-full object-cover rounded-md bg-slate-100" />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">No photo attached</p>
        )}

        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />{uploading ? "Uploading..." : "Upload"}
          </Button>
          {fileRef && (
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DhwCylinderCommissioningForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const { toast } = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<ExistingRecord | null>(null);
  const [pendingStatus, setPendingStatus] = useState<"draft" | "completed">("draft");
  const pendingStatusRef = useRef<"draft" | "completed">("draft");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    install: true,
    details: true,
    safety: true,
    expansion: false,
    discharge: false,
    temp: false,
    functional: false,
    defects: false,
    final: true,
  });

  const [photoUploads, setPhotoUploads] = useState<{
    cylinder_data_plate: FileRef | null;
    tundish_photo: FileRef | null;
    discharge_termination_photo: FileRef | null;
    defect_photos: FileRef[];
  }>({
    cylinder_data_plate: null,
    tundish_photo: null,
    discharge_termination_photo: null,
    defect_photos: [],
  });

  const engineerSigRef = useRef<SignatureCanvas>(null);
  const customerSigRef = useRef<SignatureCanvas>(null);

  const { register, handleSubmit, setValue, watch, reset, getValues } = useForm<FormValues>({ defaultValues });
  const values = watch();

  const locked = !!existing?.locked;

  const jurisdictionInfo = useMemo(() => {
    if (values.cylinder_type !== "Unvented") return null;
    if (values.jurisdiction === "England" || values.jurisdiction === "Wales") {
      return "This unvented installation should align with G3 / Approved Document G requirements.";
    }
    if (values.jurisdiction === "Scotland") {
      return "Use applicable Scottish Building Standards for unvented hot water storage systems.";
    }
    return null;
  }, [values.cylinder_type, values.jurisdiction]);

  const warningHighTemp = useMemo(() => {
    const t = parseNum(values.bath_hot_water_temperature_c);
    return t != null && t > 48;
  }, [values.bath_hot_water_temperature_c]);

  const safetyFailure = isSafetyFailure(values);

  const completionChecks = useMemo(() => {
    const checks: boolean[] = [];
    checks.push(!requiredMissing(values.cylinder_type));
    checks.push(!requiredMissing(values.work_type));
    checks.push(!requiredMissing(values.jurisdiction));
    checks.push(!requiredMissing(values.manufacturer));
    checks.push(!requiredMissing(values.model));
    checks.push(!requiredMissing(values.serial_number));
    checks.push(!requiredMissing(values.capacity_litres));
    checks.push(values.heat_source.length > 0);
    checks.push(!requiredMissing(values.max_working_pressure_bar));
    checks.push(!requiredMissing(values.operating_pressure_bar));
    checks.push(values.manufacturer_instructions_available !== "");
    checks.push(!!photoUploads.cylinder_data_plate);
    checks.push(!!values.engineer_signature_data);
    checks.push(!!values.final_status);
    checks.push(values.engineer_declaration);
    checks.push(values.customer_handover);

    if (isUnvented(values)) {
      checks.push(values.cylinder_thermostat !== "");
      checks.push(values.thermal_cut_out !== "");
      checks.push(values.tp_relief_valve !== "");
      checks.push(values.no_isolation_valve_before_relief !== "");
      checks.push(values.safety_valves_manually_tested !== "");
      checks.push(!requiredMissing(values.incoming_static_pressure_bar));
      checks.push(!requiredMissing(values.expansion_method));
      checks.push(values.no_leaks !== "");
      checks.push(values.tundish_fitted !== "");
      checks.push(values.d2_terminates_safely !== "");
      checks.push(!!photoUploads.tundish_photo);
      checks.push(!!photoUploads.discharge_termination_photo);
    }

    const completed = checks.filter(Boolean).length;
    const total = checks.length;
    return Math.round((completed / Math.max(total, 1)) * 100);
  }, [photoUploads, values]);

  const loadRecord = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const rec = await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/dhw-cylinder-commissioning`) as ExistingRecord | null;
      setExisting(rec);
      if (!rec) {
        reset(defaultValues);
        setPhotoUploads({ cylinder_data_plate: null, tundish_photo: null, discharge_termination_photo: null, defect_photos: [] });
        return;
      }

      const installation = (rec.installation_type || {}) as Record<string, unknown>;
      const cylinder = (rec.cylinder_details || {}) as Record<string, unknown>;
      const safety = (rec.safety_controls || {}) as Record<string, unknown>;
      const expansion = (rec.expansion_cold_inlet || {}) as Record<string, unknown>;
      const discharge = (rec.discharge_pipework || {}) as Record<string, unknown>;
      const temp = (rec.temperature_readings || {}) as Record<string, unknown>;
      const functional = (rec.functional_tests || {}) as Record<string, unknown>;
      const defects = (rec.defects || {}) as Record<string, unknown>;
      const photos = (rec.photo_uploads || {}) as Record<string, unknown>;

      reset({
        cylinder_type: (rec.cylinder_type || "") as string,
        work_type: (installation.work_type || "") as string,
        jurisdiction: (rec.jurisdiction || installation.jurisdiction || "") as string,
        compliance_route: (installation.compliance_route || "") as string,
        notification_reference: (installation.notification_reference || "") as string,

        manufacturer: (cylinder.manufacturer || "") as string,
        model: (cylinder.model || "") as string,
        serial_number: (cylinder.serial_number || "") as string,
        capacity_litres: String(cylinder.capacity_litres || ""),
        heat_source: Array.isArray(cylinder.heat_source) ? (cylinder.heat_source as string[]) : [],
        max_working_pressure_bar: String(cylinder.max_working_pressure_bar || ""),
        operating_pressure_bar: String(cylinder.operating_pressure_bar || ""),
        manufacturer_instructions_available: (cylinder.manufacturer_instructions_available || "") as FormValues["manufacturer_instructions_available"],

        cylinder_thermostat: (safety.cylinder_thermostat || "") as PassFailNa,
        thermal_cut_out: (safety.thermal_cut_out || "") as PassFailNa,
        immersion_thermostat_overheat: (safety.immersion_thermostat_overheat || "") as PassFailNa,
        motorised_valve_operation: (safety.motorised_valve_operation || "") as PassFailNa,
        tp_relief_valve: (safety.tp_relief_valve || "") as PassFailNa,
        expansion_relief_valve: (safety.expansion_relief_valve || "") as PassFailNa,
        safety_valve_ratings_recorded: (safety.safety_valve_ratings_recorded || "") as FormValues["safety_valve_ratings_recorded"],
        no_isolation_valve_before_relief: (safety.no_isolation_valve_before_relief || "") as PassFailNa,
        safety_valves_manually_tested: (safety.safety_valves_manually_tested || "") as PassFailNa,
        discharge_visible_at_tundish: (safety.discharge_visible_at_tundish || "") as PassFailNa,

        incoming_static_pressure_bar: String(expansion.incoming_static_pressure_bar || ""),
        prv_fitted: (expansion.prv_fitted || "") as YesNoNa,
        prv_setting_bar: String(expansion.prv_setting_bar || ""),
        expansion_method: (expansion.expansion_method || "") as string,
        vessel_size_litres: String(expansion.vessel_size_litres || ""),
        vessel_precharge_checked: (expansion.vessel_precharge_checked || "") as YesNoNa,
        vessel_precharge_pressure_bar: String(expansion.vessel_precharge_pressure_bar || ""),
        cold_control_group: (expansion.cold_control_group || "") as PassFailNa,
        strainer_check_valve: (expansion.strainer_check_valve || "") as PassFailNa,
        no_leaks: (expansion.no_leaks || "") as PassFailNa,

        tundish_fitted: (discharge.tundish_fitted || "") as YesNoNa,
        tundish_visible_positioned: (discharge.tundish_visible_positioned || "") as PassFailNa,
        valve_to_tundish_length_ok: (discharge.valve_to_tundish_length_ok || "") as PassFailNa,
        d1_pipe_size: (discharge.d1_pipe_size || "") as string,
        d2_pipe_size: (discharge.d2_pipe_size || "") as string,
        d2_continuous_fall: (discharge.d2_continuous_fall || "") as PassFailNa,
        d2_terminates_safely: (discharge.d2_terminates_safely || "") as PassFailNa,
        discharge_termination_location: (discharge.termination_location || "") as string,

        cylinder_thermostat_setting_c: String(temp.cylinder_thermostat_setting_c || ""),
        stored_hot_water_temp_c: String(temp.stored_hot_water_temp_c || ""),
        nearest_hot_outlet_temp_c: String(temp.nearest_hot_outlet_temp_c || ""),
        bath_present: (temp.bath_present || "") as FormValues["bath_present"],
        bath_hot_water_temperature_c: String(temp.bath_hot_water_temperature_c || ""),
        tmv_fitted: (temp.tmv_fitted || "") as YesNoNa,
        tmv_absence_note: (temp.tmv_absence_note || "") as string,

        filled_and_purged: (functional.filled_and_purged || "") as PassFailNa,
        heated_to_operating_temp: (functional.heated_to_operating_temp || "") as PassFailNa,
        controls_cycled: (functional.controls_cycled || "") as PassFailNa,
        safety_valves_tested: (functional.safety_valves_tested || "") as PassFailNa,
        no_leaks_after_heat_up: (functional.no_leaks_after_heat_up || "") as PassFailNa,
        no_unwanted_discharge: (functional.no_unwanted_discharge || "") as PassFailNa,
        warning_label_visible: (functional.warning_label_visible || "") as YesNoNa,
        user_instructions_explained: (functional.user_instructions_explained || "") as FormValues["user_instructions_explained"],

        defects_found: (defects.defects_found || "") as FormValues["defects_found"],
        defect_severity: (defects.defect_severity || "") as FormValues["defect_severity"],
        defect_notes: (defects.defect_notes || "") as string,
        remedial_action: (defects.remedial_action || "") as string,
        further_work_required: (defects.further_work_required || "") as string,
        defects_resolved: !!defects.resolved,

        final_status: (rec.final_status || "") as FormValues["final_status"],
        engineer_declaration: !!installation.engineer_declaration,
        customer_handover: !!installation.customer_handover,
        engineer_signature_data: (rec.engineer_signature_data || "") as string,
        customer_signature_data: (rec.customer_signature_data || "") as string,
      });

      setPhotoUploads({
        cylinder_data_plate: (photos.cylinder_data_plate as FileRef) || null,
        tundish_photo: (photos.tundish_photo as FileRef) || null,
        discharge_termination_photo: (photos.discharge_termination_photo as FileRef) || null,
        defect_photos: Array.isArray(photos.defect_photos) ? (photos.defect_photos as FileRef[]) : [],
      });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load form", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecord();
  }, [jobId]);

  const frontEndIssues = (data: FormValues, status: "draft" | "completed") => {
    if (status !== "completed") return [] as string[];
    const issues: string[] = [];

    const mandatory = [
      ["Cylinder type", data.cylinder_type],
      ["Work type", data.work_type],
      ["Jurisdiction", data.jurisdiction],
      ["Manufacturer", data.manufacturer],
      ["Model", data.model],
      ["Serial number", data.serial_number],
      ["Capacity", data.capacity_litres],
      ["Heat source", data.heat_source],
      ["Engineer declaration", data.engineer_declaration],
      ["Customer handover", data.customer_handover],
      ["Engineer signature", data.engineer_signature_data],
      ["Final status", data.final_status],
    ] as const;

    for (const [label, value] of mandatory) {
      if (requiredMissing(value)) issues.push(`${label} is required before completion`);
    }

    if (!photoUploads.cylinder_data_plate) {
      issues.push("Cylinder data plate photo is required");
    }

    if (isUnvented(data)) {
      if (!photoUploads.tundish_photo) issues.push("Tundish photo is required for unvented cylinders");
      if (!photoUploads.discharge_termination_photo) issues.push("Discharge termination photo is required for unvented cylinders");
    }

    if (data.bath_present === "yes" && requiredMissing(data.bath_hot_water_temperature_c)) {
      issues.push("Bath hot water temperature is required when bath is present");
    }

    if (data.bath_present === "yes" && data.tmv_fitted === "no" && requiredMissing(data.tmv_absence_note)) {
      issues.push("Provide a note when TMV/blending valve is not fitted");
    }

    if (warningHighTemp && requiredMissing(data.defect_notes)) {
      issues.push("Defect/action notes are required when bath temperature is above 48C");
    }

    if (isSafetyFailure(data) && requiredMissing(data.defect_notes)) {
      issues.push("Defect notes are required when any safety-critical check fails");
    }

    if (data.final_status === "Commissioned and safe to use" && (isSafetyFailure(data) || data.d2_terminates_safely === "fail")) {
      issues.push("Cannot set final status to 'Commissioned and safe to use' while safety-critical failures exist");
    }

    if ((data.defect_severity === "Safety issue" || data.defect_severity === "Immediate danger / do not use") && !data.defects_resolved && data.final_status === "Commissioned and safe to use") {
      issues.push("Cannot mark as safe while unresolved safety defects remain");
    }

    return issues;
  };

  const buildPayload = (data: FormValues, status: "draft" | "completed") => ({
    form_status: status,
    jurisdiction: data.jurisdiction,
    cylinder_type: data.cylinder_type,
    installation_type: {
      cylinder_type: data.cylinder_type,
      work_type: data.work_type,
      jurisdiction: data.jurisdiction,
      compliance_route: data.compliance_route,
      notification_reference: data.notification_reference,
      engineer_declaration: data.engineer_declaration,
      customer_handover: data.customer_handover,
    },
    cylinder_details: {
      manufacturer: data.manufacturer,
      model: data.model,
      serial_number: data.serial_number,
      capacity_litres: data.capacity_litres,
      heat_source: data.heat_source,
      max_working_pressure_bar: data.max_working_pressure_bar,
      operating_pressure_bar: data.operating_pressure_bar,
      manufacturer_instructions_available: data.manufacturer_instructions_available,
    },
    safety_controls: {
      cylinder_thermostat: data.cylinder_thermostat,
      thermal_cut_out: data.thermal_cut_out,
      immersion_thermostat_overheat: data.immersion_thermostat_overheat,
      motorised_valve_operation: data.motorised_valve_operation,
      tp_relief_valve: data.tp_relief_valve,
      expansion_relief_valve: data.expansion_relief_valve,
      safety_valve_ratings_recorded: data.safety_valve_ratings_recorded,
      no_isolation_valve_before_relief: data.no_isolation_valve_before_relief,
      safety_valves_manually_tested: data.safety_valves_manually_tested,
      discharge_visible_at_tundish: data.discharge_visible_at_tundish,
    },
    expansion_cold_inlet: {
      incoming_static_pressure_bar: data.incoming_static_pressure_bar,
      prv_fitted: data.prv_fitted,
      prv_setting_bar: data.prv_setting_bar,
      expansion_method: data.expansion_method,
      vessel_size_litres: data.vessel_size_litres,
      vessel_precharge_checked: data.vessel_precharge_checked,
      vessel_precharge_pressure_bar: data.vessel_precharge_pressure_bar,
      cold_control_group: data.cold_control_group,
      strainer_check_valve: data.strainer_check_valve,
      no_leaks: data.no_leaks,
    },
    discharge_pipework: {
      tundish_fitted: data.tundish_fitted,
      tundish_visible_positioned: data.tundish_visible_positioned,
      valve_to_tundish_length_ok: data.valve_to_tundish_length_ok,
      d1_pipe_size: data.d1_pipe_size,
      d2_pipe_size: data.d2_pipe_size,
      d2_continuous_fall: data.d2_continuous_fall,
      d2_terminates_safely: data.d2_terminates_safely,
      termination_location: data.discharge_termination_location,
    },
    temperature_readings: {
      cylinder_thermostat_setting_c: data.cylinder_thermostat_setting_c,
      stored_hot_water_temp_c: data.stored_hot_water_temp_c,
      nearest_hot_outlet_temp_c: data.nearest_hot_outlet_temp_c,
      bath_present: data.bath_present,
      bath_hot_water_temperature_c: data.bath_hot_water_temperature_c,
      tmv_fitted: data.tmv_fitted,
      tmv_absence_note: data.tmv_absence_note,
    },
    functional_tests: {
      filled_and_purged: data.filled_and_purged,
      heated_to_operating_temp: data.heated_to_operating_temp,
      controls_cycled: data.controls_cycled,
      safety_valves_tested: data.safety_valves_tested,
      no_leaks_after_heat_up: data.no_leaks_after_heat_up,
      no_unwanted_discharge: data.no_unwanted_discharge,
      warning_label_visible: data.warning_label_visible,
      user_instructions_explained: data.user_instructions_explained,
    },
    defects: {
      defects_found: data.defects_found,
      defect_severity: data.defect_severity,
      defect_notes: data.defect_notes,
      remedial_action: data.remedial_action,
      further_work_required: data.further_work_required,
      resolved: data.defects_resolved,
    },
    final_status: data.final_status,
    engineer_signature_data: data.engineer_signature_data,
    customer_signature_data: data.customer_signature_data,
    photo_uploads: {
      cylinder_data_plate: photoUploads.cylinder_data_plate,
      tundish_photo: photoUploads.tundish_photo,
      discharge_termination_photo: photoUploads.discharge_termination_photo,
      defect_photos: photoUploads.defect_photos,
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!jobId || locked) return;
    const submitStatus = pendingStatusRef.current;
    const issues = frontEndIssues(data, submitStatus);
    if (issues.length > 0) {
      toast({ title: "Form incomplete", description: issues[0], variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(data, submitStatus);
      if (existing) {
        await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/dhw-cylinder-commissioning`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/dhw-cylinder-commissioning`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      toast({ title: submitStatus === "completed" ? "Completed and locked" : "Draft saved" });
      await loadRecord();
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unable to save form", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!jobId || !existing?.id) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/forms/dhw_cylinder_commissioning_record/${existing.id}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dhw-cylinder-commissioning-${jobId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Unable to export PDF", variant: "destructive" });
    }
  };

  const unlockAsAdmin = async () => {
    if (!jobId || !isAdmin) return;
    const note = window.prompt("Admin override note (required for audit):", "") || "";
    if (!note.trim()) {
      toast({ title: "Override note required", description: "Please provide an admin override note.", variant: "destructive" });
      return;
    }
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/dhw-cylinder-commissioning/admin-unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      toast({ title: "Unlocked", description: "Form unlocked with admin audit entry." });
      await loadRecord();
    } catch (err: unknown) {
      toast({ title: "Unlock failed", description: err instanceof Error ? err.message : "Unlock failed", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="p-8">Loading form...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-24 space-y-4">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mt-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <Card className="p-4 sm:p-5 border-border/60">
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">DHW Cylinder Commissioning Record</h1>
            <p className="text-sm text-muted-foreground mt-1">Compact on-site commissioning form for domestic hot water cylinders.</p>
          </div>
          <div className="flex gap-2">
            {existing?.id && (
              <Button variant="outline" onClick={exportPdf}>
                <FileDown className="w-4 h-4 mr-1.5" /> Export PDF
              </Button>
            )}
            {locked && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border">
                <Lock className="w-3 h-3 mr-1" /> Locked
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Completion progress</span>
            <span>{completionChecks}%</span>
          </div>
          <Progress value={completionChecks} className="h-2" />
        </div>

        {jurisdictionInfo && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">{jurisdictionInfo}</div>
        )}

        {values.heat_source.includes("Solar thermal") || values.heat_source.includes("Solid fuel") ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>Confirm high-temperature protection and blending controls are suitable for this heat source.</span>
          </div>
        ) : null}

        {warningHighTemp && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>Bath water temperature exceeds 48C. Defect/action note is required.</span>
          </div>
        )}

        {locked && isAdmin && (
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={unlockAsAdmin}>
              <Unlock className="w-4 h-4 mr-1.5" /> Admin unlock with audit
            </Button>
          </div>
        )}
      </Card>

      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <div className={cn("space-y-3", locked && "pointer-events-none opacity-80")}>
        <SectionCard title="1. Installation Type" subtitle="Basic compliance context" open={openSections.install} onOpenChange={(next) => setOpenSections((p) => ({ ...p, install: next }))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cylinder type *</Label>
              <select className="w-full h-10 rounded-md border px-3 text-sm" {...register("cylinder_type")} disabled={locked}>
                <option value="">Select</option>
                <option>Unvented</option><option>Vented</option><option>Thermal store</option><option>Direct</option><option>Indirect</option><option>Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Work type *</Label>
              <select className="w-full h-10 rounded-md border px-3 text-sm" {...register("work_type")} disabled={locked}>
                <option value="">Select</option>
                <option>New installation</option><option>Replacement</option><option>Repair</option><option>Service / recommission</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Jurisdiction *</Label>
              <select className="w-full h-10 rounded-md border px-3 text-sm" {...register("jurisdiction")} disabled={locked}>
                <option value="">Select</option>
                <option>England</option><option>Wales</option><option>Scotland</option><option>Northern Ireland</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Compliance route</Label>
              <select className="w-full h-10 rounded-md border px-3 text-sm" {...register("compliance_route")} disabled={locked}>
                <option value="">Select</option>
                <option>Competent Person Scheme</option><option>Building Control notified</option><option>Notifiable work not required</option><option>Other / unknown</option>
              </select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Notification / certificate reference</Label>
              <Input {...register("notification_reference")} disabled={locked} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="2. Cylinder Details" subtitle="Identity and pressure data" open={openSections.details} onOpenChange={(next) => setOpenSections((p) => ({ ...p, details: next }))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Manufacturer *</Label><Input {...register("manufacturer")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Model *</Label><Input {...register("model")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Serial number *</Label><Input {...register("serial_number")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Capacity (L) *</Label><Input type="number" {...register("capacity_litres")} disabled={locked} /></div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Heat source *</Label>
              <div className="flex flex-wrap gap-2">
                {["Boiler", "Immersion heater", "Heat pump", "Solar thermal", "Solid fuel", "Other"].map((source) => {
                  const active = values.heat_source.includes(source);
                  return (
                    <button
                      key={source}
                      type="button"
                      disabled={locked}
                      className={cn("px-2.5 py-1.5 rounded-md border text-xs", active ? "bg-primary/10 border-primary text-primary" : "bg-white border-border text-muted-foreground")}
                      onClick={() => {
                        const next = active ? values.heat_source.filter((x) => x !== source) : [...values.heat_source, source];
                        setValue("heat_source", next, { shouldDirty: true });
                      }}
                    >
                      {source}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5"><Label>Max working pressure (bar) *</Label><Input type="number" step="0.1" {...register("max_working_pressure_bar")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Operating pressure (bar) *</Label><Input type="number" step="0.1" {...register("operating_pressure_bar")} disabled={locked} /></div>
            <div className="space-y-1.5">
              <Label>Manufacturer instructions *</Label>
              <StatusButtons value={values.manufacturer_instructions_available} onChange={(next) => setValue("manufacturer_instructions_available", next as FormValues["manufacturer_instructions_available"])} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
            </div>
            <div className="sm:col-span-2">
              <PhotoUploadField label="Cylinder data plate photo" required fileRef={photoUploads.cylinder_data_plate} jobId={jobId!} disabled={locked} onChange={(next) => setPhotoUploads((p) => ({ ...p, cylinder_data_plate: next }))} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="3. Safety Controls" subtitle="Safety-critical checks" open={openSections.safety} onOpenChange={(next) => setOpenSections((p) => ({ ...p, safety: next }))}>
          <SafetyLine label="Cylinder thermostat fitted and operational" value={values.cylinder_thermostat} onChange={(v) => setValue("cylinder_thermostat", v)} />
          <SafetyLine label="Non-self-resetting thermal cut-out fitted" value={values.thermal_cut_out} onChange={(v) => setValue("thermal_cut_out", v)} />
          <SafetyLine label="Immersion thermostat and overheat cut-out checked" value={values.immersion_thermostat_overheat} onChange={(v) => setValue("immersion_thermostat_overheat", v)} required={values.heat_source.includes("Immersion heater")} />
          <SafetyLine label="Motorised valve fitted and operating correctly" value={values.motorised_valve_operation} onChange={(v) => setValue("motorised_valve_operation", v)} required={values.heat_source.includes("Boiler") || values.heat_source.includes("Heat pump")} />
          <SafetyLine label="Temperature/pressure relief valve fitted" value={values.tp_relief_valve} onChange={(v) => setValue("tp_relief_valve", v)} />
          <SafetyLine label="Expansion relief valve fitted" value={values.expansion_relief_valve} onChange={(v) => setValue("expansion_relief_valve", v)} />
          <div className="space-y-1.5">
            <Label>Safety valve ratings recorded</Label>
            <StatusButtons value={values.safety_valve_ratings_recorded} onChange={(next) => setValue("safety_valve_ratings_recorded", next as FormValues["safety_valve_ratings_recorded"])} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          </div>
          <SafetyLine label="No isolation valve between cylinder and safety relief valve" value={values.no_isolation_valve_before_relief} onChange={(v) => setValue("no_isolation_valve_before_relief", v)} />
          <SafetyLine label="Safety valves manually tested and reseated" value={values.safety_valves_manually_tested} onChange={(v) => setValue("safety_valves_manually_tested", v)} />
          <SafetyLine label="Discharge visible at tundish during test" value={values.discharge_visible_at_tundish} onChange={(v) => setValue("discharge_visible_at_tundish", v)} />
        </SectionCard>

        <SectionCard title="4. Expansion and Cold Inlet" open={openSections.expansion} onOpenChange={(next) => setOpenSections((p) => ({ ...p, expansion: next }))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Incoming static pressure (bar)</Label><Input type="number" step="0.1" {...register("incoming_static_pressure_bar")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>PRV setting (bar)</Label><Input type="number" step="0.1" {...register("prv_setting_bar")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Pressure reducing valve fitted</Label><StatusButtons value={values.prv_fitted} onChange={(next) => setValue("prv_fitted", next as YesNoNa)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>Expansion method</Label><select className="w-full h-10 rounded-md border px-3 text-sm" {...register("expansion_method")} disabled={locked}><option value="">Select</option><option>Internal air gap</option><option>External expansion vessel</option><option>Other</option><option>Not applicable</option></select></div>
            <div className="space-y-1.5"><Label>Expansion vessel size (L)</Label><Input type="number" step="0.1" {...register("vessel_size_litres")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Pre-charge pressure (bar)</Label><Input type="number" step="0.1" {...register("vessel_precharge_pressure_bar")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Pre-charge checked</Label><StatusButtons value={values.vessel_precharge_checked} onChange={(next) => setValue("vessel_precharge_checked", next as YesNoNa)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>Cold control group fitted correctly</Label><StatusButtons value={values.cold_control_group} onChange={(next) => setValue("cold_control_group", next as PassFailNa)} options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>Strainer/check valve arrangement</Label><StatusButtons value={values.strainer_check_valve} onChange={(next) => setValue("strainer_check_valve", next as PassFailNa)} options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>No leaks on cold inlet/expansion</Label><StatusButtons value={values.no_leaks} onChange={(next) => setValue("no_leaks", next as PassFailNa)} options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }]} /></div>
          </div>
        </SectionCard>

        <SectionCard title="5. Tundish and Discharge Pipework" open={openSections.discharge} onOpenChange={(next) => setOpenSections((p) => ({ ...p, discharge: next }))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tundish fitted</Label><StatusButtons value={values.tundish_fitted} onChange={(next) => setValue("tundish_fitted", next as YesNoNa)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>Tundish visible/positioned</Label><StatusButtons value={values.tundish_visible_positioned} onChange={(next) => setValue("tundish_visible_positioned", next as PassFailNa)} options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>Valve to tundish length acceptable</Label><StatusButtons value={values.valve_to_tundish_length_ok} onChange={(next) => setValue("valve_to_tundish_length_ok", next as PassFailNa)} options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>D1 pipe size</Label><Input {...register("d1_pipe_size")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>D2 pipe size</Label><Input {...register("d2_pipe_size")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>D2 has continuous fall</Label><StatusButtons value={values.d2_continuous_fall} onChange={(next) => setValue("d2_continuous_fall", next as PassFailNa)} options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="space-y-1.5"><Label>D2 terminates safely</Label><StatusButtons value={values.d2_terminates_safely} onChange={(next) => setValue("d2_terminates_safely", next as PassFailNa)} options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "not_applicable", label: "N/A" }]} /></div>
            <div className="sm:col-span-2 space-y-1.5"><Label>Termination location</Label><Input {...register("discharge_termination_location")} disabled={locked} /></div>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PhotoUploadField label="Tundish photo" required={isUnvented(values)} fileRef={photoUploads.tundish_photo} jobId={jobId!} disabled={locked} onChange={(next) => setPhotoUploads((p) => ({ ...p, tundish_photo: next }))} />
              <PhotoUploadField label="Discharge termination photo" required={isUnvented(values)} fileRef={photoUploads.discharge_termination_photo} jobId={jobId!} disabled={locked} onChange={(next) => setPhotoUploads((p) => ({ ...p, discharge_termination_photo: next }))} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="6. Temperature Readings" open={openSections.temp} onOpenChange={(next) => setOpenSections((p) => ({ ...p, temp: next }))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Cylinder thermostat setting (C)</Label><Input type="number" step="0.1" {...register("cylinder_thermostat_setting_c")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Stored hot water temp (C)</Label><Input type="number" step="0.1" {...register("stored_hot_water_temp_c")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Nearest hot outlet temp (C)</Label><Input type="number" step="0.1" {...register("nearest_hot_outlet_temp_c")} disabled={locked} /></div>
            <div className="space-y-1.5"><Label>Bath present</Label><StatusButtons value={values.bath_present} onChange={(next) => setValue("bath_present", next as FormValues["bath_present"])} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></div>
            {values.bath_present === "yes" && <div className="space-y-1.5"><Label>Bath hot water temp (C)</Label><Input type="number" step="0.1" {...register("bath_hot_water_temperature_c")} disabled={locked} /></div>}
            {values.bath_present === "yes" && <div className="space-y-1.5"><Label>TMV/blending valve fitted</Label><StatusButtons value={values.tmv_fitted} onChange={(next) => setValue("tmv_fitted", next as YesNoNa)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_applicable", label: "N/A" }]} /></div>}
            {values.bath_present === "yes" && values.tmv_fitted === "no" && <div className="sm:col-span-2 space-y-1.5"><Label>Reason TMV not fitted</Label><Textarea rows={2} {...register("tmv_absence_note")} disabled={locked} /></div>}
          </div>
        </SectionCard>

        <SectionCard title="7. Functional Test Summary" open={openSections.functional} onOpenChange={(next) => setOpenSections((p) => ({ ...p, functional: next }))}>
          <SafetyLine label="Cylinder filled and air purged" value={values.filled_and_purged} onChange={(v) => setValue("filled_and_purged", v)} />
          <SafetyLine label="System heated to operating temperature" value={values.heated_to_operating_temp} onChange={(v) => setValue("heated_to_operating_temp", v)} />
          <SafetyLine label="Controls cycled correctly" value={values.controls_cycled} onChange={(v) => setValue("controls_cycled", v)} />
          <SafetyLine label="Safety valves tested" value={values.safety_valves_tested} onChange={(v) => setValue("safety_valves_tested", v)} />
          <SafetyLine label="No leaks after heat-up" value={values.no_leaks_after_heat_up} onChange={(v) => setValue("no_leaks_after_heat_up", v)} />
          <SafetyLine label="No unwanted discharge in normal operation" value={values.no_unwanted_discharge} onChange={(v) => setValue("no_unwanted_discharge", v)} />
          <div className="space-y-1.5"><Label>Warning label visible</Label><StatusButtons value={values.warning_label_visible} onChange={(next) => setValue("warning_label_visible", next as YesNoNa)} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_applicable", label: "N/A" }]} /></div>
          <div className="space-y-1.5"><Label>User instructions left/explained</Label><StatusButtons value={values.user_instructions_explained} onChange={(next) => setValue("user_instructions_explained", next as FormValues["user_instructions_explained"])} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></div>
        </SectionCard>

        <SectionCard title="8. Defects / Limitations" open={openSections.defects} onOpenChange={(next) => setOpenSections((p) => ({ ...p, defects: next }))}>
          <div className="space-y-1.5"><Label>Defects found</Label><StatusButtons value={values.defects_found} onChange={(next) => setValue("defects_found", next as FormValues["defects_found"])} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></div>
          {(values.defects_found === "yes" || safetyFailure || warningHighTemp) && (
            <>
              <div className="space-y-1.5">
                <Label>Defect severity</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" {...register("defect_severity")} disabled={locked}>
                  <option value="">Select</option>
                  <option>Advisory</option><option>Compliance issue</option><option>Safety issue</option><option>Immediate danger / do not use</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label>Defect notes</Label><Textarea rows={3} {...register("defect_notes")} disabled={locked} /></div>
              <div className="space-y-1.5"><Label>Remedial action taken</Label><Textarea rows={2} {...register("remedial_action")} disabled={locked} /></div>
              <div className="space-y-1.5"><Label>Further work required</Label><Textarea rows={2} {...register("further_work_required")} disabled={locked} /></div>
              {(values.defect_severity === "Safety issue" || values.defect_severity === "Immediate danger / do not use") && (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register("defects_resolved")} disabled={locked} /> Mark safety defect as resolved
                </label>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Defect photos (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {photoUploads.defect_photos.map((f, idx) => (
                <div key={`${f.id || "f"}-${idx}`} className="w-20 h-20 rounded border overflow-hidden relative">
                  {f.signed_url ? <img src={f.thumbnail_signed_url || f.signed_url || ""} alt="defect" className="w-full h-full object-cover" /> : null}
                </div>
              ))}
            </div>
            <PhotoUploadField
              label="Add defect photo"
              fileRef={null}
              jobId={jobId!}
              disabled={locked}
              onChange={(next) => {
                if (next) setPhotoUploads((p) => ({ ...p, defect_photos: [...p.defect_photos, next] }));
              }}
            />
          </div>
        </SectionCard>

        <SectionCard title="9. Final Status and Signatures" open={openSections.final} onOpenChange={(next) => setOpenSections((p) => ({ ...p, final: next }))}>
          <div className="space-y-1.5">
            <Label>Final commissioning status *</Label>
            <select className="w-full h-10 rounded-md border px-3 text-sm" {...register("final_status")} disabled={locked}>
              <option value="">Select</option>
              <option>Commissioned and safe to use</option>
              <option>Commissioned with advisory notes</option>
              <option>Not commissioned</option>
              <option>Isolated / not safe to use</option>
              <option>Further work required</option>
            </select>
          </div>

          <label className="flex items-start gap-2 rounded border p-3 text-sm">
            <input type="checkbox" className="mt-1" {...register("engineer_declaration")} disabled={locked} />
            <span>I confirm that the DHW cylinder has been checked and commissioned in accordance with the manufacturer instructions and applicable regulations/standards for the selected jurisdiction, subject to recorded defects or limitations.</span>
          </label>
          <label className="flex items-start gap-2 rounded border p-3 text-sm">
            <input type="checkbox" className="mt-1" {...register("customer_handover")} disabled={locked} />
            <span>The customer has been shown controls, isolation point, warning label and discharge/tundish arrangement where applicable, and advised what to do if discharge occurs.</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Engineer signature *</Label>
              <div className="rounded-md border p-2 bg-white">
                <SignatureCanvas
                  ref={engineerSigRef}
                  canvasProps={{ width: 420, height: 120, className: "w-full h-[120px]" }}
                  penColor="#0f172a"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => {
                  const dataUrl = engineerSigRef.current?.toDataURL("image/png");
                  if (dataUrl) setValue("engineer_signature_data", dataUrl, { shouldDirty: true });
                }}>
                  Capture
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => {
                  engineerSigRef.current?.clear();
                  setValue("engineer_signature_data", "", { shouldDirty: true });
                }}>
                  Clear
                </Button>
                {values.engineer_signature_data ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Saved</Badge> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Customer signature (optional)</Label>
              <div className="rounded-md border p-2 bg-white">
                <SignatureCanvas
                  ref={customerSigRef}
                  canvasProps={{ width: 420, height: 120, className: "w-full h-[120px]" }}
                  penColor="#0f172a"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => {
                  const dataUrl = customerSigRef.current?.toDataURL("image/png");
                  if (dataUrl) setValue("customer_signature_data", dataUrl, { shouldDirty: true });
                }}>
                  Capture
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => {
                  customerSigRef.current?.clear();
                  setValue("customer_signature_data", "", { shouldDirty: true });
                }}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
        </div>

        <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur border-t -mx-3 sm:-mx-4 px-3 sm:px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-2 justify-between">
            <Link href={`/jobs/${jobId}`}>
              <Button type="button" variant="outline">Back to Job</Button>
            </Link>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving || locked} onClick={() => { pendingStatusRef.current = "draft"; setPendingStatus("draft"); void handleSubmit(onSubmit)(); }}>
                {saving && pendingStatus === "draft" ? "Saving..." : "Save Draft"}
              </Button>
              <Button type="button" disabled={saving || locked} onClick={() => { pendingStatusRef.current = "completed"; setPendingStatus("completed"); void handleSubmit(onSubmit)(); }}>
                {saving && pendingStatus === "completed" ? "Completing..." : "Complete and Lock"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function SafetyLine({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: PassFailNa;
  onChange: (v: PassFailNa) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">{label}{required ? <span className="text-red-600">*</span> : null}</Label>
      <StatusButtons
        value={value}
        onChange={(next) => onChange(next as PassFailNa)}
        options={[{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "not_applicable", label: "N/A" }]}
      />
    </div>
  );
}
