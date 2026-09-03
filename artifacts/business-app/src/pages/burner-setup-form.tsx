import { useForm } from "react-hook-form";
import { useCreateBurnerSetupRecord, useGetBurnerSetupRecordByJob, getGetBurnerSetupRecordByJobQueryKey, useUpdateBurnerSetupRecord, customFetch, useGetJob } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame, Settings, Gauge, Trash2, FileDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface BurnerSetupFormData {
  burner_manufacturer: string;
  burner_model: string;
  burner_serial_number: string;
  appliance_make: string;
  appliance_model: string;
  appliance_serial: string;
  appliance_type: string;
  appliance_location: string;
  fuel_supply_type: string;
  burner_stage: "single" | "two" | "fully_modulating";
  modulation_readings: string;
  nozzle_size: string;
  nozzle_type: string;
  nozzle_angle: string;
  pump_pressure: string;
  pump_vacuum: string;
  electrode_gap: string;
  electrode_position: string;
  air_damper_setting: string;
  head_setting: string;
  combustion_co2: string;
  combustion_co: string;
  combustion_smoke: string;
  combustion_efficiency: string;
  stage_two_nozzle_size: string;
  stage_two_pump_pressure: string;
  stage_two_air_damper_setting: string;
  stage_two_head_setting: string;
  stage_two_combustion_co2: string;
  stage_two_combustion_co: string;
  stage_two_combustion_smoke: string;
  stage_two_combustion_efficiency: string;
  additional_notes: string;
}

export default function BurnerSetupForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: job } = useGetJob(jobId!);

  const { data: existingRecord, isLoading: isLoadingExisting, dataUpdatedAt } = useGetBurnerSetupRecordByJob(jobId!);
  const queryClient = useQueryClient();
  const createMutation = useCreateBurnerSetupRecord();
  const updateMutation = useUpdateBurnerSetupRecord();

  const { register, handleSubmit, reset } = useForm<BurnerSetupFormData>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [burnerStage, setBurnerStage] = useState<"single" | "two" | "fully_modulating">("single");
  const modulationPressures = Array.from({ length: 16 }, (_, index) => index + 5);
  const [modulationReadings, setModulationReadings] = useState<Array<{ fan_speed: string; co2: string; o2: string; co: string; nox: string }>>(
    () => modulationPressures.map(() => ({ fan_speed: "", co2: "", o2: "", co: "", nox: "" })),
  );
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const populatedAt = useRef(0);

  useEffect(() => {
    if (existingRecord && dataUpdatedAt > populatedAt.current) {
      populatedAt.current = dataUpdatedAt;
      reset({
        appliance_make: existingRecord.appliance_make || "",
        appliance_model: existingRecord.appliance_model || "",
        appliance_serial: existingRecord.appliance_serial || "",
        appliance_type: existingRecord.appliance_type || "",
        appliance_location: existingRecord.appliance_location || "",
        fuel_supply_type: existingRecord.fuel_supply_type || "",
        burner_stage: (existingRecord.burner_stage as "single" | "two" | "fully_modulating") || "single",
        modulation_readings: existingRecord.modulation_readings || "",
        burner_manufacturer: existingRecord.burner_manufacturer || "",
        burner_model: existingRecord.burner_model || "",
        burner_serial_number: existingRecord.burner_serial_number || "",
        nozzle_size: existingRecord.nozzle_size || "",
        nozzle_type: existingRecord.nozzle_type || "",
        nozzle_angle: existingRecord.nozzle_angle || "",
        pump_pressure: existingRecord.pump_pressure || "",
        pump_vacuum: existingRecord.pump_vacuum || "",
        electrode_gap: existingRecord.electrode_gap || "",
        electrode_position: existingRecord.electrode_position || "",
        air_damper_setting: existingRecord.air_damper_setting || "",
        head_setting: existingRecord.head_setting || "",
        combustion_co2: existingRecord.combustion_co2 || "",
        combustion_co: existingRecord.combustion_co || "",
        combustion_smoke: existingRecord.combustion_smoke || "",
        combustion_efficiency: existingRecord.combustion_efficiency || "",
        stage_two_nozzle_size: existingRecord.stage_two_nozzle_size || "",
        stage_two_pump_pressure: existingRecord.stage_two_pump_pressure || "",
        stage_two_air_damper_setting: existingRecord.stage_two_air_damper_setting || "",
        stage_two_head_setting: existingRecord.stage_two_head_setting || "",
        stage_two_combustion_co2: existingRecord.stage_two_combustion_co2 || "",
        stage_two_combustion_co: existingRecord.stage_two_combustion_co || "",
        stage_two_combustion_smoke: existingRecord.stage_two_combustion_smoke || "",
        stage_two_combustion_efficiency: existingRecord.stage_two_combustion_efficiency || "",
        additional_notes: existingRecord.additional_notes || "",
      });
      const savedStage = (existingRecord.burner_stage as "single" | "two" | "fully_modulating") || "single";
      setBurnerStage(savedStage);
      if (existingRecord.modulation_readings) {
        try { setModulationReadings(JSON.parse(existingRecord.modulation_readings)); } catch { setModulationReadings(modulationPressures.map(() => ({ fan_speed: "", co2: "", o2: "", co: "", nox: "" }))); }
      }
    }
  }, [existingRecord, dataUpdatedAt, reset]);

  useEffect(() => {
    if (existingRecord || !job?.appliance) return;
    reset((current) => ({
      ...current,
      appliance_make: job.appliance?.manufacturer || "",
      appliance_model: job.appliance?.model || "",
      appliance_serial: job.appliance?.serial_number || "",
      appliance_type: job.appliance?.boiler_type || "",
      appliance_location: job.appliance?.location || "",
      fuel_supply_type: [job.appliance?.fuel_type, job.appliance?.system_type].filter(Boolean).join(" / "),
      burner_manufacturer: job.appliance?.burner_make || current.burner_manufacturer,
      burner_model: job.appliance?.burner_model || current.burner_model,
      nozzle_size: job.appliance?.nozzle_size || current.nozzle_size,
      pump_pressure: job.appliance?.pump_pressure || current.pump_pressure,
    }));
  }, [existingRecord, job, reset]);

  const onSubmit = async (data: BurnerSetupFormData) => {
    if (!user?.id) return;
    const payload = {
      ...data,
      burner_stage: burnerStage,
      modulation_readings: burnerStage === "fully_modulating" ? JSON.stringify(modulationReadings) : undefined,
      job_id: jobId!,
      technician_id: user.id,
    };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetBurnerSetupRecordByJobQueryKey(jobId!) });
        toast({ title: "Updated", description: "Burner setup record updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetBurnerSetupRecordByJobQueryKey(jobId!) });
        toast({ title: "Success", description: "Burner setup record created" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/forms/burner_setup_record/${existingRecord!.id}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `burner-setup-${jobId?.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" }); }
  };

  if (isLoadingExisting) return <div className="p-8">Loading form...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" /> Burner Setup Record
          </h1>
          <p className="text-muted-foreground mt-1">Record burner details, nozzle, pressure, and electrode settings.</p>
        </div>
        {existingRecord && (
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary">Appliance Identification</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(["appliance_make", "appliance_model", "appliance_serial", "appliance_type", "appliance_location", "fuel_supply_type"] as const).map((field) => (
              <div className="space-y-2" key={field}>
                <Label>{field.replace("appliance_", "").replace(/_/g, " ").replace(/^./, (value) => value.toUpperCase())}</Label>
                <Input {...register(field)} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-orange-600 flex items-center gap-2">
            <Flame className="w-5 h-5" /> Burner Details
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input {...register("burner_manufacturer")} placeholder="e.g. Riello, Danfoss" />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input {...register("burner_model")} placeholder="Burner model" />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input {...register("burner_serial_number")} placeholder="Serial number" />
            </div>
            <div className="space-y-2">
              <Label>Burner Configuration</Label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                value={burnerStage}
                onChange={(event) => setBurnerStage(event.target.value as "single" | "two" | "fully_modulating")}
              >
                <option value="single">Single stage burner</option>
                <option value="two">Two-stage burner</option>
                <option value="fully_modulating">Fully modulating burner (Sapphire)</option>
              </select>
            </div>
          </div>
          {burnerStage === "fully_modulating" && (
            <div className="mt-5 overflow-x-auto border-t pt-4">
              <h3 className="font-semibold mb-3">Sapphire modulation readings</h3>
              <table className="w-full min-w-[760px] text-sm border-collapse">
                <thead><tr className="bg-muted/50"><th className="border p-2 text-left">Pump Pressure (bar)</th><th className="border p-2">Fan Speed (%)</th><th className="border p-2">CO2 (%)</th><th className="border p-2">O2 (%)</th><th className="border p-2">CO (ppm)</th><th className="border p-2">NOx (%)</th></tr></thead>
                <tbody>{modulationPressures.map((pressure, index) => (
                  <tr key={pressure}><td className="border p-2 font-medium">{pressure}</td>
                    {(["fan_speed", "co2", "o2", "co", "nox"] as const).map((field) => (
                      <td className="border p-1" key={field}><Input value={modulationReadings[index]?.[field] || ""} onChange={(event) => setModulationReadings((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: event.target.value } : row))} /></td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">CO2, O2, CO and NOx readings may be recorded as “Visual only” where applicable.</p>
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-blue-600 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Nozzle & Pressure
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nozzle Size (USgal/h)</Label>
              <Input {...register("nozzle_size")} placeholder="e.g. 0.50, 0.65" />
            </div>
            <div className="space-y-2">
              <Label>Nozzle Type</Label>
              <Input {...register("nozzle_type")} placeholder="e.g. Solid, Semi-solid, Hollow" />
            </div>
            <div className="space-y-2">
              <Label>Nozzle Angle</Label>
              <Input {...register("nozzle_angle")} placeholder="e.g. 60°, 80°" />
            </div>
            <div className="space-y-2">
              <Label>Pump Pressure (bar)</Label>
              <Input {...register("pump_pressure")} placeholder="e.g. 7, 10" />
            </div>
            <div className="space-y-2">
              <Label>Pump Vacuum (inHg)</Label>
              <Input {...register("pump_vacuum")} placeholder="e.g. 10" />
            </div>
            {burnerStage === "two" && (
              <>
                <div className="sm:col-span-2 md:col-span-3 border-t pt-4 font-semibold text-muted-foreground">Stage 2 Settings</div>
                <div className="space-y-2"><Label>Stage 2 Nozzle Size</Label><Input {...register("stage_two_nozzle_size")} /></div>
                <div className="space-y-2"><Label>Stage 2 Pump Pressure</Label><Input {...register("stage_two_pump_pressure")} /></div>
                <div className="space-y-2"><Label>Stage 2 Air Damper Setting</Label><Input {...register("stage_two_air_damper_setting")} /></div>
                <div className="space-y-2"><Label>Stage 2 Head Setting</Label><Input {...register("stage_two_head_setting")} /></div>
              </>
            )}
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-purple-600 flex items-center gap-2">
            Electrode & Air Settings
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Electrode Gap (mm)</Label>
              <Input {...register("electrode_gap")} placeholder="e.g. 3-4mm" />
            </div>
            <div className="space-y-2">
              <Label>Electrode Position</Label>
              <Input {...register("electrode_position")} placeholder="Position relative to nozzle" />
            </div>
            <div className="space-y-2">
              <Label>Air Damper Setting</Label>
              <Input {...register("air_damper_setting")} placeholder="Position or setting" />
            </div>
            <div className="space-y-2">
              <Label>Head Setting</Label>
              <Input {...register("head_setting")} placeholder="Blast tube / head position" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-emerald-600 flex items-center gap-2">
            <Gauge className="w-5 h-5" /> Final Combustion Results
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>CO2 (%)</Label>
              <Input {...register("combustion_co2")} placeholder="e.g. 10.5" />
            </div>
            <div className="space-y-2">
              <Label>CO (ppm)</Label>
              <Input {...register("combustion_co")} placeholder="e.g. 42" />
            </div>
            <div className="space-y-2">
              <Label>Smoke Number</Label>
              <Input {...register("combustion_smoke")} placeholder="0-9" />
            </div>
            <div className="space-y-2">
              <Label>Efficiency (%)</Label>
              <Input {...register("combustion_efficiency")} placeholder="e.g. 85" />
            </div>
            {burnerStage === "two" && (
              <>
                <div className="sm:col-span-2 md:col-span-4 border-t pt-4 font-semibold text-muted-foreground">Stage 2 Combustion Results</div>
                <div className="space-y-2"><Label>Stage 2 CO2 (%)</Label><Input {...register("stage_two_combustion_co2")} /></div>
                <div className="space-y-2"><Label>Stage 2 CO (ppm)</Label><Input {...register("stage_two_combustion_co")} /></div>
                <div className="space-y-2"><Label>Stage 2 Smoke Number</Label><Input {...register("stage_two_combustion_smoke")} /></div>
                <div className="space-y-2"><Label>Stage 2 Efficiency (%)</Label><Input {...register("stage_two_combustion_efficiency")} /></div>
              </>
            )}
            <div className="space-y-2 sm:col-span-2 md:col-span-4">
              <Label>Additional Notes</Label>
              <Input {...register("additional_notes")} placeholder="Any other observations..." />
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
                      await customFetch(`${import.meta.env.BASE_URL}api/burner-setup-records/${existingRecord!.id}`, { method: "DELETE" });
                      toast({ title: "Deleted", description: "Burner setup record deleted" });
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
