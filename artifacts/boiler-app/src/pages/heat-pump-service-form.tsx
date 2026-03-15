import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { useCreateHeatPumpServiceRecord, useGetHeatPumpServiceRecordByJob, useUpdateHeatPumpServiceRecord, useGetJob } from "@workspace/api-client-react";
import type { CreateHeatPumpServiceRecordBody } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileDown, Thermometer, Zap, Wind, ClipboardCheck, UserCheck, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { generateHeatPumpServicePdf } from "@/lib/pdf-generator";

interface HeatPumpServiceFormData {
  refrigerant_type: string;
  refrigerant_pressure_high: string;
  refrigerant_pressure_low: string;
  flow_temp: string;
  return_temp: string;
  delta_t: string;
  cop_reading: string;
  compressor_amps: string;
  outdoor_unit_condition: string;
  indoor_unit_condition: string;
  controls_checked: boolean;
  filter_condition: string;
  dhw_cylinder_checked: boolean;
  dhw_cylinder_temp: string;
  defects_found: boolean;
  defects_details: string;
  advisories: string;
  appliance_safe: boolean;
  follow_up_required: boolean;
  follow_up_notes: string;
  customer_name_signed: string;
  additional_notes: string;
}

export default function HeatPumpServiceForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRecord, isLoading: isLoadingExisting } = useGetHeatPumpServiceRecordByJob(jobId!);
  const { data: job } = useGetJob(jobId!);

  const createMutation = useCreateHeatPumpServiceRecord();
  const updateMutation = useUpdateHeatPumpServiceRecord();

  const { register, handleSubmit, getValues, reset } = useForm<HeatPumpServiceFormData>({
    defaultValues: { appliance_safe: true },
  });

  useEffect(() => {
    if (existingRecord) {
      reset({
        refrigerant_type: existingRecord.refrigerant_type || "",
        refrigerant_pressure_high: existingRecord.refrigerant_pressure_high || "",
        refrigerant_pressure_low: existingRecord.refrigerant_pressure_low || "",
        flow_temp: existingRecord.flow_temp || "",
        return_temp: existingRecord.return_temp || "",
        delta_t: existingRecord.delta_t || "",
        cop_reading: existingRecord.cop_reading || "",
        compressor_amps: existingRecord.compressor_amps || "",
        outdoor_unit_condition: existingRecord.outdoor_unit_condition || "",
        indoor_unit_condition: existingRecord.indoor_unit_condition || "",
        controls_checked: existingRecord.controls_checked ?? false,
        filter_condition: existingRecord.filter_condition || "",
        dhw_cylinder_checked: existingRecord.dhw_cylinder_checked ?? false,
        dhw_cylinder_temp: existingRecord.dhw_cylinder_temp || "",
        defects_found: existingRecord.defects_found ?? false,
        defects_details: existingRecord.defects_details || "",
        advisories: existingRecord.advisories || "",
        appliance_safe: existingRecord.appliance_safe ?? true,
        follow_up_required: existingRecord.follow_up_required ?? false,
        follow_up_notes: existingRecord.follow_up_notes || "",
        customer_name_signed: existingRecord.customer_name_signed || "",
        additional_notes: existingRecord.additional_notes || "",
      });
    }
  }, [existingRecord, reset]);

  const onSubmit = async (data: HeatPumpServiceFormData) => {
    if (!user?.id) return;

    const payload: CreateHeatPumpServiceRecordBody = {
      job_id: jobId!,
      technician_id: user.id,
      refrigerant_type: data.refrigerant_type || undefined,
      refrigerant_pressure_high: data.refrigerant_pressure_high || undefined,
      refrigerant_pressure_low: data.refrigerant_pressure_low || undefined,
      flow_temp: data.flow_temp || undefined,
      return_temp: data.return_temp || undefined,
      delta_t: data.delta_t || undefined,
      cop_reading: data.cop_reading || undefined,
      compressor_amps: data.compressor_amps || undefined,
      outdoor_unit_condition: data.outdoor_unit_condition || undefined,
      indoor_unit_condition: data.indoor_unit_condition || undefined,
      controls_checked: data.controls_checked,
      filter_condition: data.filter_condition || undefined,
      dhw_cylinder_checked: data.dhw_cylinder_checked,
      dhw_cylinder_temp: data.dhw_cylinder_temp || undefined,
      defects_found: data.defects_found,
      defects_details: data.defects_details || undefined,
      advisories: data.advisories || undefined,
      appliance_safe: data.appliance_safe,
      follow_up_required: data.follow_up_required,
      follow_up_notes: data.follow_up_notes || undefined,
      customer_name_signed: data.customer_name_signed || undefined,
      additional_notes: data.additional_notes || undefined,
    };

    try {
      if (existingRecord) {
        const { job_id: _jid, technician_id: _tid, ...updatePayload } = payload;
        await updateMutation.mutateAsync({ id: existingRecord.id, data: updatePayload });
        toast({ title: "Updated", description: "Heat pump service record updated successfully" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Heat pump service record created successfully" });
      }
      setLocation(`/jobs/${jobId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExportPdf = () => {
    const vals = getValues();
    generateHeatPumpServicePdf({
      jobId: jobId!,
      customerName: job?.customer ? `${job.customer.first_name} ${job.customer.last_name}` : "N/A",
      propertyAddress: job?.property?.address_line1 || "N/A",
      applianceName: job?.appliance ? `${job.appliance.manufacturer || ""} ${job.appliance.model || ""}`.trim() || "N/A" : "N/A",
      technicianName: job?.technician?.full_name || user?.email || "N/A",
      scheduledDate: job?.scheduled_date ? new Date(String(job.scheduled_date).slice(0, 10)).toLocaleDateString() : new Date().toLocaleDateString(),
      record: vals,
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

        <Card className="p-6 shadow-sm border-cyan-200 bg-cyan-50/30">
          <h2 className="font-bold text-lg mb-4 text-cyan-700 flex items-center gap-2"><Wind className="w-5 h-5"/> Refrigerant Data</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Refrigerant Type</Label>
              <Input {...register("refrigerant_type")} placeholder="e.g. R32, R410A" />
            </div>
            <div className="space-y-2">
              <Label>High Pressure (bar)</Label>
              <Input {...register("refrigerant_pressure_high")} placeholder="e.g. 28.5" />
            </div>
            <div className="space-y-2">
              <Label>Low Pressure (bar)</Label>
              <Input {...register("refrigerant_pressure_low")} placeholder="e.g. 8.2" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><Thermometer className="w-5 h-5"/> Temperature & Performance</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Flow Temperature (°C)</Label>
              <Input {...register("flow_temp")} placeholder="e.g. 45" />
            </div>
            <div className="space-y-2">
              <Label>Return Temperature (°C)</Label>
              <Input {...register("return_temp")} placeholder="e.g. 40" />
            </div>
            <div className="space-y-2">
              <Label>Delta-T (°C)</Label>
              <Input {...register("delta_t")} placeholder="e.g. 5" />
            </div>
            <div className="space-y-2">
              <Label>COP Reading</Label>
              <Input {...register("cop_reading")} placeholder="e.g. 3.2" />
            </div>
            <div className="space-y-2">
              <Label>Compressor Amps (A)</Label>
              <Input {...register("compressor_amps")} placeholder="e.g. 8.4" />
            </div>
          </div>
        </Card>

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
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-cyan-50 cursor-pointer transition-colors text-sm">
                <input type="checkbox" {...register(field)} className="w-4 h-4 accent-cyan-600 rounded" />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Filter Condition</Label>
              <Input {...register("filter_condition")} placeholder="e.g. Clean, Dirty - Cleaned, Replaced" />
            </div>
            <div className="space-y-2">
              <Label>DHW Cylinder Temperature (°C)</Label>
              <Input {...register("dhw_cylinder_temp")} placeholder="e.g. 55" />
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
          <h2 className="font-bold text-lg mb-4 text-primary flex items-center gap-2"><UserCheck className="w-5 h-5"/> Sign-off</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 p-3 border rounded-xl hover:bg-emerald-50 cursor-pointer transition-colors text-sm">
              <input type="checkbox" {...register("appliance_safe")} className="w-5 h-5 accent-emerald-600 rounded" />
              <span className="font-medium">Appliance Safe to Use</span>
            </label>
            <div className="space-y-2">
              <Label>Customer Name (printed)</Label>
              <Input {...register("customer_name_signed")} placeholder="Customer name..." />
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
          <div className="max-w-4xl mx-auto flex gap-3">
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
      </form>
    </div>
  );
}
