import { useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateHeatPumpServiceRecord, useGetHeatPumpServiceRecordByJob, getGetHeatPumpServiceRecordByJobQueryKey, useUpdateHeatPumpServiceRecord, customFetch } from "@workspace/api-client-react";
import type { CreateHeatPumpServiceRecordBody } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileDown, Zap, Wind, ClipboardCheck, AlertCircle, Trash2 } from "lucide-react";
import { Link } from "wouter";

interface HeatPumpServiceFormData {
  outdoor_unit_condition: string;
  indoor_unit_condition: string;
  controls_checked: boolean;
  filter_condition: string;
  dhw_cylinder_checked: boolean;
  dhw_cylinder_temp: string;
  prv_checked: boolean;
  expansion_vessel_charge: string;
  glycol: boolean;
  glycol_temp_rating: string;
  anti_freeze_valves: boolean;
  inhibitor: boolean;
  fungicide: boolean;
  evaporator_cleaned: boolean;
  y_strainer_cleaned: boolean;
  defects_found: boolean;
  defects_details: string;
  advisories: string;
  follow_up_required: boolean;
  follow_up_notes: string;
  additional_notes: string;
}

export default function HeatPumpServiceForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting, dataUpdatedAt } = useGetHeatPumpServiceRecordByJob(jobId!);
  const queryClient = useQueryClient();


  const createMutation = useCreateHeatPumpServiceRecord();
  const updateMutation = useUpdateHeatPumpServiceRecord();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const { register, handleSubmit, reset } = useForm<HeatPumpServiceFormData>();
  const populatedAt = useRef(0);

  useEffect(() => {
    if (existingRecord && dataUpdatedAt > populatedAt.current) {
      populatedAt.current = dataUpdatedAt;
      reset({
        outdoor_unit_condition: existingRecord.outdoor_unit_condition || "",
        indoor_unit_condition: existingRecord.indoor_unit_condition || "",
        controls_checked: existingRecord.controls_checked ?? false,
        filter_condition: existingRecord.filter_condition || "",
        dhw_cylinder_checked: existingRecord.dhw_cylinder_checked ?? false,
        dhw_cylinder_temp: existingRecord.dhw_cylinder_temp || "",
        prv_checked: existingRecord.prv_checked ?? false,
        expansion_vessel_charge: existingRecord.expansion_vessel_charge || "",
        glycol: existingRecord.glycol ?? false,
        glycol_temp_rating: existingRecord.glycol_temp_rating || "",
        anti_freeze_valves: existingRecord.anti_freeze_valves ?? false,
        inhibitor: existingRecord.inhibitor ?? false,
        fungicide: existingRecord.fungicide ?? false,
        evaporator_cleaned: existingRecord.evaporator_cleaned ?? false,
        y_strainer_cleaned: existingRecord.y_strainer_cleaned ?? false,
        defects_found: existingRecord.defects_found ?? false,
        defects_details: existingRecord.defects_details || "",
        advisories: existingRecord.advisories || "",
        follow_up_required: existingRecord.follow_up_required ?? false,
        follow_up_notes: existingRecord.follow_up_notes || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, dataUpdatedAt, reset]);

  const onSubmit = async (data: HeatPumpServiceFormData) => {
    if (!user?.id || !jobId) return;

    const payload: CreateHeatPumpServiceRecordBody = {
      job_id: jobId,
      technician_id: user.id,
      outdoor_unit_condition: data.outdoor_unit_condition || undefined,
      indoor_unit_condition: data.indoor_unit_condition || undefined,
      controls_checked: data.controls_checked,
      filter_condition: data.filter_condition || undefined,
      dhw_cylinder_checked: data.dhw_cylinder_checked,
      dhw_cylinder_temp: data.dhw_cylinder_temp || undefined,
      prv_checked: data.prv_checked,
      expansion_vessel_charge: data.expansion_vessel_charge || undefined,
      glycol: data.glycol,
      glycol_temp_rating: data.glycol_temp_rating || undefined,
      anti_freeze_valves: data.anti_freeze_valves,
      inhibitor: data.inhibitor,
      fungicide: data.fungicide,
      evaporator_cleaned: data.evaporator_cleaned,
      y_strainer_cleaned: data.y_strainer_cleaned,
      defects_found: data.defects_found,
      defects_details: data.defects_details || undefined,
      advisories: data.advisories || undefined,
      follow_up_required: data.follow_up_required,
      follow_up_notes: data.follow_up_notes || undefined,
      additional_notes: data.additional_notes || undefined,
    };

    try {
      if (existingRecord) {
        const { job_id: _jid, technician_id: _tid, ...updatePayload } = payload;
        await updateMutation.mutateAsync({ jobId, data: updatePayload });
        await queryClient.invalidateQueries({ queryKey: getGetHeatPumpServiceRecordByJobQueryKey(jobId!) });
        toast({ title: "Updated", description: "Heat pump service record updated successfully" });
      } else {
        await createMutation.mutateAsync({ jobId, data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetHeatPumpServiceRecordByJobQueryKey(jobId!) });
        toast({ title: "Success", description: "Heat pump service record created successfully" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/forms/heat_pump_service_record/${existingRecord!.id}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heat-pump-service-${jobId?.slice(0, 8)}.pdf`;
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
          <h1 className="text-3xl font-display font-bold">Heat Pump Service Record</h1>
          <p className="text-muted-foreground mt-1">Complete inspection and service checks for heat pump system.</p>
        </div>
        {existingRecord && (
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Zap className="w-5 h-5"/> Unit Condition</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Outdoor Unit Condition</Label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]"
                {...register("outdoor_unit_condition")}
                placeholder="Describe outdoor unit condition, coil cleanliness, fan operation..."
              />
            </div>
            <div className="space-y-2">
              <Label>Indoor Unit Condition</Label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]"
                {...register("indoor_unit_condition")}
                placeholder="Describe indoor unit condition, heat exchanger, pump..."
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><ClipboardCheck className="w-5 h-5"/> Service Checks</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {([
              ["controls_checked", "Controls Checked"],
              ["dhw_cylinder_checked", "DHW Cylinder Checked"],
              ["prv_checked", "PRV Checked"],
              ["anti_freeze_valves", "Anti-freeze Valves"],
              ["inhibitor", "Inhibitor Added"],
              ["fungicide", "Fungicide Added"],
              ["evaporator_cleaned", "Evaporator Cleaned"],
              ["y_strainer_cleaned", "Y-Strainer Cleaned"],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-cyan-50 cursor-pointer transition-colors text-sm">
                <input type="checkbox" {...register(field)} className="w-4 h-4 accent-cyan-600 rounded" />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Magnetic Filter Condition</Label>
              <Input {...register("filter_condition")} placeholder="e.g. Clean, Dirty - Cleaned, Replaced" />
            </div>
            <div className="space-y-2">
              <Label>DHW Cylinder Temperature (°C)</Label>
              <Input {...register("dhw_cylinder_temp")} placeholder="e.g. 55" />
            </div>
            <div className="space-y-2">
              <Label>Expansion Vessel Charge (bar)</Label>
              <Input {...register("expansion_vessel_charge")} placeholder="e.g. 1.5" />
            </div>
          </div>
          <div className="border rounded-xl p-4 bg-cyan-50/30">
            <h3 className="font-semibold text-sm mb-3 text-cyan-700">Glycol</h3>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" {...register("glycol")} className="w-4 h-4 accent-cyan-600 rounded" />
                <span className="font-medium">Glycol Present</span>
              </label>
            </div>
            <div className="space-y-2">
              <Label>Glycol Temp Rating (°C)</Label>
              <Input {...register("glycol_temp_rating")} placeholder="e.g. -15" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><AlertCircle className="w-5 h-5"/> Defects & Advisories</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="flex items-center gap-2 p-3 border rounded-xl hover:bg-cyan-50 cursor-pointer transition-colors text-sm">
              <input type="checkbox" {...register("defects_found")} className="w-4 h-4 accent-cyan-600 rounded" />
              <span className="font-medium">Defects Found</span>
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-xl hover:bg-cyan-50 cursor-pointer transition-colors text-sm">
              <input type="checkbox" {...register("follow_up_required")} className="w-4 h-4 accent-cyan-600 rounded" />
              <span className="font-medium">Follow-up Required</span>
            </label>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Defects Details</Label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]"
                {...register("defects_details")}
                placeholder="Describe any defects found..."
              />
            </div>
            <div className="space-y-2">
              <Label>Advisories</Label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]"
                {...register("advisories")}
                placeholder="Any advisory notes for the customer..."
              />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Notes</Label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]"
                {...register("follow_up_notes")}
                placeholder="Details of required follow-up work..."
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary">Additional Notes</h2>
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[100px]"
            {...register("additional_notes")}
            placeholder="Any additional notes about the service..."
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
                      await customFetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/heat-pump-service/${existingRecord!.id}`, { method: "DELETE" });
                      toast({ title: "Deleted", description: "Heat pump service record deleted" });
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
                  : existingRecord ? "Update Service Record" : "Save Service Record"
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
