import { useForm } from "react-hook-form";
import { useCreateFireValveTestRecord, useGetFireValveTestRecordByJob, useUpdateFireValveTestRecord } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldCheck, MapPin } from "lucide-react";
import { useEffect , useRef } from "react";

interface FireValveTestFormData {
  valve_location: string;
  valve_type: string;
  valve_manufacturer: string;
  test_date: string;
  test_method: string;
  test_result: string;
  response_time: string;
  reset_successful: boolean;
  remedial_action: string;
  additional_notes: string;
}

export default function FireValveTestForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetFireValveTestRecordByJob(jobId!);
  const createMutation = useCreateFireValveTestRecord();
  const updateMutation = useUpdateFireValveTestRecord();

  const { register, handleSubmit, reset } = useForm<FireValveTestFormData>();
  const hasPopulated = useRef(false);

  useEffect(() => {
    if (existingRecord && !hasPopulated.current) {
      hasPopulated.current = true;
      reset({
        valve_location: existingRecord.valve_location || "",
        valve_type: existingRecord.valve_type || "",
        valve_manufacturer: existingRecord.valve_manufacturer || "",
        test_date: existingRecord.test_date || "",
        test_method: existingRecord.test_method || "",
        test_result: existingRecord.test_result || "",
        response_time: existingRecord.response_time || "",
        reset_successful: existingRecord.reset_successful || false,
        remedial_action: existingRecord.remedial_action || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: FireValveTestFormData) => {
    if (!user?.id) return;
    const payload = { ...data, job_id: jobId!, technician_id: user.id };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        toast({ title: "Updated", description: "Fire valve test updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Fire valve test created" });
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
          <ShieldCheck className="w-8 h-8 text-red-500" /> Fire Valve Test Record
        </h1>
        <p className="text-muted-foreground mt-1">Record fire valve details, test method, and results.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-red-600 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Valve Details
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valve Location</Label>
              <Input {...register("valve_location")} placeholder="e.g. Oil line entry point" />
            </div>
            <div className="space-y-2">
              <Label>Valve Type</Label>
              <Input {...register("valve_type")} placeholder="e.g. Fusible link, Remote" />
            </div>
            <div className="space-y-2">
              <Label>Valve Manufacturer</Label>
              <Input {...register("valve_manufacturer")} placeholder="Manufacturer name" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-amber-600 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Test Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Test Date</Label>
              <Input type="date" {...register("test_date")} />
            </div>
            <div className="space-y-2">
              <Label>Test Method</Label>
              <Input {...register("test_method")} placeholder="Method used to test the valve" />
            </div>
            <div className="space-y-2">
              <Label>Test Result</Label>
              <Input {...register("test_result")} placeholder="Pass / Fail" />
            </div>
            <div className="space-y-2">
              <Label>Response Time</Label>
              <Input {...register("response_time")} placeholder="Time to close (seconds)" />
            </div>
            <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
              <input type="checkbox" {...register("reset_successful")} className="w-5 h-5 accent-primary rounded" />
              <span className="font-medium">Reset Successful</span>
            </label>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4">Remedial Action & Notes</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Remedial Action</Label>
              <Input {...register("remedial_action")} placeholder="Actions taken if test failed..." />
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
