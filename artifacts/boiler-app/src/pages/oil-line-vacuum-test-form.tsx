import { useForm } from "react-hook-form";
import { useCreateOilLineVacuumTest, useGetOilLineVacuumTestByJob, useUpdateOilLineVacuumTest } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pipette, Timer, CheckCircle } from "lucide-react";
import { useEffect , useRef } from "react";

interface OilLineVacuumTestFormData {
  pipe_size: string;
  pipe_material: string;
  pipe_length: string;
  number_of_joints: string;
  initial_vacuum: string;
  vacuum_after_5_min: string;
  vacuum_after_10_min: string;
  allowable_drop: string;
  actual_drop: string;
  pass_fail: string;
  remedial_action: string;
  additional_notes: string;
}

export default function OilLineVacuumTestForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetOilLineVacuumTestByJob(jobId!);
  const createMutation = useCreateOilLineVacuumTest();
  const updateMutation = useUpdateOilLineVacuumTest();

  const { register, handleSubmit, reset } = useForm<OilLineVacuumTestFormData>();
  const hasPopulated = useRef(false);

  useEffect(() => {
    if (existingRecord && !hasPopulated.current) {
      hasPopulated.current = true;
      reset({
        pipe_size: existingRecord.pipe_size || "",
        pipe_material: existingRecord.pipe_material || "",
        pipe_length: existingRecord.pipe_length || "",
        number_of_joints: existingRecord.number_of_joints || "",
        initial_vacuum: existingRecord.initial_vacuum || "",
        vacuum_after_5_min: existingRecord.vacuum_after_5_min || "",
        vacuum_after_10_min: existingRecord.vacuum_after_10_min || "",
        allowable_drop: existingRecord.allowable_drop || "",
        actual_drop: existingRecord.actual_drop || "",
        pass_fail: existingRecord.pass_fail || "",
        remedial_action: existingRecord.remedial_action || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: OilLineVacuumTestFormData) => {
    if (!user?.id) return;
    const payload = { ...data, job_id: jobId!, technician_id: user.id };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        toast({ title: "Updated", description: "Vacuum test updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Vacuum test created" });
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
          <Pipette className="w-8 h-8 text-teal-500" /> Oil Line Vacuum Test
        </h1>
        <p className="text-muted-foreground mt-1">Record pipework details and vacuum gauge readings over time.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-teal-600 flex items-center gap-2">
            <Pipette className="w-5 h-5" /> Pipework Details
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Pipe Size (mm)</Label>
              <Input {...register("pipe_size")} placeholder="e.g. 10mm" />
            </div>
            <div className="space-y-2">
              <Label>Pipe Material</Label>
              <Input {...register("pipe_material")} placeholder="e.g. Copper, Plastic" />
            </div>
            <div className="space-y-2">
              <Label>Pipe Length (m)</Label>
              <Input {...register("pipe_length")} placeholder="e.g. 15" />
            </div>
            <div className="space-y-2">
              <Label>Number of Joints</Label>
              <Input {...register("number_of_joints")} placeholder="e.g. 6" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-indigo-600 flex items-center gap-2">
            <Timer className="w-5 h-5" /> Vacuum Readings
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Initial Vacuum (inHg)</Label>
              <Input {...register("initial_vacuum")} placeholder="e.g. 20" />
            </div>
            <div className="space-y-2">
              <Label>After 5 Minutes (inHg)</Label>
              <Input {...register("vacuum_after_5_min")} placeholder="e.g. 19.5" />
            </div>
            <div className="space-y-2">
              <Label>After 10 Minutes (inHg)</Label>
              <Input {...register("vacuum_after_10_min")} placeholder="e.g. 19" />
            </div>
            <div className="space-y-2">
              <Label>Allowable Drop (inHg)</Label>
              <Input {...register("allowable_drop")} placeholder="e.g. 2" />
            </div>
            <div className="space-y-2">
              <Label>Actual Drop (inHg)</Label>
              <Input {...register("actual_drop")} placeholder="e.g. 1" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-emerald-600 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> Result
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pass / Fail</Label>
              <Input {...register("pass_fail")} placeholder="Pass / Fail" />
            </div>
            <div className="space-y-2">
              <Label>Remedial Action</Label>
              <Input {...register("remedial_action")} placeholder="Actions if failed..." />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Input {...register("additional_notes")} placeholder="Any other observations..." />
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
