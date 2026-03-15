import { useForm } from "react-hook-form";
import { useCreateBurnerSetupRecord, useGetBurnerSetupRecordByJob, useUpdateBurnerSetupRecord } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame, Settings, Gauge } from "lucide-react";
import { useEffect } from "react";

interface BurnerSetupFormData {
  burner_manufacturer: string;
  burner_model: string;
  burner_serial_number: string;
  nozzle_size: string;
  nozzle_type: string;
  nozzle_angle: string;
  pump_pressure: string;
  pump_vacuum: string;
  electrode_gap: string;
  electrode_position: string;
  air_damper_setting: string;
  head_setting: string;
  combustion_co2: string;
  combustion_co: string;
  combustion_smoke: string;
  combustion_efficiency: string;
  additional_notes: string;
}

export default function BurnerSetupForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetBurnerSetupRecordByJob(jobId!);
  const createMutation = useCreateBurnerSetupRecord();
  const updateMutation = useUpdateBurnerSetupRecord();

  const { register, handleSubmit, reset } = useForm<BurnerSetupFormData>();

  useEffect(() => {
    if (existingRecord) {
      reset({
        burner_manufacturer: existingRecord.burner_manufacturer || "",
        burner_model: existingRecord.burner_model || "",
        burner_serial_number: existingRecord.burner_serial_number || "",
        nozzle_size: existingRecord.nozzle_size || "",
        nozzle_type: existingRecord.nozzle_type || "",
        nozzle_angle: existingRecord.nozzle_angle || "",
        pump_pressure: existingRecord.pump_pressure || "",
        pump_vacuum: existingRecord.pump_vacuum || "",
        electrode_gap: existingRecord.electrode_gap || "",
        electrode_position: existingRecord.electrode_position || "",
        air_damper_setting: existingRecord.air_damper_setting || "",
        head_setting: existingRecord.head_setting || "",
        combustion_co2: existingRecord.combustion_co2 || "",
        combustion_co: existingRecord.combustion_co || "",
        combustion_smoke: existingRecord.combustion_smoke || "",
        combustion_efficiency: existingRecord.combustion_efficiency || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: BurnerSetupFormData) => {
    if (!user?.id) return;
    const payload = { ...data, job_id: jobId!, technician_id: user.id };

    try {
      if (existingRecord) {
        await updateMutation.mutateAsync({ id: existingRecord.id, data: payload });
        toast({ title: "Updated", description: "Burner setup record updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Burner setup record created" });
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
          <Flame className="w-8 h-8 text-orange-500" /> Burner Setup Record
        </h1>
        <p className="text-muted-foreground mt-1">Record burner details, nozzle, pressure, and electrode settings.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-orange-600 flex items-center gap-2">
            <Flame className="w-5 h-5" /> Burner Details
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input {...register("burner_manufacturer")} placeholder="e.g. Riello, Danfoss" />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input {...register("burner_model")} placeholder="Burner model" />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input {...register("burner_serial_number")} placeholder="Serial number" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-blue-600 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Nozzle & Pressure
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nozzle Size (USgal/h)</Label>
              <Input {...register("nozzle_size")} placeholder="e.g. 0.50, 0.65" />
            </div>
            <div className="space-y-2">
              <Label>Nozzle Type</Label>
              <Input {...register("nozzle_type")} placeholder="e.g. Solid, Semi-solid, Hollow" />
            </div>
            <div className="space-y-2">
              <Label>Nozzle Angle</Label>
              <Input {...register("nozzle_angle")} placeholder="e.g. 60°, 80°" />
            </div>
            <div className="space-y-2">
              <Label>Pump Pressure (bar)</Label>
              <Input {...register("pump_pressure")} placeholder="e.g. 7, 10" />
            </div>
            <div className="space-y-2">
              <Label>Pump Vacuum (inHg)</Label>
              <Input {...register("pump_vacuum")} placeholder="e.g. 10" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-purple-600 flex items-center gap-2">
            Electrode & Air Settings
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Electrode Gap (mm)</Label>
              <Input {...register("electrode_gap")} placeholder="e.g. 3-4mm" />
            </div>
            <div className="space-y-2">
              <Label>Electrode Position</Label>
              <Input {...register("electrode_position")} placeholder="Position relative to nozzle" />
            </div>
            <div className="space-y-2">
              <Label>Air Damper Setting</Label>
              <Input {...register("air_damper_setting")} placeholder="Position or setting" />
            </div>
            <div className="space-y-2">
              <Label>Head Setting</Label>
              <Input {...register("head_setting")} placeholder="Blast tube / head position" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-emerald-600 flex items-center gap-2">
            <Gauge className="w-5 h-5" /> Final Combustion Results
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>CO2 (%)</Label>
              <Input {...register("combustion_co2")} placeholder="e.g. 10.5" />
            </div>
            <div className="space-y-2">
              <Label>CO (ppm)</Label>
              <Input {...register("combustion_co")} placeholder="e.g. 42" />
            </div>
            <div className="space-y-2">
              <Label>Smoke Number</Label>
              <Input {...register("combustion_smoke")} placeholder="0-9" />
            </div>
            <div className="space-y-2">
              <Label>Efficiency (%)</Label>
              <Input {...register("combustion_efficiency")} placeholder="e.g. 85" />
            </div>
            <div className="space-y-2 sm:col-span-2 md:col-span-4">
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
