import { useForm } from "react-hook-form";
import { useCreateJobCompletionReport, useGetJobCompletionReportByJob, useUpdateJobCompletionReport } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ClipboardList, CalendarCheck } from "lucide-react";
import { useEffect, useRef } from "react";

interface JobCompletionFormData {
  work_completed: string;
  outstanding_items: string;
  defects_found: string;
  advisories: string;
  customer_advised: boolean;
  customer_sign_off: boolean;
  customer_name_signed: string;
  next_service_date: string;
  follow_up_required: boolean;
  follow_up_notes: string;
  additional_notes: string;
}

export default function JobCompletionReportForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetJobCompletionReportByJob(jobId!);
  const createMutation = useCreateJobCompletionReport();
  const updateMutation = useUpdateJobCompletionReport();

  const { register, handleSubmit, reset } = useForm<JobCompletionFormData>();
  const hasPopulated = useRef(false);

  useEffect(() => {
    if (existingRecord && !hasPopulated.current) {
      hasPopulated.current = true;
      reset({
        work_completed: existingRecord.work_completed || "",
        outstanding_items: existingRecord.outstanding_items || "",
        defects_found: existingRecord.defects_found || "",
        advisories: existingRecord.advisories || "",
        customer_advised: existingRecord.customer_advised || false,
        customer_sign_off: existingRecord.customer_sign_off || false,
        customer_name_signed: existingRecord.customer_name_signed || "",
        next_service_date: existingRecord.next_service_date || "",
        follow_up_required: existingRecord.follow_up_required || false,
        follow_up_notes: existingRecord.follow_up_notes || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: JobCompletionFormData) => {
    if (!user?.id) return;
    const payload = { ...data, job_id: jobId!, technician_id: user.id };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        toast({ title: "Updated", description: "Completion report updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Completion report created" });
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
          <ClipboardList className="w-8 h-8 text-emerald-500" /> Job Completion Report
        </h1>
        <p className="text-muted-foreground mt-1">Summarise work carried out, findings, and next steps.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-emerald-600 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Work Summary
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Work Completed</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("work_completed")} placeholder="Describe all work carried out..." />
            </div>
            <div className="space-y-2">
              <Label>Outstanding Items</Label>
              <Input {...register("outstanding_items")} placeholder="Work not completed or deferred..." />
            </div>
            <div className="space-y-2">
              <Label>Defects Found</Label>
              <Input {...register("defects_found")} placeholder="Any defects identified..." />
            </div>
            <div className="space-y-2">
              <Label>Advisories</Label>
              <Input {...register("advisories")} placeholder="Recommendations to the customer..." />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-amber-600 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" /> Customer Sign-off & Follow-up
          </h2>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("customer_advised")} className="w-5 h-5 accent-primary rounded" />
                <span className="font-medium">Customer Advised of Findings</span>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="checkbox" {...register("customer_sign_off")} className="w-5 h-5 accent-primary rounded" />
                <span className="font-medium">Customer Sign-off Obtained</span>
              </label>
            </div>
            <div className="space-y-2">
              <Label>Customer Name (Signed)</Label>
              <Input {...register("customer_name_signed")} placeholder="Name of person who signed off" />
            </div>
            <div className="space-y-2">
              <Label>Next Recommended Service Date</Label>
              <Input type="date" {...register("next_service_date")} />
            </div>
            <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
              <input type="checkbox" {...register("follow_up_required")} className="w-5 h-5 accent-primary rounded" />
              <span className="font-medium">Follow-up Visit Required</span>
            </label>
            <div className="space-y-2">
              <Label>Follow-up Notes</Label>
              <Input {...register("follow_up_notes")} placeholder="Details about required follow-up..." />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...register("additional_notes")} placeholder="Any other information..." />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-4 sticky bottom-6 z-10 bg-background/80 p-4 rounded-2xl backdrop-blur-md border border-border shadow-xl">
          <Button variant="outline" type="button" onClick={() => setLocation(`/jobs/${jobId}`)}>Cancel</Button>
          <Button type="submit" size="lg" className="w-48 shadow-lg shadow-primary/30" disabled={createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : existingRecord ? "Update Report" : "Save Report"}
          </Button>
        </div>
      </form>
    </div>
  );
}
