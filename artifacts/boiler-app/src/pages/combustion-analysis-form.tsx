import { useForm } from "react-hook-form";
import { useCreateCombustionAnalysisRecord, useGetCombustionAnalysisRecordByJob, useUpdateCombustionAnalysisRecord } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Gauge, Thermometer, Award } from "lucide-react";
import { useEffect } from "react";

interface CombustionAnalysisFormData {
  co2_reading: string;
  co_reading: string;
  o2_reading: string;
  flue_temperature: string;
  ambient_temperature: string;
  efficiency: string;
  excess_air: string;
  smoke_number: string;
  ambient_co: string;
  draft_reading: string;
  instrument_make: string;
  instrument_model: string;
  instrument_serial: string;
  calibration_date: string;
  pass_fail: string;
  additional_notes: string;
}

export default function CombustionAnalysisForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetCombustionAnalysisRecordByJob(jobId!);
  const createMutation = useCreateCombustionAnalysisRecord();
  const updateMutation = useUpdateCombustionAnalysisRecord();

  const { register, handleSubmit, reset } = useForm<CombustionAnalysisFormData>();

  useEffect(() => {
    if (existingRecord) {
      reset({
        co2_reading: existingRecord.co2_reading || "",
        co_reading: existingRecord.co_reading || "",
        o2_reading: existingRecord.o2_reading || "",
        flue_temperature: existingRecord.flue_temperature || "",
        ambient_temperature: existingRecord.ambient_temperature || "",
        efficiency: existingRecord.efficiency || "",
        excess_air: existingRecord.excess_air || "",
        smoke_number: existingRecord.smoke_number || "",
        ambient_co: existingRecord.ambient_co || "",
        draft_reading: existingRecord.draft_reading || "",
        instrument_make: existingRecord.instrument_make || "",
        instrument_model: existingRecord.instrument_model || "",
        instrument_serial: existingRecord.instrument_serial || "",
        calibration_date: existingRecord.calibration_date || "",
        pass_fail: existingRecord.pass_fail || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: CombustionAnalysisFormData) => {
    if (!user?.id) return;
    const payload = { ...data, job_id: jobId!, technician_id: user.id };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        toast({ title: "Updated", description: "Combustion analysis updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Combustion analysis created" });
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
          <Gauge className="w-8 h-8 text-indigo-500" /> Combustion Analysis Record
        </h1>
        <p className="text-muted-foreground mt-1">Record flue gas readings, efficiency, and instrument details.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-indigo-600 flex items-center gap-2">
            <Gauge className="w-5 h-5" /> Flue Gas Readings
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>CO2 (%)</Label>
              <Input {...register("co2_reading")} placeholder="e.g. 10.5" />
            </div>
            <div className="space-y-2">
              <Label>CO (ppm)</Label>
              <Input {...register("co_reading")} placeholder="e.g. 42" />
            </div>
            <div className="space-y-2">
              <Label>O2 (%)</Label>
              <Input {...register("o2_reading")} placeholder="e.g. 5.8" />
            </div>
            <div className="space-y-2">
              <Label>Excess Air (%)</Label>
              <Input {...register("excess_air")} placeholder="e.g. 35" />
            </div>
            <div className="space-y-2">
              <Label>Smoke Number</Label>
              <Input {...register("smoke_number")} placeholder="0-9" />
            </div>
            <div className="space-y-2">
              <Label>Draft Reading (Pa)</Label>
              <Input {...register("draft_reading")} placeholder="e.g. -0.02" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-amber-600 flex items-center gap-2">
            <Thermometer className="w-5 h-5" /> Temperature & Efficiency
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Flue Temperature (°C)</Label>
              <Input {...register("flue_temperature")} placeholder="e.g. 220" />
            </div>
            <div className="space-y-2">
              <Label>Ambient Temperature (°C)</Label>
              <Input {...register("ambient_temperature")} placeholder="e.g. 20" />
            </div>
            <div className="space-y-2">
              <Label>Efficiency (%)</Label>
              <Input {...register("efficiency")} placeholder="e.g. 85.5" />
            </div>
            <div className="space-y-2">
              <Label>Ambient CO (ppm)</Label>
              <Input {...register("ambient_co")} placeholder="e.g. 0" />
            </div>
            <div className="space-y-2">
              <Label>Pass / Fail</Label>
              <Input {...register("pass_fail")} placeholder="Pass / Fail" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-slate-600 flex items-center gap-2">
            <Award className="w-5 h-5" /> Instrument Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Instrument Make</Label>
              <Input {...register("instrument_make")} placeholder="e.g. Testo, Kane" />
            </div>
            <div className="space-y-2">
              <Label>Instrument Model</Label>
              <Input {...register("instrument_model")} placeholder="e.g. 320, 458s" />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input {...register("instrument_serial")} placeholder="Instrument serial number" />
            </div>
            <div className="space-y-2">
              <Label>Calibration Date</Label>
              <Input type="date" {...register("calibration_date")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
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
