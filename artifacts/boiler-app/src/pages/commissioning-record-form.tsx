import { useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateCommissioningRecord, useGetCommissioningRecordByJob, useUpdateCommissioningRecord, getGetCommissioningRecordByJobQueryKey, customFetch } from "@workspace/api-client-react";
import type { CreateCommissioningRecordBody } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, FileDown, Shield, Gauge, ClipboardCheck, UserCheck, Trash2 } from "lucide-react";
import { Link } from "wouter";

interface CommissioningFormData {
  gas_safe_engineer_id: string;
  standing_pressure: string;
  working_pressure: string;
  operating_pressure: string;
  gas_rate_measured: string;
  combustion_co: string;
  combustion_co2: string;
  flue_temp: string;
  ignition_tested: boolean;
  controls_tested: boolean;
  thermostats_tested: boolean;
  pressure_relief_tested: boolean;
  expansion_vessel_checked: boolean;
  system_flushed: boolean;
  inhibitor_added: boolean;
  customer_instructions_given: boolean;
  customer_name_signed: string;
  notes: string;
}

export default function CommissioningRecordForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting, dataUpdatedAt } = useGetCommissioningRecordByJob(jobId!);
  const queryClient = useQueryClient();


  const createMutation = useCreateCommissioningRecord();
  const updateMutation = useUpdateCommissioningRecord();

  const { register, handleSubmit, reset } = useForm<CommissioningFormData>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const populatedAt = useRef(0);

  useEffect(() => {
    if (existingRecord && dataUpdatedAt > populatedAt.current) {
      populatedAt.current = dataUpdatedAt;
      reset({
        gas_safe_engineer_id: existingRecord.gas_safe_engineer_id || "",
        standing_pressure: existingRecord.standing_pressure || "",
        working_pressure: existingRecord.working_pressure || "",
        operating_pressure: existingRecord.operating_pressure || "",
        gas_rate_measured: existingRecord.gas_rate_measured || "",
        combustion_co: existingRecord.combustion_co || "",
        combustion_co2: existingRecord.combustion_co2 || "",
        flue_temp: existingRecord.flue_temp || "",
        ignition_tested: existingRecord.ignition_tested ?? false,
        controls_tested: existingRecord.controls_tested ?? false,
        thermostats_tested: existingRecord.thermostats_tested ?? false,
        pressure_relief_tested: existingRecord.pressure_relief_tested ?? false,
        expansion_vessel_checked: existingRecord.expansion_vessel_checked ?? false,
        system_flushed: existingRecord.system_flushed ?? false,
        inhibitor_added: existingRecord.inhibitor_added ?? false,
        customer_instructions_given: existingRecord.customer_instructions_given ?? false,
        customer_name_signed: existingRecord.customer_name_signed || "",
        notes: existingRecord.notes || "",
      });
    }
  }, [existingRecord, dataUpdatedAt, reset]);

  const onSubmit = async (data: CommissioningFormData) => {
    if (!user?.id) return;

    const payload: CreateCommissioningRecordBody = {
      job_id: jobId!,
      technician_id: user.id,
      gas_safe_engineer_id: data.gas_safe_engineer_id || undefined,
      standing_pressure: data.standing_pressure || undefined,
      working_pressure: data.working_pressure || undefined,
      operating_pressure: data.operating_pressure || undefined,
      gas_rate_measured: data.gas_rate_measured || undefined,
      combustion_co: data.combustion_co || undefined,
      combustion_co2: data.combustion_co2 || undefined,
      flue_temp: data.flue_temp || undefined,
      ignition_tested: data.ignition_tested,
      controls_tested: data.controls_tested,
      thermostats_tested: data.thermostats_tested,
      pressure_relief_tested: data.pressure_relief_tested,
      expansion_vessel_checked: data.expansion_vessel_checked,
      system_flushed: data.system_flushed,
      inhibitor_added: data.inhibitor_added,
      customer_instructions_given: data.customer_instructions_given,
      customer_name_signed: data.customer_name_signed || undefined,
      notes: data.notes || undefined,
    };

    try {
      if (existingRecord) {
        const { job_id: _jid, technician_id: _tid, ...updatePayload } = payload;
        await updateMutation.mutateAsync({ id: existingRecord.id, data: updatePayload });
        await queryClient.invalidateQueries({ queryKey: getGetCommissioningRecordByJobQueryKey(jobId!) });
        toast({ title: "Updated", description: "Commissioning record updated successfully" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetCommissioningRecordByJobQueryKey(jobId!) });
        toast({ title: "Success", description: "Commissioning record created successfully" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/forms/commissioning_record/${existingRecord!.id}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commissioning-record-${jobId?.slice(0, 8)}.pdf`;
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
          <h1 className="text-3xl font-display font-bold">Commissioning Record</h1>
          <p className="text-muted-foreground mt-1">Complete all commissioning checks for new installation.</p>
        </div>
        {existingRecord && (
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-emerald-200 bg-emerald-50/30">
          <h2 className="font-bold text-lg mb-4 text-emerald-700 flex items-center gap-2"><Shield className="w-5 h-5"/> Engineer Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gas Safe Engineer ID</Label>
              <Input {...register("gas_safe_engineer_id")} placeholder="e.g. 123456" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Gauge className="w-5 h-5"/> Gas Supply & Pressure Readings</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Standing Pressure (mbar)</Label>
              <Input {...register("standing_pressure")} placeholder="e.g. 21" />
            </div>
            <div className="space-y-2">
              <Label>Working Pressure (mbar)</Label>
              <Input {...register("working_pressure")} placeholder="e.g. 19.5" />
            </div>
            <div className="space-y-2">
              <Label>Operating Pressure (mbar)</Label>
              <Input {...register("operating_pressure")} placeholder="e.g. 12.5" />
            </div>
            <div className="space-y-2">
              <Label>Gas Rate (m³/hr)</Label>
              <Input {...register("gas_rate_measured")} placeholder="e.g. 2.4" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Combustion Readings</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>CO (ppm)</Label>
              <Input {...register("combustion_co")} placeholder="e.g. 30" />
            </div>
            <div className="space-y-2">
              <Label>CO2 (%)</Label>
              <Input {...register("combustion_co2")} placeholder="e.g. 9.2" />
            </div>
            <div className="space-y-2">
              <Label>Flue Temperature (°C)</Label>
              <Input {...register("flue_temp")} placeholder="e.g. 125" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><ClipboardCheck className="w-5 h-5"/> Functional Tests</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ["ignition_tested", "Ignition Tested"],
              ["controls_tested", "Controls Tested"],
              ["thermostats_tested", "Thermostats Tested"],
              ["pressure_relief_tested", "Pressure Relief Tested"],
              ["expansion_vessel_checked", "Expansion Vessel Checked"],
              ["system_flushed", "System Flushed"],
              ["inhibitor_added", "Inhibitor Added"],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors text-sm">
                <input type="checkbox" {...register(field)} className="w-4 h-4 accent-emerald-600 rounded" />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><UserCheck className="w-5 h-5"/> Customer Handover</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-3 border rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors text-sm">
                <input type="checkbox" {...register("customer_instructions_given")} className="w-5 h-5 accent-emerald-600 rounded" />
                <span className="font-medium">Customer shown how to operate appliance</span>
              </label>
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
            placeholder="Any additional notes about commissioning..."
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
                      await customFetch(`${import.meta.env.BASE_URL}api/commissioning-records/${existingRecord!.id}`, { method: "DELETE" });
                      toast({ title: "Deleted", description: "Commissioning record deleted" });
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
              <Button type="submit" size="lg" className="px-8" disabled={createMutation.isPending || updateMutation.isPending}>
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
