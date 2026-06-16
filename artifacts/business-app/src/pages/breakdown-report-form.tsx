import { useForm } from "react-hook-form";
import { useCreateBreakdownReport, useGetBreakdownReportByJob, useUpdateBreakdownReport, getGetBreakdownReportByJobQueryKey, customFetch } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle, Wrench, Trash2, FileDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface BreakdownFormData {
  reported_fault: string;
  symptoms: string;
  diagnostics_performed: string;
  findings: string;
  parts_required: string;
  temporary_fix: string;
  permanent_fix: string;
  appliance_safe: boolean;
  return_visit_required: boolean;
  return_visit_notes: string;
  additional_notes: string;
}

export default function BreakdownReportForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingReport, isLoading: isLoadingExisting, dataUpdatedAt } = useGetBreakdownReportByJob(jobId!);
  const queryClient = useQueryClient();

  const createMutation = useCreateBreakdownReport();
  const updateMutation = useUpdateBreakdownReport();

  const { register, handleSubmit, reset } = useForm<BreakdownFormData>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const populatedAt = useRef(0);

  useEffect(() => {
    if (existingReport && dataUpdatedAt > populatedAt.current) {
      populatedAt.current = dataUpdatedAt;
      reset({
        reported_fault: existingReport.reported_fault || "",
        symptoms: existingReport.symptoms || "",
        diagnostics_performed: existingReport.diagnostics_performed || "",
        findings: existingReport.findings || "",
        parts_required: existingReport.parts_required || "",
        temporary_fix: existingReport.temporary_fix || "",
        permanent_fix: existingReport.permanent_fix || "",
        appliance_safe: existingReport.appliance_safe ?? true,
        return_visit_required: existingReport.return_visit_required || false,
        return_visit_notes: existingReport.return_visit_notes || "",
        additional_notes: existingReport.additional_notes || "",
      });
    }
  }, [existingReport, dataUpdatedAt, reset]);

  const onSubmit = async (data: BreakdownFormData) => {
    if (!user?.id) return;

    const payload = {
      ...data,
      job_id: jobId!,
      technician_id: user.id,
    };

    try {
      if (existingReport) {
        await updateMutation.mutateAsync({
          id: existingReport.id,
          data: payload,
        });
        await queryClient.invalidateQueries({ queryKey: getGetBreakdownReportByJobQueryKey(jobId!) });
        toast({ title: "Updated", description: "Breakdown report updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        await queryClient.invalidateQueries({ queryKey: getGetBreakdownReportByJobQueryKey(jobId!) });
        toast({ title: "Success", description: "Breakdown report created" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/forms/breakdown_report/${existingReport!.id}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `breakdown-report-${jobId?.slice(0, 8)}.pdf`;
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
            <AlertTriangle className="w-8 h-8 text-rose-500" /> Breakdown Report
          </h1>
          <p className="text-muted-foreground mt-1">Document the fault, diagnosis, and repair.</p>
        </div>
        {existingReport && (
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-rose-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Fault Details
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reported Fault</Label>
              <Input {...register("reported_fault")} placeholder="What the customer reported..." />
            </div>
            <div className="space-y-2">
              <Label>Symptoms</Label>
              <Input {...register("symptoms")} placeholder="Observed symptoms..." />
            </div>
            <div className="space-y-2">
              <Label>Diagnostics Performed</Label>
              <Input {...register("diagnostics_performed")} placeholder="Tests and checks carried out..." />
            </div>
            <div className="space-y-2">
              <Label>Findings</Label>
              <Input {...register("findings")} placeholder="What was found during diagnosis..." />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2">
            <Wrench className="w-5 h-5" /> Repair Details
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Parts Required</Label>
              <Input {...register("parts_required")} placeholder="List parts needed..." />
            </div>
            <div className="space-y-2">
              <Label>Temporary Fix Applied</Label>
              <Input {...register("temporary_fix")} placeholder="Any temporary measures taken..." />
            </div>
            <div className="space-y-2">
              <Label>Permanent Fix</Label>
              <Input {...register("permanent_fix")} placeholder="Permanent repair performed or recommended..." />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4">Outcome</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
              <input type="checkbox" {...register("appliance_safe")} className="w-5 h-5 accent-primary rounded" />
              <span className="font-medium">Appliance Safe to Use</span>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
              <input type="checkbox" {...register("return_visit_required")} className="w-5 h-5 accent-primary rounded" />
              <span className="font-medium">Return Visit Required</span>
            </label>
            <div className="space-y-2 md:col-span-2">
              <Label>Return Visit Notes</Label>
              <Input {...register("return_visit_notes")} placeholder="Details about the return visit..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Additional Notes</Label>
              <Input {...register("additional_notes")} placeholder="Any other relevant information..." />
            </div>
          </div>
        </Card>

        <div className="flex justify-between gap-4 sticky bottom-6 z-10 bg-background/80 p-4 rounded-2xl backdrop-blur-md border border-border shadow-xl">
            <div>
              {existingReport && isAdmin && !showDeleteConfirm && (
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
                      await customFetch(`${import.meta.env.BASE_URL}api/breakdown-reports/${existingReport!.id}`, { method: "DELETE" });
                      toast({ title: "Deleted", description: "Breakdown report deleted" });
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
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : existingReport ? "Update Report" : "Save Report"}
          </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
