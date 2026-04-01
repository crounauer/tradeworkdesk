import { useForm } from "react-hook-form";
import { useCreateOilTankRiskAssessment, useGetOilTankRiskAssessmentByJob, useUpdateOilTankRiskAssessment, customFetch } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldAlert, TriangleAlert, Scale } from "lucide-react";
import { useEffect , useRef, useState } from "react";

interface RiskAssessmentFormData {
  site_hazards: string;
  environmental_risks: string;
  fire_risk: string;
  access_risk: string;
  likelihood_rating: string;
  severity_rating: string;
  overall_risk_rating: string;
  control_measures: string;
  further_actions_required: string;
  assessor_name: string;
  assessor_qualification: string;
  assessment_date: string;
  additional_notes: string;
}

export default function OilTankRiskAssessmentForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetOilTankRiskAssessmentByJob(jobId!);
  const createMutation = useCreateOilTankRiskAssessment();
  const updateMutation = useUpdateOilTankRiskAssessment();

  const { register, handleSubmit, reset } = useForm<RiskAssessmentFormData>();
  const hasPopulated = useRef(false);

  useEffect(() => {
    if (existingRecord && !hasPopulated.current) {
      hasPopulated.current = true;
      reset({
        site_hazards: existingRecord.site_hazards || "",
        environmental_risks: existingRecord.environmental_risks || "",
        fire_risk: existingRecord.fire_risk || "",
        access_risk: existingRecord.access_risk || "",
        likelihood_rating: existingRecord.likelihood_rating || "",
        severity_rating: existingRecord.severity_rating || "",
        overall_risk_rating: existingRecord.overall_risk_rating || "",
        control_measures: existingRecord.control_measures || "",
        further_actions_required: existingRecord.further_actions_required || "",
        assessor_name: existingRecord.assessor_name || "",
        assessor_qualification: existingRecord.assessor_qualification || "",
        assessment_date: existingRecord.assessment_date || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: RiskAssessmentFormData) => {
    if (!user?.id) return;
    const payload = { ...data, job_id: jobId!, technician_id: user.id };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        toast({ title: "Updated", description: "Risk assessment updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Risk assessment created" });
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
          <ShieldAlert className="w-8 h-8 text-orange-500" /> Oil Tank Risk Assessment
        </h1>
        <p className="text-muted-foreground mt-1">Assess site hazards, risk ratings, and control measures.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-orange-600 flex items-center gap-2">
            <TriangleAlert className="w-5 h-5" /> Hazard Identification
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Site Hazards</Label>
              <Input {...register("site_hazards")} placeholder="Identify site-specific hazards..." />
            </div>
            <div className="space-y-2">
              <Label>Environmental Risks</Label>
              <Input {...register("environmental_risks")} placeholder="Watercourses, drains, groundwater..." />
            </div>
            <div className="space-y-2">
              <Label>Fire Risk</Label>
              <Input {...register("fire_risk")} placeholder="Proximity to buildings, ignition sources..." />
            </div>
            <div className="space-y-2">
              <Label>Access Risk</Label>
              <Input {...register("access_risk")} placeholder="Delivery access, tanker route hazards..." />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-red-600 flex items-center gap-2">
            <Scale className="w-5 h-5" /> Risk Rating
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Likelihood Rating</Label>
              <Input {...register("likelihood_rating")} placeholder="Low / Medium / High" />
            </div>
            <div className="space-y-2">
              <Label>Severity Rating</Label>
              <Input {...register("severity_rating")} placeholder="Low / Medium / High" />
            </div>
            <div className="space-y-2">
              <Label>Overall Risk Rating</Label>
              <Input {...register("overall_risk_rating")} placeholder="Low / Medium / High" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-emerald-600 flex items-center gap-2">
            Control Measures
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Control Measures in Place</Label>
              <Input {...register("control_measures")} placeholder="Existing mitigations and controls..." />
            </div>
            <div className="space-y-2">
              <Label>Further Actions Required</Label>
              <Input {...register("further_actions_required")} placeholder="Additional measures needed..." />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4">Assessor Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assessor Name</Label>
              <Input {...register("assessor_name")} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Assessor Qualification</Label>
              <Input {...register("assessor_qualification")} placeholder="e.g. OFTEC registered" />
            </div>
            <div className="space-y-2">
              <Label>Assessment Date</Label>
              <Input type="date" {...register("assessment_date")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
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
                      await customFetch(`${import.meta.env.BASE_URL}api/oil-tank-risk-assessments/${existingRecord!.id}`, { method: "DELETE" });
                      toast({ title: "Deleted", description: "Oil tank risk assessment deleted" });
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
            {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : existingRecord ? "Update Assessment" : "Save Assessment"}
          </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
