import { useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateHeatPumpCommissioningRecord, useGetHeatPumpCommissioningRecordByJob, getGetHeatPumpCommissioningRecordByJobQueryKey, useUpdateHeatPumpCommissioningRecord, useGetJob, customFetch } from "@workspace/api-client-react";
import type { CreateHeatPumpCommissioningRecordBody } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileDown, Wind, Gauge, ClipboardCheck, UserCheck, Settings, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { generateHeatPumpCommissioningPdf } from "@/lib/pdf-generator";
import { useCompanySettings } from "@/hooks/use-company-settings";

interface HeatPumpCommissioningFormData {
  heat_loss_kwh: string;
  design_flow_temp: string;
  refrigerant_type: string;
  refrigerant_charge_weight: string;
  commissioning_pressure_high: string;
  commissioning_pressure_low: string;
  measured_cop: string;
  expansion_vessel_checked: boolean;
  safety_devices_checked: boolean;
  controls_commissioned: boolean;
  buffer_tank_checked: boolean;
  cylinder_checked: boolean;
  system_flushed: boolean;
  inhibitor_added: boolean;
  customer_instructions_given: boolean;
  customer_name_signed: string;
  technician_name_signed: string;
  notes: string;
}

export default function HeatPumpCommissioningForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting, dataUpdatedAt } = useGetHeatPumpCommissioningRecordByJob(jobId!);
  const queryClient = useQueryClient();
  const { data: job } = useGetJob(jobId!);

  const { data: company } = useCompanySettings();
  const createMutation = useCreateHeatPumpCommissioningRecord();
  const updateMutation = useUpdateHeatPumpCommissioningRecord();

  const { register, handleSubmit, getValues, reset } = useForm<HeatPumpCommissioningFormData>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const populatedAt = useRef(0);

  useEffect(() => {
    if (existingRecord && dataUpdatedAt > populatedAt.current) {
      populatedAt.current = dataUpdatedAt;
      reset({
        heat_loss_kwh: existingRecord.heat_loss_kwh || "",
        design_flow_temp: existingRecord.design_flow_temp || "",
        refrigerant_type: existingRecord.refrigerant_type || "",
        refrigerant_charge_weight: existingRecord.refrigerant_charge_weight || "",
        commissioning_pressure_high: existingRecord.commissioning_pressure_high || "",
        commissioning_pressure_low: existingRecord.commissioning_pressure_low || "",
        measured_cop: existingRecord.measured_cop || "",
        expansion_vessel_checked: existingRecord.expansion_vessel_checked ?? false,
        safety_devices_checked: existingRecord.safety_devices_checked ?? false,
        controls_commissioned: existingRecord.controls_commissioned ?? false,
        buffer_tank_checked: existingRecord.buffer_tank_checked ?? false,
        cylinder_checked: existingRecord.cylinder_checked ?? false,
        system_flushed: existingRecord.system_flushed ?? false,
        inhibitor_added: existingRecord.inhibitor_added ?? false,
        customer_instructions_given: existingRecord.customer_instructions_given ?? false,
        customer_name_signed: existingRecord.customer_name_signed || "",
        technician_name_signed: existingRecord.technician_name_signed || "",
        notes: existingRecord.notes || "",
      });
    }
  }, [existingRecord, dataUpdatedAt, reset]);

  const onSubmit = async (data: HeatPumpCommissioningFormData) => {
    if (!user?.id || !jobId) return;

    const payload: CreateHeatPumpCommissioningRecordBody = {
      job_id: jobId,
      technician_id: user.id,
      heat_loss_kwh: data.heat_loss_kwh || undefined,
      design_flow_temp: data.design_flow_temp || undefined,
      refrigerant_type: data.refrigerant_type || undefined,
      refrigerant_charge_weight: data.refrigerant_charge_weight || undefined,
      commissioning_pressure_high: data.commissioning_pressure_high || undefined,
      commissioning_pressure_low: data.commissioning_pressure_low || undefined,
      measured_cop: data.measured_cop || undefined,
      expansion_vessel_checked: data.expansion_vessel_checked,
      safety_devices_checked: data.safety_devices_checked,
      controls_commissioned: data.controls_commissioned,
      buffer_tank_checked: data.buffer_tank_checked,
      cylinder_checked: data.cylinder_checked,
      system_flushed: data.system_flushed,
      inhibitor_added: data.inhibitor_added,
      customer_instructions_given: data.customer_instructions_given,
      customer_name_signed: data.customer_name_signed || undefined,
      technician_name_signed: data.technician_name_signed || undefined,
      notes: data.notes || undefined,
    };

    try {
      if (existingRecord) {
        const { job_id: _jid, technician_id: _tid, ...updatePayload } = payload;
        await updateMutation.mutateAsync({ jobId, data: updatePayload });
        await queryClient.invalidateQueries({ queryKey: getGetHeatPumpCommissioningRecordByJobQueryKey(jobId!) });
        toast({ title: "Updated", description: "Heat pump commissioning record updated successfully" });
      } else {
        await createMutation.mutateAsync({ jobId, data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetHeatPumpCommissioningRecordByJobQueryKey(jobId!) });
        toast({ title: "Success", description: "Heat pump commissioning record created successfully" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = () => {
    const vals = getValues();
    generateHeatPumpCommissioningPdf({
      jobId: jobId!,
      customerName: job?.customer ? `${job.customer.first_name} ${job.customer.last_name}` : "N/A",
      propertyAddress: job?.property?.address_line1 || "N/A",
      applianceName: job?.appliance ? `${job.appliance.manufacturer || ""} ${job.appliance.model || ""}`.trim() || "N/A" : "N/A",
      technicianName: job?.technician?.full_name || user?.email || "N/A",
      scheduledDate: job?.scheduled_date ? new Date(String(job.scheduled_date).slice(0, 10)).toLocaleDateString() : new Date().toLocaleDateString(),
      record: vals,
    }, company ?? undefined);
  };

  if (isLoadingExisting) return <div className="p-8">Loading form...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Heat Pump Commissioning</h1>
          <p className="text-muted-foreground mt-1">MCS-style commissioning record for heat pump installation.</p>
        </div>
        {existingRecord && (
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        <Card className="p-6 shadow-sm border-cyan-200 bg-cyan-50/30">
          <h2 className="font-bold text-lg mb-4 text-cyan-700 flex items-center gap-2"><Settings className="w-5 h-5"/> System Design Data</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heat Loss (kWh)</Label>
              <Input {...register("heat_loss_kwh")} placeholder="e.g. 8.5" />
            </div>
            <div className="space-y-2">
              <Label>Design Flow Temperature (°C)</Label>
              <Input {...register("design_flow_temp")} placeholder="e.g. 45" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Wind className="w-5 h-5"/> Refrigerant Charge</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Refrigerant Type</Label>
              <Input {...register("refrigerant_type")} placeholder="e.g. R32" />
            </div>
            <div className="space-y-2">
              <Label>Charge Weight (kg)</Label>
              <Input {...register("refrigerant_charge_weight")} placeholder="e.g. 1.2" />
            </div>
            <div className="space-y-2">
              <Label>High Side Pressure (bar)</Label>
              <Input {...register("commissioning_pressure_high")} placeholder="e.g. 27.5" />
            </div>
            <div className="space-y-2">
              <Label>Low Side Pressure (bar)</Label>
              <Input {...register("commissioning_pressure_low")} placeholder="e.g. 8.0" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Gauge className="w-5 h-5"/> Measured Performance</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Measured COP</Label>
              <Input {...register("measured_cop")} placeholder="e.g. 3.5" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><ClipboardCheck className="w-5 h-5"/> MCS Commissioning Checklist</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              ["expansion_vessel_checked", "Expansion Vessel Checked"],
              ["safety_devices_checked", "Safety Devices Checked"],
              ["controls_commissioned", "Controls Commissioned"],
              ["buffer_tank_checked", "Buffer Tank Checked"],
              ["cylinder_checked", "Cylinder Checked"],
              ["system_flushed", "System Flushed"],
              ["inhibitor_added", "Inhibitor Added"],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-cyan-50 cursor-pointer transition-colors text-sm">
                <input type="checkbox" {...register(field)} className="w-4 h-4 accent-cyan-600 rounded" />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><UserCheck className="w-5 h-5"/> Customer Handover & Sign-off</h2>
          <div className="mb-4">
            <label className="flex items-center gap-2 p-3 border rounded-xl hover:bg-cyan-50 cursor-pointer transition-colors text-sm w-fit">
              <input type="checkbox" {...register("customer_instructions_given")} className="w-5 h-5 accent-cyan-600 rounded" />
              <span className="font-medium">Customer shown how to operate system</span>
            </label>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Technician Name (printed)</Label>
              <Input {...register("technician_name_signed")} placeholder="Technician name..." />
            </div>
            <div className="space-y-2">
              <Label>Customer Name (printed)</Label>
              <Input {...register("customer_name_signed")} placeholder="Customer name..." />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary">Notes</h2>
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[100px]"
            {...register("notes")}
            placeholder="Any additional commissioning notes..."
          />
        </Card>

        <div className="sticky bottom-0 z-10 bg-background/80 backdrop-blur-sm border-t py-4 -mx-4 px-4">
          <div className="max-w-4xl mx-auto flex justify-between gap-3">
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
                      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/heat-pump-commissioning/${existingRecord!.id}`, { method: "DELETE" });
                      toast({ title: "Deleted", description: "Heat pump commissioning record deleted" });
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
            <div className="flex gap-3">
              <Button type="submit" size="lg" className="px-8 bg-cyan-600 hover:bg-cyan-700" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending)
                  ? "Saving..."
                  : existingRecord ? "Update Commissioning Record" : "Save Commissioning Record"
                }
              </Button>
              <Link href={`/jobs/${jobId}`}>
                <Button type="button" variant="outline" size="lg">Cancel</Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
