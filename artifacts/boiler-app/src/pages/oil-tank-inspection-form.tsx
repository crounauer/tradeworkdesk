import { useForm } from "react-hook-form";
import { useCreateOilTankInspection, useGetOilTankInspectionByJob, getGetOilTankInspectionByJobQueryKey, useUpdateOilTankInspection, customFetch } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Droplets, Shield, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface OilTankInspectionFormData {
  tank_type: string;
  tank_size: string;
  tank_material: string;
  tank_location: string;
  tank_age: string;
  bunding_type: string;
  bunding_condition: string;
  sight_gauge_condition: string;
  fill_point_condition: string;
  vent_condition: string;
  filter_condition: string;
  pipework_condition: string;
  supports_condition: string;
  overall_condition: string;
  leaks_found: boolean;
  leaks_details: string;
  remedial_actions: string;
  additional_notes: string;
}

export default function OilTankInspectionForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting, dataUpdatedAt } = useGetOilTankInspectionByJob(jobId!);
  const queryClient = useQueryClient();
  const createMutation = useCreateOilTankInspection();
  const updateMutation = useUpdateOilTankInspection();

  const { register, handleSubmit, reset } = useForm<OilTankInspectionFormData>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const populatedAt = useRef(0);

  useEffect(() => {
    if (existingRecord && dataUpdatedAt > populatedAt.current) {
      populatedAt.current = dataUpdatedAt;
      reset({
        tank_type: existingRecord.tank_type || "",
        tank_size: existingRecord.tank_size || "",
        tank_material: existingRecord.tank_material || "",
        tank_location: existingRecord.tank_location || "",
        tank_age: existingRecord.tank_age || "",
        bunding_type: existingRecord.bunding_type || "",
        bunding_condition: existingRecord.bunding_condition || "",
        sight_gauge_condition: existingRecord.sight_gauge_condition || "",
        fill_point_condition: existingRecord.fill_point_condition || "",
        vent_condition: existingRecord.vent_condition || "",
        filter_condition: existingRecord.filter_condition || "",
        pipework_condition: existingRecord.pipework_condition || "",
        supports_condition: existingRecord.supports_condition || "",
        overall_condition: existingRecord.overall_condition || "",
        leaks_found: existingRecord.leaks_found || false,
        leaks_details: existingRecord.leaks_details || "",
        remedial_actions: existingRecord.remedial_actions || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, dataUpdatedAt, reset]);

  const onSubmit = async (data: OilTankInspectionFormData) => {
    if (!user?.id) return;
    const payload = { ...data, job_id: jobId!, technician_id: user.id };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetOilTankInspectionByJobQueryKey(jobId!) });
        toast({ title: "Updated", description: "Oil tank inspection updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetOilTankInspectionByJobQueryKey(jobId!) });
        toast({ title: "Success", description: "Oil tank inspection created" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  if (isLoadingExisting) return <div className="p-8">Loading form...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Droplets className="w-8 h-8 text-blue-500" /> Oil Tank Inspection
        </h1>
        <p className="text-muted-foreground mt-1">Record tank installation details, condition, and inspection findings.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-blue-600 flex items-center gap-2">
            <Droplets className="w-5 h-5" /> Tank Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tank Type</Label>
              <Input {...register("tank_type")} placeholder="e.g. Single skin, Bunded, Integrally bunded" />
            </div>
            <div className="space-y-2">
              <Label>Tank Size (litres)</Label>
              <Input {...register("tank_size")} placeholder="e.g. 1000, 1200, 2500" />
            </div>
            <div className="space-y-2">
              <Label>Tank Material</Label>
              <Input {...register("tank_material")} placeholder="e.g. Plastic, Steel, GRP" />
            </div>
            <div className="space-y-2">
              <Label>Tank Location</Label>
              <Input {...register("tank_location")} placeholder="e.g. Garden, Garage, Outbuilding" />
            </div>
            <div className="space-y-2">
              <Label>Approximate Age</Label>
              <Input {...register("tank_age")} placeholder="e.g. 5 years, 10+ years" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-emerald-600 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Bunding
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bunding Type</Label>
              <Input {...register("bunding_type")} placeholder="e.g. Masonry, Proprietary, None" />
            </div>
            <div className="space-y-2">
              <Label>Bunding Condition</Label>
              <Input {...register("bunding_condition")} placeholder="e.g. Good, Fair, Poor, N/A" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-amber-600 flex items-center gap-2">
            <Eye className="w-5 h-5" /> Component Condition
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sight Gauge Condition</Label>
              <Input {...register("sight_gauge_condition")} placeholder="Good / Fair / Poor / N/A" />
            </div>
            <div className="space-y-2">
              <Label>Fill Point Condition</Label>
              <Input {...register("fill_point_condition")} placeholder="Good / Fair / Poor" />
            </div>
            <div className="space-y-2">
              <Label>Vent Condition</Label>
              <Input {...register("vent_condition")} placeholder="Good / Fair / Poor" />
            </div>
            <div className="space-y-2">
              <Label>Filter Condition</Label>
              <Input {...register("filter_condition")} placeholder="Good / Fair / Poor" />
            </div>
            <div className="space-y-2">
              <Label>Pipework Condition</Label>
              <Input {...register("pipework_condition")} placeholder="Good / Fair / Poor" />
            </div>
            <div className="space-y-2">
              <Label>Supports Condition</Label>
              <Input {...register("supports_condition")} placeholder="Good / Fair / Poor" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Overall Condition</Label>
              <Input {...register("overall_condition")} placeholder="Overall assessment..." />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4">Findings & Actions</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
              <input type="checkbox" {...register("leaks_found")} className="w-5 h-5 accent-primary rounded" />
              <span className="font-medium">Leaks Found</span>
            </label>
            <div className="space-y-2">
              <Label>Leak Details</Label>
              <Input {...register("leaks_details")} placeholder="Describe any leaks found..." />
            </div>
            <div className="space-y-2">
              <Label>Remedial Actions</Label>
              <Input {...register("remedial_actions")} placeholder="Actions required or taken..." />
            </div>
            <div className="space-y-2">
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
                      await customFetch(`${import.meta.env.BASE_URL}api/oil-tank-inspections/${existingRecord!.id}`, { method: "DELETE" });
                      toast({ title: "Deleted", description: "Oil tank inspection deleted" });
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
