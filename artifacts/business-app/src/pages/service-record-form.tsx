import { useForm } from "react-hook-form";
import { useEffect, useMemo , useRef, useState } from "react";
import { useCreateServiceRecord, useGetServiceRecordByJob, useUpdateServiceRecord, useGetJob, customFetch, getGetServiceRecordByJobQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { CreateServiceRecordBody } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, FileDown, Calendar, Wrench, Shield, AlertTriangle, Flame, Gauge, Trash2 } from "lucide-react";
import { Link } from "wouter";

interface ServiceRecordFormData {
  service_date: string;
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
  oil_pressure: string;
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
  capacitor_value: string;
  capacitor_actual_reading: string;
  appliance_make: string;
  appliance_manufacturer_date: string;
  appliance_model: string;
  appliance_serial: string;
  appliance_type: string;
  appliance_output: string;
  appliance_location_within_property: string;
  burner_make_model: string;
  fuel_supply_type_details: string;
  burner_oring: string;
  heat_exchanger_cleaned_tb: boolean;
  heat_exchanger_turbulators: string;
  blast_nozzle_size: string;
  blast_nozzle_replaced: boolean;
  blast_electrode_settings_checked: boolean;
  blast_electrode_settings_text: string;
  blast_oring_replaced: boolean;
  electronics_controlbox: string;
  capacitor_reading_text: string;
  motor_text: string;
  solenoid_notes: string;
  control_panel_notes: string;
  prv_notes: string;
  oil_hoses_notes: string;
  combustion_chamber_baffles: string;
  rope_seal_gasket_comments: string;
  condensate_cleaned_tb: boolean;
  condensate_condition: string;
  oil_pump_pressure: string;
  solenoid_checked: boolean;
  electrodes_condition: string;
  electrode_settings: string;
  air_setting: string;
  blast_tube_condition: string;
  overall_condition_remarks: string;
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

  const queryClient = useQueryClient();
  const { data: existingRecord, isLoading: isLoadingExisting, dataUpdatedAt } = useGetServiceRecordByJob(jobId!);
  const { data: job } = useGetJob(jobId!);


  const createMutation = useCreateServiceRecord();
  const updateMutation = useUpdateServiceRecord();

  const { register, handleSubmit, reset, watch, setValue } = useForm<ServiceRecordFormData>();
  const populatedAt = useRef(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  const fuelType = useMemo(() => {
    return job?.appliance?.fuel_type || "oil";
  }, [job]);

  const isGas = fuelType === "gas" || fuelType === "lpg";
  const isOil = !isGas;

  const toDatetimeLocal = (v: unknown): string => {
    if (!v) return "";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const CAP_TYPE_LABEL = "Capacitor Type";
  const CAP_VALUE_LABEL = "Capacitor Value";
  const CAP_READING_LABEL = "Capacitor Actual Reading";
  const APPLIANCE_MAKE_LABEL = "Appliance Make";
  const APPLIANCE_MANUFACTURER_DATE_LABEL = "Appliance Manufacturer Date";
  const APPLIANCE_MODEL_LABEL = "Appliance Model";
  const APPLIANCE_SERIAL_LABEL = "Appliance Serial";
  const APPLIANCE_TYPE_LABEL = "Appliance Type";
  const APPLIANCE_OUTPUT_LABEL = "Appliance Output";
  const APPLIANCE_LOCATION_LABEL = "Appliance Location Within Property";
  const BURNER_MAKE_MODEL_LABEL = "Burner Make / Model";
  const FUEL_SUPPLY_TYPE_DETAILS_LABEL = "Fuel Supply Type Details";
  const BURNER_ORING_LABEL = "Burner O-Ring";
  const HEAT_EXCHANGER_CLEANED_LABEL = "Heat Exchanger Cleaned";
  const HEAT_EXCHANGER_CLEANED_LEGACY_LABEL = "Heat Exchanger Cleaned (TB)";
  const HEAT_EXCHANGER_TURBULATORS_LABEL = "Heat Exchanger Turbulators";
  const BLAST_NOZZLE_SIZE_LABEL = "Blast Assembly Nozzle Size";
  const BLAST_NOZZLE_REPLACED_LABEL = "Blast Assembly Nozzle Replaced";
  const BLAST_ELECTRODE_SETTINGS_CHECKED_LABEL = "Blast Assembly Electrode Settings Checked";
  const BLAST_ELECTRODE_SETTINGS_TEXT_LABEL = "Blast Assembly Electrode Settings";
  const BLAST_ORING_REPLACED_LABEL = "Blast Assembly O-Ring Replaced";
  const ELECTRONICS_CONTROLBOX_LABEL = "Electronics Controlbox";
  const CAPACITOR_READING_LABEL = "Capacitor Reading";
  const MOTOR_TEXT_LABEL = "Motor";
  const SOLENOID_NOTES_LABEL = "Solenoid Notes";
  const CONTROL_PANEL_NOTES_LABEL = "Control Panel Notes";
  const PRV_NOTES_LABEL = "PRV Notes";
  const OIL_HOSES_NOTES_LABEL = "Oil Hose/s Notes";
  const COMBUSTION_CHAMBER_BAFFLES_LABEL = "Combustion Chamber Baffles";
  const ROPE_SEAL_GASKET_COMMENTS_LABEL = "Rope Seal / Gasket Comments";
  const CONDENSATE_CLEANED_LABEL = "Condensate Cleaned";
  const CONDENSATE_CONDITION_LABEL = "Condensate Condition";
  const OIL_PUMP_PRESSURE_LABEL = "Oil Pump Pressure";
  const SOLENOID_CHECKED_LABEL = "Solenoid Checked";
  const ELECTRODES_CONDITION_LABEL = "Electrodes Condition";
  const ELECTRODE_SETTINGS_LABEL = "Electrode Settings";
  const AIR_SETTING_LABEL = "Air Setting";
  const BLAST_TUBE_CONDITION_LABEL = "Blast Tube Condition";
  const OVERALL_CONDITION_REMARKS_LABEL = "Overall Condition Remarks";

  const getTaggedLineValue = (text: string, label: string): string => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`^${escapedLabel}:\\s*(.*)$`, "mi");
    const m = text.match(rx);
    return m?.[1]?.trim() || "";
  };

  const stripTaggedSafetyLines = (text: string): string => {
    const taggedLabels = [
      CAP_TYPE_LABEL,
      CAP_VALUE_LABEL,
      CAP_READING_LABEL,
      APPLIANCE_MAKE_LABEL,
      APPLIANCE_MANUFACTURER_DATE_LABEL,
      APPLIANCE_MODEL_LABEL,
      APPLIANCE_SERIAL_LABEL,
      APPLIANCE_TYPE_LABEL,
      APPLIANCE_OUTPUT_LABEL,
      APPLIANCE_LOCATION_LABEL,
      BURNER_MAKE_MODEL_LABEL,
      FUEL_SUPPLY_TYPE_DETAILS_LABEL,
      BURNER_ORING_LABEL,
      HEAT_EXCHANGER_CLEANED_LABEL,
      HEAT_EXCHANGER_CLEANED_LEGACY_LABEL,
      HEAT_EXCHANGER_TURBULATORS_LABEL,
      BLAST_NOZZLE_SIZE_LABEL,
      BLAST_NOZZLE_REPLACED_LABEL,
      BLAST_ELECTRODE_SETTINGS_CHECKED_LABEL,
      BLAST_ELECTRODE_SETTINGS_TEXT_LABEL,
      BLAST_ORING_REPLACED_LABEL,
      ELECTRONICS_CONTROLBOX_LABEL,
      CAPACITOR_READING_LABEL,
      MOTOR_TEXT_LABEL,
      SOLENOID_NOTES_LABEL,
      CONTROL_PANEL_NOTES_LABEL,
      PRV_NOTES_LABEL,
      OIL_HOSES_NOTES_LABEL,
      COMBUSTION_CHAMBER_BAFFLES_LABEL,
      ROPE_SEAL_GASKET_COMMENTS_LABEL,
      CONDENSATE_CLEANED_LABEL,
      CONDENSATE_CONDITION_LABEL,
      OIL_PUMP_PRESSURE_LABEL,
      SOLENOID_CHECKED_LABEL,
      ELECTRODES_CONDITION_LABEL,
      ELECTRODE_SETTINGS_LABEL,
      AIR_SETTING_LABEL,
      BLAST_TUBE_CONDITION_LABEL,
      OVERALL_CONDITION_REMARKS_LABEL,
    ];

    return text
      .split("\n")
      .filter((line) => {
        const t = line.trimStart();
        return !taggedLabels.some((label) => t.startsWith(`${label}:`));
      })
      .join("\n")
      .trim();
  };

  const watchClassification = watch("appliance_classification");
  const isAtRisk = watchClassification === "at_risk";
  const isImmediatelyDangerous = watchClassification === "immediately_dangerous";
  const showWarningNotice = isAtRisk || isImmediatelyDangerous;

  useEffect(() => {
    if (existingRecord && dataUpdatedAt > populatedAt.current) {
      populatedAt.current = dataUpdatedAt;
      const existingSafetyNotes = existingRecord.safety_devices_notes || "";
      const baseSafetyNotes = stripTaggedSafetyLines(existingSafetyNotes);
      reset({
        service_date: existingRecord.arrival_time ? String(existingRecord.arrival_time).slice(0, 10) : "",
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
        oil_pressure: String(existingRecord.oil_pressure ?? ""),
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
        safety_devices_notes: baseSafetyNotes,
        capacitor_value: getTaggedLineValue(existingSafetyNotes, CAP_VALUE_LABEL),
        capacitor_actual_reading: getTaggedLineValue(existingSafetyNotes, CAP_READING_LABEL),
        appliance_make: getTaggedLineValue(existingSafetyNotes, APPLIANCE_MAKE_LABEL) || (job?.appliance?.manufacturer || ""),
        appliance_manufacturer_date: getTaggedLineValue(existingSafetyNotes, APPLIANCE_MANUFACTURER_DATE_LABEL),
        appliance_model: getTaggedLineValue(existingSafetyNotes, APPLIANCE_MODEL_LABEL) || (job?.appliance?.model || ""),
        appliance_serial: getTaggedLineValue(existingSafetyNotes, APPLIANCE_SERIAL_LABEL) || (job?.appliance?.serial_number || ""),
        appliance_type: getTaggedLineValue(existingSafetyNotes, APPLIANCE_TYPE_LABEL) || (job?.appliance?.boiler_type || ""),
        appliance_output: getTaggedLineValue(existingSafetyNotes, APPLIANCE_OUTPUT_LABEL),
        appliance_location_within_property: getTaggedLineValue(existingSafetyNotes, APPLIANCE_LOCATION_LABEL) || (job?.property?.boiler_location || ""),
        burner_make_model: getTaggedLineValue(existingSafetyNotes, BURNER_MAKE_MODEL_LABEL) || [job?.appliance?.burner_make, job?.appliance?.burner_model].filter(Boolean).join(" / "),
        fuel_supply_type_details: getTaggedLineValue(existingSafetyNotes, FUEL_SUPPLY_TYPE_DETAILS_LABEL) || [job?.appliance?.fuel_type, job?.appliance?.system_type].filter(Boolean).join(" / "),
        burner_oring: getTaggedLineValue(existingSafetyNotes, BURNER_ORING_LABEL),
        heat_exchanger_cleaned_tb:
          getTaggedLineValue(existingSafetyNotes, HEAT_EXCHANGER_CLEANED_LABEL) === "Yes" ||
          getTaggedLineValue(existingSafetyNotes, HEAT_EXCHANGER_CLEANED_LEGACY_LABEL) === "Yes",
        heat_exchanger_turbulators: getTaggedLineValue(existingSafetyNotes, HEAT_EXCHANGER_TURBULATORS_LABEL),
        blast_nozzle_size: getTaggedLineValue(existingSafetyNotes, BLAST_NOZZLE_SIZE_LABEL),
        blast_nozzle_replaced: getTaggedLineValue(existingSafetyNotes, BLAST_NOZZLE_REPLACED_LABEL) === "Yes",
        blast_electrode_settings_checked: getTaggedLineValue(existingSafetyNotes, BLAST_ELECTRODE_SETTINGS_CHECKED_LABEL) === "Yes",
        blast_electrode_settings_text: getTaggedLineValue(existingSafetyNotes, BLAST_ELECTRODE_SETTINGS_TEXT_LABEL),
        blast_oring_replaced: getTaggedLineValue(existingSafetyNotes, BLAST_ORING_REPLACED_LABEL) === "Yes",
        electronics_controlbox: getTaggedLineValue(existingSafetyNotes, ELECTRONICS_CONTROLBOX_LABEL),
        capacitor_reading_text: getTaggedLineValue(existingSafetyNotes, CAPACITOR_READING_LABEL),
        motor_text: getTaggedLineValue(existingSafetyNotes, MOTOR_TEXT_LABEL),
        solenoid_notes: getTaggedLineValue(existingSafetyNotes, SOLENOID_NOTES_LABEL),
        control_panel_notes: getTaggedLineValue(existingSafetyNotes, CONTROL_PANEL_NOTES_LABEL),
        prv_notes: getTaggedLineValue(existingSafetyNotes, PRV_NOTES_LABEL),
        oil_hoses_notes: getTaggedLineValue(existingSafetyNotes, OIL_HOSES_NOTES_LABEL),
        combustion_chamber_baffles: getTaggedLineValue(existingSafetyNotes, COMBUSTION_CHAMBER_BAFFLES_LABEL),
        rope_seal_gasket_comments: getTaggedLineValue(existingSafetyNotes, ROPE_SEAL_GASKET_COMMENTS_LABEL),
        condensate_cleaned_tb: getTaggedLineValue(existingSafetyNotes, CONDENSATE_CLEANED_LABEL) === "Yes",
        condensate_condition: getTaggedLineValue(existingSafetyNotes, CONDENSATE_CONDITION_LABEL),
        oil_pump_pressure: getTaggedLineValue(existingSafetyNotes, OIL_PUMP_PRESSURE_LABEL),
        solenoid_checked: false,
        electrodes_condition: getTaggedLineValue(existingSafetyNotes, ELECTRODES_CONDITION_LABEL),
        electrode_settings: getTaggedLineValue(existingSafetyNotes, ELECTRODE_SETTINGS_LABEL),
        air_setting: getTaggedLineValue(existingSafetyNotes, AIR_SETTING_LABEL),
        blast_tube_condition: getTaggedLineValue(existingSafetyNotes, BLAST_TUBE_CONDITION_LABEL),
        overall_condition_remarks: getTaggedLineValue(existingSafetyNotes, OVERALL_CONDITION_REMARKS_LABEL),
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
        next_service_due: existingRecord.next_service_due ? String(existingRecord.next_service_due).slice(0, 10) : "",
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
  }, [existingRecord, dataUpdatedAt, reset, job]);

  const onSubmit = async (data: ServiceRecordFormData) => {
    if (!user?.id) return;

    const text = (value: string | null | undefined): string => (value || "").trim();
    const capLines: string[] = [];
    if (text(data.capacitor_value)) capLines.push(`${CAP_VALUE_LABEL}: ${text(data.capacitor_value)}`);
    if (text(data.capacitor_actual_reading)) capLines.push(`${CAP_READING_LABEL}: ${text(data.capacitor_actual_reading)}`);
    if (text(data.appliance_make)) capLines.push(`${APPLIANCE_MAKE_LABEL}: ${text(data.appliance_make)}`);
    if (text(data.appliance_manufacturer_date)) capLines.push(`${APPLIANCE_MANUFACTURER_DATE_LABEL}: ${text(data.appliance_manufacturer_date)}`);
    if (text(data.appliance_model)) capLines.push(`${APPLIANCE_MODEL_LABEL}: ${text(data.appliance_model)}`);
    if (text(data.appliance_serial)) capLines.push(`${APPLIANCE_SERIAL_LABEL}: ${text(data.appliance_serial)}`);
    if (text(data.appliance_type)) capLines.push(`${APPLIANCE_TYPE_LABEL}: ${text(data.appliance_type)}`);
    if (text(data.appliance_output)) capLines.push(`${APPLIANCE_OUTPUT_LABEL}: ${text(data.appliance_output)}`);
    if (text(data.appliance_location_within_property)) capLines.push(`${APPLIANCE_LOCATION_LABEL}: ${text(data.appliance_location_within_property)}`);
    if (text(data.burner_make_model)) capLines.push(`${BURNER_MAKE_MODEL_LABEL}: ${text(data.burner_make_model)}`);
    if (text(data.fuel_supply_type_details)) capLines.push(`${FUEL_SUPPLY_TYPE_DETAILS_LABEL}: ${text(data.fuel_supply_type_details)}`);
    if (text(data.burner_oring)) capLines.push(`${BURNER_ORING_LABEL}: ${text(data.burner_oring)}`);
    if (data.heat_exchanger_cleaned_tb) capLines.push(`${HEAT_EXCHANGER_CLEANED_LABEL}: Yes`);
    if (text(data.heat_exchanger_turbulators)) capLines.push(`${HEAT_EXCHANGER_TURBULATORS_LABEL}: ${text(data.heat_exchanger_turbulators)}`);
    if (text(data.blast_nozzle_size)) capLines.push(`${BLAST_NOZZLE_SIZE_LABEL}: ${text(data.blast_nozzle_size)}`);
    if (data.blast_nozzle_replaced) capLines.push(`${BLAST_NOZZLE_REPLACED_LABEL}: Yes`);
    if (data.blast_electrode_settings_checked) capLines.push(`${BLAST_ELECTRODE_SETTINGS_CHECKED_LABEL}: Yes`);
    if (text(data.blast_electrode_settings_text)) capLines.push(`${BLAST_ELECTRODE_SETTINGS_TEXT_LABEL}: ${text(data.blast_electrode_settings_text)}`);
    if (data.blast_oring_replaced) capLines.push(`${BLAST_ORING_REPLACED_LABEL}: Yes`);
    if (text(data.electronics_controlbox)) capLines.push(`${ELECTRONICS_CONTROLBOX_LABEL}: ${text(data.electronics_controlbox)}`);
    if (text(data.capacitor_reading_text)) capLines.push(`${CAPACITOR_READING_LABEL}: ${text(data.capacitor_reading_text)}`);
    if (text(data.motor_text)) capLines.push(`${MOTOR_TEXT_LABEL}: ${text(data.motor_text)}`);
    if (text(data.solenoid_notes)) capLines.push(`${SOLENOID_NOTES_LABEL}: ${text(data.solenoid_notes)}`);
    if (text(data.control_panel_notes)) capLines.push(`${CONTROL_PANEL_NOTES_LABEL}: ${text(data.control_panel_notes)}`);
    if (text(data.prv_notes)) capLines.push(`${PRV_NOTES_LABEL}: ${text(data.prv_notes)}`);
    if (text(data.oil_hoses_notes)) capLines.push(`${OIL_HOSES_NOTES_LABEL}: ${text(data.oil_hoses_notes)}`);
    if (text(data.combustion_chamber_baffles)) capLines.push(`${COMBUSTION_CHAMBER_BAFFLES_LABEL}: ${text(data.combustion_chamber_baffles)}`);
    if (text(data.rope_seal_gasket_comments)) capLines.push(`${ROPE_SEAL_GASKET_COMMENTS_LABEL}: ${text(data.rope_seal_gasket_comments)}`);
    if (data.condensate_cleaned_tb) capLines.push(`${CONDENSATE_CLEANED_LABEL}: Yes`);
    if (text(data.condensate_condition)) capLines.push(`${CONDENSATE_CONDITION_LABEL}: ${text(data.condensate_condition)}`);
    if (text(data.oil_pump_pressure)) capLines.push(`${OIL_PUMP_PRESSURE_LABEL}: ${text(data.oil_pump_pressure)}`);
    if (text(data.electrodes_condition)) capLines.push(`${ELECTRODES_CONDITION_LABEL}: ${text(data.electrodes_condition)}`);
    if (text(data.electrode_settings)) capLines.push(`${ELECTRODE_SETTINGS_LABEL}: ${text(data.electrode_settings)}`);
    if (text(data.air_setting)) capLines.push(`${AIR_SETTING_LABEL}: ${text(data.air_setting)}`);
    if (text(data.blast_tube_condition)) capLines.push(`${BLAST_TUBE_CONDITION_LABEL}: ${text(data.blast_tube_condition)}`);
    if (text(data.overall_condition_remarks)) capLines.push(`${OVERALL_CONDITION_REMARKS_LABEL}: ${text(data.overall_condition_remarks)}`);
    const baseSafetyNotes = stripTaggedSafetyLines(data.safety_devices_notes || "");
    const mergedSafetyNotes = [baseSafetyNotes, ...capLines].filter(Boolean).join("\n");

    const payload: CreateServiceRecordBody = {
      job_id: jobId!,
      technician_id: user.id,
      arrival_time: data.service_date || undefined,
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
      safety_devices_notes: mergedSafetyNotes || undefined,
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
        oil_pressure: data.oil_pressure || undefined,
        electrodes_checked: data.electrodes_checked,
        electrodes_replaced: data.electrodes_replaced,
        filter_checked: data.filter_checked,
        filter_cleaned: data.filter_cleaned,
        filter_replaced: data.filter_replaced,
        oil_line_checked: data.oil_line_checked,
        fire_valve_checked: data.fire_valve_checked,
        oil_pressure: data.oil_pump_pressure || data.oil_pressure || undefined,
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
        await queryClient.invalidateQueries({ queryKey: getGetServiceRecordByJobQueryKey(jobId!) });
        toast({ title: "Updated", description: "Service record updated successfully" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetServiceRecordByJobQueryKey(jobId!) });
        toast({ title: "Success", description: "Service record created successfully" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/forms/service_record/${existingRecord!.id}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isGas ? "cp12" : "service-record"}-${jobId?.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" }); }
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
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Calendar className="w-5 h-5"/> Service Date</h2>
          <div className="max-w-xs">
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="flex items-center gap-2">
                <Input type="date" {...register("service_date")} />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setValue("service_date", new Date().toISOString().slice(0, 10))}
                >
                  Today
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {isOil && (
          <Card className="p-6 shadow-sm border-amber-200 bg-amber-50/30">
            <h2 className="font-bold text-lg mb-4 text-amber-700 flex items-center gap-2"><Wrench className="w-5 h-5"/> Appliance Identification</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Appliance Make</Label>
                <Input
                  {...register("appliance_make")}
                  placeholder={job?.appliance?.manufacturer || "Enter appliance make (e.g. Worcester Bosch)"}
                />
              </div>
              <div className="space-y-2">
                <Label>Appliance Manufacturer Date</Label>
                <Input
                  type="date"
                  {...register("appliance_manufacturer_date")}
                />
              </div>
              <div className="space-y-2">
                <Label>Appliance Model</Label>
                <Input
                  {...register("appliance_model")}
                  placeholder={job?.appliance?.model || "Enter appliance model (e.g. Greenstar 30i)"}
                />
              </div>
              <div className="space-y-2">
                <Label>Appliance Serial</Label>
                <Input
                  {...register("appliance_serial")}
                  placeholder={job?.appliance?.serial_number || "Enter serial number from data plate"}
                />
              </div>

              <div className="space-y-2">
                <Label>Appliance Type</Label>
                <Input
                  {...register("appliance_type")}
                  placeholder={job?.appliance?.boiler_type || "Enter appliance type (e.g. Boiler)"}
                />
              </div>
              <div className="space-y-2">
                <Label>Appliance Output</Label>
                <Input
                  {...register("appliance_output")}
                  placeholder="e.g. 26 kW"
                />
              </div>
              <div className="space-y-2">
                <Label>Fuel Supply Type Details</Label>
                <Input
                  {...register("fuel_supply_type_details")}
                  placeholder={[job?.appliance?.fuel_type, job?.appliance?.system_type].filter(Boolean).join(" / ") || "Enter fuel/system details (e.g. Oil / Combi)"}
                />
              </div>

              <div className="space-y-2">
                <Label>Capacitor</Label>
                <Input {...register("capacitor_value")} placeholder="Value (e.g. 4 uF)" />
              </div>
              <div className="space-y-2">
                <Label>Nozzle</Label>
                <Input {...register("nozzle_size_fitted")} placeholder="Size (e.g. 0.50 USG 60S)" />
              </div>
              <div className="space-y-2">
                <Label>Oil Pressure</Label>
                <Input {...register("oil_pressure")} placeholder="Setting (e.g. 7.0 bar)" />
              </div>
              <div className="space-y-2">
                <Label>Blast Tube</Label>
                <Input {...register("blast_tube_condition")} placeholder="Setting / condition" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Appliance Location Within Property</Label>
                <Input
                  {...register("appliance_location_within_property")}
                  placeholder={job?.property?.boiler_location || "Enter location within property (e.g. Kitchen)"}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Burner Make / Model</Label>
                <Input
                  {...register("burner_make_model")}
                  placeholder={[job?.appliance?.burner_make, job?.appliance?.burner_model].filter(Boolean).join(" / ") || "Enter burner make/model (e.g. Riello RDB)"}
                />
              </div>
            </div>
          </Card>
        )}

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
          {isGas && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                ["gas_valve_checked", "Gas Valve Checked"],
                ["injectors_checked", "Injectors Checked"],
                ["pilot_checked", "Pilot Checked"],
                ["ignition_checked", "Ignition Checked"],
                ["gas_pressure_checked", "Gas Pressure Checked"],
              ] as [string, string][]).map(([name, label]) => (
                <label key={name} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors text-sm">
                  <input type="checkbox" {...register(name as keyof ServiceRecordFormData)} className="w-4 h-4 accent-primary rounded" />
                  <span className="font-medium">{label}</span>
                </label>
              ))}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {isOil && (
              <div className="md:col-span-2 space-y-3 p-3 border rounded-xl bg-slate-50/60">
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Heat Exchanger</Label>
                  <Input {...register("heat_exchanger_turbulators")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Combustion Chamber</Label>
                  <Input {...register("combustion_chamber_baffles")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Nozzle</Label>
                  <Input {...register("blast_nozzle_size")} placeholder="Nozzle size" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Electrodes</Label>
                  <Input {...register("electrodes_condition")} placeholder="Condition" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">O-Ring</Label>
                  <Input {...register("burner_oring")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Condensate</Label>
                  <Input {...register("condensate_condition")} placeholder="Condition" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Oil Pump</Label>
                  <Input {...register("oil_pump_pressure")} placeholder="Pressure / notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Air Setting</Label>
                  <Input {...register("air_setting")} placeholder="Air setting" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Capacitor</Label>
                  <Input {...register("capacitor_actual_reading")} placeholder="Reading" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Oil Pressure</Label>
                  <Input {...register("oil_pressure")} placeholder="Setting" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Solednoid</Label>
                  <Input {...register("solenoid_notes")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Control Box</Label>
                  <Input {...register("electronics_controlbox")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Control Panel</Label>
                  <Input {...register("control_panel_notes")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Motor</Label>
                  <Input {...register("motor_text")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">PRV</Label>
                  <Input {...register("prv_notes")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Oil Hose/s</Label>
                  <Input {...register("oil_hoses_notes")} placeholder="Notes" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
                  <Label className="font-semibold">Blast Tube</Label>
                  <Input {...register("blast_tube_condition")} placeholder="Condition" />
                </div>
              </div>
            )}
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

        <div className="flex justify-between gap-4 sticky bottom-6 z-10 bg-background/80 p-4 rounded-2xl backdrop-blur-md border border-border shadow-xl">
          <div>
            {existingRecord && isAdmin && !showDeleteConfirm && (
              <Button variant="ghost" type="button" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 font-medium">Delete this record?</span>
                <Button variant="destructive" type="button" size="sm" disabled={isDeleting} onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await customFetch(`${import.meta.env.BASE_URL}api/service-records/${existingRecord!.id}`, { method: "DELETE" });
                    toast({ title: "Deleted", description: "Service record deleted" });
                    setLocation(`/jobs/${jobId}`);
                  } catch (e: unknown) {
                    toast({ title: "Error", description: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
                    setIsDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}>
                  {isDeleting ? "Deleting..." : "Yes, delete"}
                </Button>
                <Button variant="outline" type="button" size="sm" onClick={() => setShowDeleteConfirm(false)}>No</Button>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <Button variant="outline" type="button" onClick={() => setLocation(`/jobs/${jobId}`)}>Cancel</Button>
            <Button type="submit" size="lg" className="w-48 shadow-lg shadow-primary/30" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : existingRecord ? "Update Record" : "Save Record"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
