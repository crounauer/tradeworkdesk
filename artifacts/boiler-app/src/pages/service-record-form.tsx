import { useForm } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { useCreateServiceRecord, useGetServiceRecordByJob, useUpdateServiceRecord, useGetJob } from "@workspace/api-client-react";
import type { CreateServiceRecordBody } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, FileDown, Clock, Wrench, Shield, AlertTriangle, Flame, Gauge } from "lucide-react";
import { Link } from "wouter";
import { generateServiceRecordPdf, generateCp12Pdf } from "@/lib/pdf-generator";

interface ServiceRecordFormData {
  arrival_time: string;
  departure_time: string;
  visual_inspection: string;
  appliance_condition: string;
  flue_inspection: string;
  combustion_co2: string;
  combustion_co: string;
  combustion_o2: string;
  combustion_temp: string;
  combustion_efficiency: string;
  smoke_test: string;
  smoke_number: string;
  burner_cleaned: boolean;
  heat_exchanger_cleaned: boolean;
  nozzle_checked: boolean;
  nozzle_replaced: boolean;
  nozzle_size_fitted: string;
  electrodes_checked: boolean;
  electrodes_replaced: boolean;
  filter_checked: boolean;
  filter_cleaned: boolean;
  filter_replaced: boolean;
  oil_line_checked: boolean;
  fire_valve_checked: boolean;
  seals_gaskets_checked: boolean;
  seals_gaskets_replaced: boolean;
  controls_checked: boolean;
  thermostat_checked: boolean;
  safety_devices_checked: boolean;
  safety_devices_notes: string;
  leaks_found: boolean;
  leaks_details: string;
  defects_found: boolean;
  defects_details: string;
  advisories: string;
  parts_required: string;
  work_completed: string;
  appliance_safe: boolean;
  follow_up_required: boolean;
  follow_up_notes: string;
  next_service_due: string;
  additional_notes: string;
  gas_tightness_pass: boolean;
  gas_standing_pressure: string;
  gas_working_pressure: string;
  gas_operating_pressure: string;
  gas_burner_pressure: string;
  gas_heat_input: string;
  co_co2_ratio: string;
  flue_spillage_test: string;
  ventilation_adequate: boolean;
  gas_meter_type: string;
  gas_safe_engineer_id: string;
  cp12_certificate_number: string;
  landlord_certificate: boolean;
  appliance_classification: "safe" | "at_risk" | "immediately_dangerous" | "not_to_current_standards" | "";
  warning_notice_issued: boolean;
  warning_notice_type: string;
  warning_notice_details: string;
  customer_warned: boolean;
  gas_valve_checked: boolean;
  injectors_checked: boolean;
  pilot_checked: boolean;
  ignition_checked: boolean;
  gas_pressure_checked: boolean;
}

export default function ServiceRecordForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetServiceRecordByJob(jobId!);
  const { data: job } = useGetJob(jobId!);

  const createMutation = useCreateServiceRecord();
  const updateMutation = useUpdateServiceRecord();

  const { register, handleSubmit, getValues, reset, watch } = useForm<ServiceRecordFormData>();

  const fuelType = useMemo(() => {
    return job?.appliance?.fuel_type || "oil";
  }, [job]);

  const isGas = fuelType === "gas" || fuelType === "lpg";
  const isOil = !isGas;

  const watchClassification = watch("appliance_classification");
  const isAtRisk = watchClassification === "at_risk";
  const isImmediatelyDangerous = watchClassification === "immediately_dangerous";
  const showWarningNotice = isAtRisk || isImmediatelyDangerous;

  useEffect(() => {
    if (existingRecord) {
      reset({
        arrival_time: existingRecord.arrival_time || "",
        departure_time: existingRecord.departure_time || "",
        visual_inspection: existingRecord.visual_inspection || "",
        appliance_condition: existingRecord.appliance_condition || "",
        flue_inspection: existingRecord.flue_inspection || "",
        combustion_co2: String(existingRecord.combustion_co2 ?? ""),
        combustion_co: String(existingRecord.combustion_co ?? ""),
        combustion_o2: String(existingRecord.combustion_o2 ?? ""),
        combustion_temp: String(existingRecord.combustion_temp ?? ""),
        combustion_efficiency: String(existingRecord.combustion_efficiency ?? ""),
        smoke_test: existingRecord.smoke_test || "",
        smoke_number: String(existingRecord.smoke_number ?? ""),
        burner_cleaned: existingRecord.burner_cleaned ?? false,
        heat_exchanger_cleaned: existingRecord.heat_exchanger_cleaned ?? false,
        nozzle_checked: existingRecord.nozzle_checked ?? false,
        nozzle_replaced: existingRecord.nozzle_replaced ?? false,
        nozzle_size_fitted: existingRecord.nozzle_size_fitted || "",
        electrodes_checked: existingRecord.electrodes_checked ?? false,
        electrodes_replaced: existingRecord.electrodes_replaced ?? false,
        filter_checked: existingRecord.filter_checked ?? false,
        filter_cleaned: existingRecord.filter_cleaned ?? false,
        filter_replaced: existingRecord.filter_replaced ?? false,
        oil_line_checked: existingRecord.oil_line_checked ?? false,
        fire_valve_checked: existingRecord.fire_valve_checked ?? false,
        seals_gaskets_checked: existingRecord.seals_gaskets_checked ?? false,
        seals_gaskets_replaced: existingRecord.seals_gaskets_replaced ?? false,
        controls_checked: existingRecord.controls_checked ?? false,
        thermostat_checked: existingRecord.thermostat_checked ?? false,
        safety_devices_checked: existingRecord.safety_devices_checked ?? false,
        safety_devices_notes: existingRecord.safety_devices_notes || "",
        leaks_found: existingRecord.leaks_found ?? false,
        leaks_details: existingRecord.leaks_details || "",
        defects_found: existingRecord.defects_found ?? false,
        defects_details: existingRecord.defects_details || "",
        advisories: existingRecord.advisories || "",
        parts_required: existingRecord.parts_required || "",
        work_completed: existingRecord.work_completed || "",
        appliance_safe: existingRecord.appliance_safe ?? false,
        follow_up_required: existingRecord.follow_up_required ?? false,
        follow_up_notes: existingRecord.follow_up_notes || "",
        next_service_due: existingRecord.next_service_due || "",
        additional_notes: existingRecord.additional_notes || "",
        gas_tightness_pass: existingRecord.gas_tightness_pass ?? false,
        gas_standing_pressure: existingRecord.gas_standing_pressure || "",
        gas_working_pressure: existingRecord.gas_working_pressure || "",
        gas_operating_pressure: existingRecord.gas_operating_pressure || "",
        gas_burner_pressure: existingRecord.gas_burner_pressure || "",
        gas_heat_input: existingRecord.gas_heat_input || "",
        co_co2_ratio: existingRecord.co_co2_ratio || "",
        flue_spillage_test: existingRecord.flue_spillage_test || "",
        ventilation_adequate: existingRecord.ventilation_adequate ?? false,
        gas_meter_type: existingRecord.gas_meter_type || "",
        gas_safe_engineer_id: existingRecord.gas_safe_engineer_id || "",
        cp12_certificate_number: existingRecord.cp12_certificate_number || "",
        landlord_certificate: existingRecord.landlord_certificate ?? false,
        appliance_classification: (existingRecord.appliance_classification as ServiceRecordFormData["appliance_classification"]) || "",
        warning_notice_issued: existingRecord.warning_notice_issued ?? false,
        warning_notice_type: existingRecord.warning_notice_type || "",
        warning_notice_details: existingRecord.warning_notice_details || "",
        customer_warned: existingRecord.customer_warned ?? false,
        gas_valve_checked: existingRecord.gas_valve_checked ?? false,
        injectors_checked: existingRecord.injectors_checked ?? false,
        pilot_checked: existingRecord.pilot_checked ?? false,
        ignition_checked: existingRecord.ignition_checked ?? false,
        gas_pressure_checked: existingRecord.gas_pressure_checked ?? false,
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: ServiceRecordFormData) => {
    if (!user?.id) return;

    const payload: CreateServiceRecordBody = {
      job_id: jobId!,
      technician_id: user.id,
      arrival_time: data.arrival_time || undefined,
      departure_time: data.departure_time || undefined,
      visual_inspection: data.visual_inspection || undefined,
      appliance_condition: data.appliance_condition || undefined,
      flue_inspection: data.flue_inspection || undefined,
      combustion_co2: data.combustion_co2 || undefined,
      combustion_co: data.combustion_co || undefined,
      combustion_o2: data.combustion_o2 || undefined,
      combustion_temp: data.combustion_temp || undefined,
      combustion_efficiency: data.combustion_efficiency || undefined,
      burner_cleaned: data.burner_cleaned,
      heat_exchanger_cleaned: data.heat_exchanger_cleaned,
      seals_gaskets_checked: data.seals_gaskets_checked,
      seals_gaskets_replaced: data.seals_gaskets_replaced,
      controls_checked: data.controls_checked,
      thermostat_checked: data.thermostat_checked,
      safety_devices_checked: data.safety_devices_checked,
      safety_devices_notes: data.safety_devices_notes || undefined,
      leaks_found: data.leaks_found,
      leaks_details: data.leaks_details || undefined,
      defects_found: data.defects_found,
      defects_details: data.defects_details || undefined,
      advisories: data.advisories || undefined,
      parts_required: data.parts_required || undefined,
      work_completed: data.work_completed || undefined,
      appliance_safe: data.appliance_safe,
      follow_up_required: data.follow_up_required,
      follow_up_notes: data.follow_up_notes || undefined,
      next_service_due: data.next_service_due || undefined,
      additional_notes: data.additional_notes || undefined,
      ...(isOil ? {
        smoke_test: data.smoke_test || undefined,
        smoke_number: data.smoke_number || undefined,
        nozzle_checked: data.nozzle_checked,
        nozzle_replaced: data.nozzle_replaced,
        nozzle_size_fitted: data.nozzle_size_fitted || undefined,
        electrodes_checked: data.electrodes_checked,
        electrodes_replaced: data.electrodes_replaced,
        filter_checked: data.filter_checked,
        filter_cleaned: data.filter_cleaned,
        filter_replaced: data.filter_replaced,
        oil_line_checked: data.oil_line_checked,
        fire_valve_checked: data.fire_valve_checked,
      } : {}),
      ...(isGas ? {
        gas_tightness_pass: data.gas_tightness_pass,
        gas_standing_pressure: data.gas_standing_pressure || undefined,
        gas_working_pressure: data.gas_working_pressure || undefined,
        gas_operating_pressure: data.gas_operating_pressure || undefined,
        gas_burner_pressure: data.gas_burner_pressure || undefined,
        gas_heat_input: data.gas_heat_input || undefined,
        co_co2_ratio: data.co_co2_ratio || undefined,
        flue_spillage_test: data.flue_spillage_test || undefined,
        ventilation_adequate: data.ventilation_adequate,
        gas_meter_type: data.gas_meter_type || undefined,
        gas_safe_engineer_id: data.gas_safe_engineer_id || undefined,
        cp12_certificate_number: data.cp12_certificate_number || undefined,
        landlord_certificate: data.landlord_certificate,
        appliance_classification: data.appliance_classification || undefined,
        warning_notice_issued: data.warning_notice_issued,
        warning_notice_type: data.warning_notice_type || undefined,
        warning_notice_details: data.warning_notice_details || undefined,
        customer_warned: data.customer_warned,
        gas_valve_checked: data.gas_valve_checked,
        injectors_checked: data.injectors_checked,
        pilot_checked: data.pilot_checked,
        ignition_checked: data.ignition_checked,
        gas_pressure_checked: data.gas_pressure_checked,
      } : {}),
    };

    try {
      if (existingRecord) {
        const { job_id: _jid, technician_id: _tid, ...updatePayload } = payload;
        await updateMutation.mutateAsync({ id: existingRecord.id, data: updatePayload });
        toast({ title: "Updated", description: "Service record updated successfully" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Service record created successfully" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = () => {
    const vals = getValues();
    const customer = job?.customer;
    const property = job?.property;
    const appliance = job?.appliance;
    const technician = job?.technician;

    const commonData = {
      jobId: jobId!,
      customerName: customer ? `${customer.first_name} ${customer.last_name}` : "N/A",
      propertyAddress: property?.address_line1 || "N/A",
      applianceName: appliance ? `${appliance.manufacturer || ""} ${appliance.model || ""}`.trim() || "N/A" : "N/A",
      technicianName: technician?.full_name || user?.email || "N/A",
      scheduledDate: job?.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : new Date().toLocaleDateString(),
    };

    if (isGas) {
      generateCp12Pdf({
        ...commonData,
        serviceRecord: vals,
      });
    } else {
      generateServiceRecordPdf({
        ...commonData,
        serviceRecord: vals,
      });
    }
  };

  if (isLoadingExisting) return <div className="p-8">Loading form...</div>;

  const fuelLabel = isGas ? (fuelType === "lpg" ? "LPG" : "Gas") : "Oil";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">
            {isGas ? "Gas Safety Record (CP12)" : "Oil Service Record"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isGas ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
              <Flame className="w-3 h-3" /> {fuelLabel} Appliance
            </span>
            <p className="text-muted-foreground">Complete all mandatory inspection sections.</p>
          </div>
        </div>
        {existingRecord && (
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Export {isGas ? "CP12" : "PDF"}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {isGas && (
          <Card className="p-6 shadow-sm border-blue-200 bg-blue-50/30">
            <h2 className="font-bold text-lg mb-4 text-blue-700 flex items-center gap-2"><Shield className="w-5 h-5"/> CP12 / Gas Safe Details</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Gas Safe Engineer ID</Label>
                <Input {...register("gas_safe_engineer_id")} placeholder="e.g. 123456" />
              </div>
              <div className="space-y-2">
                <Label>CP12 Certificate Number</Label>
                <Input {...register("cp12_certificate_number")} placeholder="Certificate ref..." />
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 p-3 border rounded-xl bg-white hover:bg-blue-50 cursor-pointer transition-colors text-sm w-full">
                  <input type="checkbox" {...register("landlord_certificate")} className="w-4 h-4 accent-blue-600 rounded" />
                  <span className="font-medium">Landlord Certificate</span>
                </label>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Clock className="w-5 h-5"/> Arrival & Departure</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Arrival Time</Label>
              <Input type="datetime-local" {...register("arrival_time")} />
            </div>
            <div className="space-y-2">
              <Label>Departure Time</Label>
              <Input type="datetime-local" {...register("departure_time")} />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Visual Inspection</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Appliance Condition</Label>
              <Input {...register("appliance_condition")} placeholder="e.g. Good, Satisfactory..." />
            </div>
            <div className="space-y-2">
              <Label>Flue Inspection</Label>
              <Input {...register("flue_inspection")} placeholder="Visual check results..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>General Visual Inspection Notes</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("visual_inspection")} />
            </div>
          </div>
        </Card>

        {isGas && (
          <Card className="p-6 shadow-sm border-blue-200 bg-blue-50/30">
            <h2 className="font-bold text-lg mb-4 text-blue-700 flex items-center gap-2"><Gauge className="w-5 h-5"/> Gas Tightness Test</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Standing Pressure (mbar)</Label>
                <Input {...register("gas_standing_pressure")} placeholder="e.g. 21" />
              </div>
              <div className="space-y-2">
                <Label>Working Pressure (mbar)</Label>
                <Input {...register("gas_working_pressure")} placeholder="e.g. 19.5" />
              </div>
              <div className="space-y-2">
                <Label>Gas Meter Type</Label>
                <Input {...register("gas_meter_type")} placeholder="e.g. U6, E6" />
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 p-3 border rounded-xl bg-white hover:bg-emerald-50 cursor-pointer transition-colors text-sm w-full">
                  <input type="checkbox" {...register("gas_tightness_pass")} className="w-5 h-5 accent-emerald-600 rounded" />
                  <span className="font-medium">Tightness Test Pass</span>
                </label>
              </div>
            </div>
          </Card>
        )}

        {isGas && (
          <Card className="p-6 shadow-sm border-blue-200 bg-blue-50/30">
            <h2 className="font-bold text-lg mb-4 text-blue-700 flex items-center gap-2"><Gauge className="w-5 h-5"/> Gas Pressure Readings</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Operating Pressure (mbar)</Label>
                <Input {...register("gas_operating_pressure")} placeholder="e.g. 12.5" />
              </div>
              <div className="space-y-2">
                <Label>Burner Pressure (mbar)</Label>
                <Input {...register("gas_burner_pressure")} placeholder="e.g. 36" />
              </div>
              <div className="space-y-2">
                <Label>Heat Input (kW)</Label>
                <Input {...register("gas_heat_input")} placeholder="e.g. 24" />
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Combustion Readings</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>CO2 (%)</Label>
              <Input {...register("combustion_co2")} />
            </div>
            <div className="space-y-2">
              <Label>CO (ppm)</Label>
              <Input {...register("combustion_co")} />
            </div>
            <div className="space-y-2">
              <Label>O2 (%)</Label>
              <Input {...register("combustion_o2")} />
            </div>
            <div className="space-y-2">
              <Label>Flue Temp</Label>
              <Input {...register("combustion_temp")} />
            </div>
            <div className="space-y-2">
              <Label>Efficiency (%)</Label>
              <Input {...register("combustion_efficiency")} />
            </div>
          </div>
          {isGas && (
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label>CO/CO2 Ratio</Label>
                <Input {...register("co_co2_ratio")} placeholder="e.g. 0.004" />
              </div>
              <div className="space-y-2">
                <Label>Flue Spillage Test</Label>
                <Input {...register("flue_spillage_test")} placeholder="Pass / Fail / N/A" />
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 p-3 border rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors text-sm w-full">
                  <input type="checkbox" {...register("ventilation_adequate")} className="w-4 h-4 accent-emerald-600 rounded" />
                  <span className="font-medium">Ventilation Adequate</span>
                </label>
              </div>
            </div>
          )}
          {isOil && (
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Smoke Test Result</Label>
                <Input {...register("smoke_test")} placeholder="Pass / Fail / Details" />
              </div>
              <div className="space-y-2">
                <Label>Smoke Number</Label>
                <Input {...register("smoke_number")} />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Wrench className="w-5 h-5"/> Checks & Cleaning</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ["burner_cleaned", "Burner Cleaned", true],
              ["heat_exchanger_cleaned", "Heat Exchanger Cleaned", true],
              ["seals_gaskets_checked", "Seals/Gaskets Checked", true],
              ["seals_gaskets_replaced", "Seals/Gaskets Replaced", true],
              ["controls_checked", "Controls Checked", true],
              ["thermostat_checked", "Thermostat Checked", true],
              ["safety_devices_checked", "Safety Devices Checked", true],
              ...(isOil ? [
                ["nozzle_checked", "Nozzle Checked", true],
                ["nozzle_replaced", "Nozzle Replaced", true],
                ["electrodes_checked", "Electrodes Checked", true],
                ["electrodes_replaced", "Electrodes Replaced", true],
                ["filter_checked", "Filter Checked", true],
                ["filter_cleaned", "Filter Cleaned", true],
                ["filter_replaced", "Filter Replaced", true],
                ["oil_line_checked", "Oil Line Checked", true],
                ["fire_valve_checked", "Fire Valve Checked", true],
              ] : []),
              ...(isGas ? [
                ["gas_valve_checked", "Gas Valve Checked", true],
                ["injectors_checked", "Injectors Checked", true],
                ["pilot_checked", "Pilot Checked", true],
                ["ignition_checked", "Ignition Checked", true],
                ["gas_pressure_checked", "Gas Pressure Checked", true],
              ] : []),
            ] as [string, string, boolean][]).map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors text-sm">
                <input type="checkbox" {...register(name as keyof ServiceRecordFormData)} className="w-4 h-4 accent-primary rounded" />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {isOil && (
              <div className="space-y-2">
                <Label>Nozzle Size Fitted</Label>
                <Input {...register("nozzle_size_fitted")} placeholder="e.g. 0.50 USG 60S" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Safety Devices Notes</Label>
              <Input {...register("safety_devices_notes")} placeholder="Any notes on safety devices..." />
            </div>
          </div>
        </Card>

        {isGas && (
          <Card className={`p-6 shadow-sm ${isImmediatelyDangerous ? "border-red-300 bg-red-50/50" : isAtRisk ? "border-amber-300 bg-amber-50/50" : "border-border/50"}`}>
            <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Appliance Classification</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classification</Label>
                <select {...register("appliance_classification")} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select classification...</option>
                  <option value="safe">Safe</option>
                  <option value="not_to_current_standards">Not to Current Standards (NCS)</option>
                  <option value="at_risk">At Risk (AR)</option>
                  <option value="immediately_dangerous">Immediately Dangerous (ID)</option>
                </select>
              </div>
              {showWarningNotice && (
                <>
                  <div className="space-y-2">
                    <Label className="text-red-700 font-semibold">Warning Notice Type</Label>
                    <select {...register("warning_notice_type")} className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Select type...</option>
                      <option value="at_risk">At Risk (AR)</option>
                      <option value="immediately_dangerous">Immediately Dangerous (ID)</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-red-700 font-semibold">Warning Notice Details</Label>
                    <textarea className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[80px]" {...register("warning_notice_details")} placeholder="Describe the danger/risk and advice given..." />
                  </div>
                  <label className="flex items-center gap-3 p-3 border border-red-300 rounded-xl bg-white hover:bg-red-50 cursor-pointer transition-colors">
                    <input type="checkbox" {...register("warning_notice_issued")} className="w-5 h-5 accent-red-600 rounded" />
                    <span className="font-medium text-red-700">Warning Notice Issued</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-red-300 rounded-xl bg-white hover:bg-red-50 cursor-pointer transition-colors">
                    <input type="checkbox" {...register("customer_warned")} className="w-5 h-5 accent-red-600 rounded" />
                    <span className="font-medium text-red-700">Customer Warned &amp; Acknowledged</span>
                  </label>
                </>
              )}
            </div>
          </Card>
        )}

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Shield className="w-5 h-5"/> Safety & Defects</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("appliance_safe")} className="w-5 h-5 accent-emerald-600 rounded" />
                <span className="font-medium">Appliance Safe to Use</span>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-rose-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("leaks_found")} className="w-5 h-5 accent-rose-600 rounded" />
                <span className="font-medium">{isGas ? "Gas Leaks Found" : "Oil Leaks Found"}</span>
              </label>
              <div className="space-y-2">
                <Label>Leak Details</Label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...register("leaks_details")} placeholder="Describe any leaks..." />
              </div>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-rose-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("defects_found")} className="w-5 h-5 accent-rose-600 rounded" />
                <span className="font-medium">Defects Found</span>
              </label>
              <div className="space-y-2">
                <Label>Defect Details</Label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...register("defects_details")} placeholder="List any defects..." />
              </div>
              <div className="space-y-2">
                <Label>Advisories</Label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...register("advisories")} placeholder="Customer advisories..." />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Work Summary & Follow-up</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Work Completed</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("work_completed")} placeholder="Summary of service work..." />
            </div>
            <div className="space-y-2">
              <Label>Parts Required</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("parts_required")} placeholder="List any parts needed..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Additional Notes</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...register("additional_notes")} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-amber-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("follow_up_required")} className="w-5 h-5 accent-amber-600 rounded" />
                <span className="font-medium">Follow-up Required</span>
              </label>
              <div className="space-y-2">
                <Label>Follow-up Notes</Label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...register("follow_up_notes")} placeholder="Details about follow-up..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Next Service Due</Label>
              <Input type="date" {...register("next_service_due")} />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-4 sticky bottom-6 z-10 bg-background/80 p-4 rounded-2xl backdrop-blur-md border border-border shadow-xl">
          <Button variant="outline" type="button" onClick={() => setLocation(`/jobs/${jobId}`)}>Cancel</Button>
          <Button type="submit" size="lg" className="w-48 shadow-lg shadow-primary/30" disabled={createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : existingRecord ? "Update Record" : "Save Record"}
          </Button>
        </div>
      </form>
    </div>
  );
}
