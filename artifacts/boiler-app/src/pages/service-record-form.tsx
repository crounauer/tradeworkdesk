import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { useCreateServiceRecord, useGetServiceRecordByJob, useUpdateServiceRecord } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, FileDown } from "lucide-react";
import { Link } from "wouter";
import { generateServiceRecordPdf } from "@/lib/pdf-generator";

interface ServiceRecordFormData {
  appliance_condition: string;
  flue_inspection: string;
  visual_inspection: string;
  combustion_co2: string;
  combustion_co: string;
  combustion_o2: string;
  combustion_efficiency: string;
  appliance_safe: boolean;
  defects_details: string;
  follow_up_required: boolean;
  work_completed: string;
  next_service_due: string;
}

export default function ServiceRecordForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting, queryKey } = useGetServiceRecordByJob(jobId!);
  void queryKey;

  const createMutation = useCreateServiceRecord();
  const updateMutation = useUpdateServiceRecord();

  const { register, handleSubmit, getValues, reset } = useForm<ServiceRecordFormData>();

  useEffect(() => {
    if (existingRecord) {
      reset({
        appliance_condition: existingRecord.appliance_condition || "",
        flue_inspection: existingRecord.flue_inspection || "",
        visual_inspection: existingRecord.visual_inspection || "",
        combustion_co2: existingRecord.combustion_co2 || "",
        combustion_co: existingRecord.combustion_co || "",
        combustion_o2: existingRecord.combustion_o2 || "",
        combustion_efficiency: existingRecord.combustion_efficiency || "",
        appliance_safe: existingRecord.appliance_safe ?? false,
        defects_details: existingRecord.defects_details || "",
        follow_up_required: existingRecord.follow_up_required || false,
        work_completed: existingRecord.work_completed || "",
        next_service_due: existingRecord.next_service_due || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: ServiceRecordFormData) => {
    if (!user?.id) return;

    const payload = {
      ...data,
      job_id: jobId!,
      technician_id: user.id,
    };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({
          id: existingRecord.id,
          data: payload,
        });
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
    generateServiceRecordPdf({
      jobId: jobId!,
      customerName: "Customer",
      propertyAddress: "Property",
      applianceName: "Appliance",
      technicianName: user?.email || "Technician",
      scheduledDate: new Date().toLocaleDateString(),
      serviceRecord: vals,
    });
  };

  if (isLoadingExisting) return <div className="p-8">Loading form...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Service Record</h1>
          <p className="text-muted-foreground mt-1">Complete all mandatory inspection sections.</p>
        </div>
        {existingRecord && (
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

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
              <Input {...register("visual_inspection")} />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Combustion Readings</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Label>Efficiency</Label>
              <Input {...register("combustion_efficiency")} />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Outcome & Safety</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("appliance_safe")} className="w-5 h-5 accent-primary rounded" />
                <span className="font-medium">Appliance Safe to Use</span>
              </label>

              <div className="space-y-2">
                <Label>Defects Found</Label>
                <Input {...register("defects_details")} placeholder="List any defects..." />
              </div>
            </div>

            <div className="space-y-4">
               <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("follow_up_required")} className="w-5 h-5 accent-primary rounded" />
                <span className="font-medium">Follow-up Required</span>
              </label>

              <div className="space-y-2">
                <Label>Work Completed</Label>
                <Input {...register("work_completed")} placeholder="Summary of service..." />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4">Scheduling</h2>
          <div className="space-y-2 max-w-xs">
            <Label>Next Service Due</Label>
            <Input type="date" {...register("next_service_due")} />
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
