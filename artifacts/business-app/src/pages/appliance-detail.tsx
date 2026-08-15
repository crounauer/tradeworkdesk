import { useGetAppliance, useUpdateAppliance, useDeleteAppliance } from "@workspace/api-client-react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Flame, Briefcase, Edit, X, Check, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLookupOptions } from "@/hooks/use-lookup-options";

const APPLIANCE_BOILER_TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "combi", label: "Combi" },
  { value: "system", label: "System" },
  { value: "back_boiler", label: "Back Boiler" },
  { value: "other", label: "Other" },
];

const APPLIANCE_FUEL_TYPE_OPTIONS = [
  { value: "gas", label: "Gas" },
  { value: "oil", label: "Oil" },
  { value: "lpg", label: "LPG" },
  { value: "electric", label: "Electric" },
  { value: "solid_fuel", label: "Solid Fuel" },
  { value: "other", label: "Other" },
];

const APPLIANCE_NOZZLE_SIZE_OPTIONS = [
  "0.40 60 EH", "0.40 80 EH", "0.45 60 EH", "0.45 80 EH", "0.50 60 EH", "0.50 80 EH", "0.55 60 EH", "0.55 80 EH",
  "0.60 60 EH", "0.60 80 EH", "0.65 60 EH", "0.65 80 EH", "0.75 60 EH", "0.75 80 EH", "0.85 60 EH", "0.85 80 EH",
  "1.00 60 EH", "1.00 80 EH", "1.10 60 EH", "1.10 80 EH",
  "0.40 60 ES", "0.40 80 ES", "0.45 60 ES", "0.45 80 ES", "0.50 60 ES", "0.50 80 ES", "0.55 60 ES", "0.55 80 ES",
  "0.60 60 ES", "0.60 80 ES", "0.65 60 ES", "0.65 80 ES", "0.75 60 ES", "0.75 80 ES", "0.85 60 ES", "0.85 80 ES",
  "1.00 60 ES", "1.00 80 ES", "1.10 60 ES", "1.10 80 ES",
  "0.30 60 H", "0.30 80 H", "0.35 60 H", "0.35 80 H", "0.40 60 H", "0.40 80 H", "0.45 60 H", "0.45 80 H",
  "0.50 45 H", "0.50 60 H", "0.50 80 H", "0.55 45 H", "0.55 60 H", "0.55 80 H", "0.60 45 H", "0.60 60 H",
  "0.60 80 H", "0.65 45 H", "0.65 60 H", "0.65 80 H", "0.75 45 H", "0.75 60 H", "0.75 80 H", "0.85 45 H",
  "0.85 60 H", "0.85 80 H", "1.00 45 H", "1.00 60 H", "1.00 80 H", "1.10 45 H", "1.10 60 H", "1.10 80 H",
  "1.20 45 H", "1.20 60 H", "1.20 80 H", "1.25 45 H", "1.25 60 H", "1.25 80 H", "1.35 45 H", "1.35 60 H",
  "1.35 80 H", "1.50 45 H", "1.50 60 H", "1.50 80 H", "1.65 45 H", "1.65 60 H", "1.65 80 H", "1.75 45 H",
  "1.75 60 H", "1.75 80 H", "2.00 45 H", "2.00 60 H", "2.00 80 H",
  "0.20 60 S", "0.25 60 S", "0.30 60 S", "0.30 80 S", "0.35 60 S", "0.35 80 S", "0.40 45 S", "0.40 60 S",
  "0.40 80 S", "0.45 45 S", "0.45 60 S", "0.45 80 S", "0.50 30 S", "0.50 45 S", "0.50 60 S", "0.50 80 S",
  "0.55 30 S", "0.55 45 S", "0.55 60 S", "0.55 80 S", "0.60 30 S", "0.60 45 S", "0.60 60 S", "0.60 80 S",
  "0.65 30 S", "0.65 45 S", "0.65 60 S", "0.65 80 S", "0.75 30 S", "0.75 45 S", "0.75 60 S", "0.75 80 S",
  "0.85 30 S", "0.85 45 S", "0.85 60 S", "0.85 80 S", "1.00 30 S", "1.00 45 S", "1.00 60 S", "1.00 80 S",
  "1.10 30 S", "1.10 45 S", "1.10 60 S", "1.10 80 S", "1.20 45 S", "1.20 60 S", "1.20 80 S", "1.25 30 S",
  "1.25 45 S", "1.25 60 S", "1.25 80 S", "1.35 30 S", "1.35 45 S", "1.35 60 S", "1.35 80 S", "1.50 30 S",
  "1.50 45 S", "1.50 60 S", "1.50 80 S", "1.65 30 S", "1.65 45 S", "1.65 60 S", "1.65 80 S", "1.75 30 S",
  "1.75 45 S", "1.75 60 S", "1.75 80 S", "2.00 30 S", "2.00 45 S", "2.00 60 S", "2.00 80 S",
  "Custom..."
];

type ApplianceEditData = {
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  boiler_type?: string;
  fuel_type?: string;
  system_type?: string;
  installation_date?: string;
  warranty_expiry?: string;
  burner_make?: string;
  burner_model?: string;
  nozzle_size?: string;
  pump_pressure?: string;
  notes?: string;
};

export default function ApplianceDetail() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const { data: appliance, isLoading, error } = useGetAppliance(id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteAppliance = useDeleteAppliance();
  const [editing, setEditing] = useState(() => new URLSearchParams(search).get("edit") === "1");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(search).get("edit") === "1") setEditing(true);
  }, [search]);

  const handleDelete = async () => {
    if (!appliance) return;

    try {
      await deleteAppliance.mutateAsync({ id: appliance.id });
      qc.invalidateQueries({ queryKey: ["/api/appliances"] });
      if (appliance.property_id) {
        qc.invalidateQueries({ queryKey: [`/api/properties/${appliance.property_id}`] });
      }
      toast({ title: "Appliance deleted", description: "The appliance has been removed." });
      navigate(appliance.property_id ? `/properties/${appliance.property_id}` : "/appliances");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete appliance";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error || !appliance) return <div className="p-8 text-destructive">Appliance not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Link href="/appliances" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Appliances
      </Link>

      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
            <Flame className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">{appliance.manufacturer} {appliance.model}</h1>
            {appliance.serial_number && (
              <p className="text-muted-foreground font-mono mt-1">SN: {appliance.serial_number}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Edit className="w-4 h-4 mr-2"/> Edit</>}
          </Button>
          {!editing && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive font-medium">Are you sure?</span>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteAppliance.isPending}>
                  {deleteAppliance.isPending ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )
          )}
        </div>
      </div>

      {editing ? (
        <EditApplianceForm appliance={appliance} onClose={() => setEditing(false)} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 border border-border/50 shadow-sm">
            <h3 className="font-bold text-lg border-b border-border/50 pb-2 mb-4">Specifications</h3>
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{appliance.boiler_type || "N/A"}</span></div>
              <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium capitalize">{appliance.fuel_type || "N/A"}</span></div>
              {appliance.system_type && <div><span className="text-muted-foreground">System:</span> <span className="font-medium capitalize">{appliance.system_type.replace('_', ' ')}</span></div>}
              {appliance.burner_make && <div><span className="text-muted-foreground">Burner:</span> <span className="font-medium">{appliance.burner_make} {appliance.burner_model}</span></div>}
              {appliance.nozzle_size && <div><span className="text-muted-foreground">Nozzle:</span> <span className="font-medium">{appliance.nozzle_size}</span></div>}
              {appliance.pump_pressure && <div><span className="text-muted-foreground">Pump Pressure:</span> <span className="font-medium">{appliance.pump_pressure}</span></div>}
              {appliance.installation_date && <div><span className="text-muted-foreground">Installed:</span> <span className="font-medium">{formatDate(appliance.installation_date)}</span></div>}
              {appliance.warranty_expiry && <div><span className="text-muted-foreground">Warranty Expires:</span> <span className="font-medium">{formatDate(appliance.warranty_expiry)}</span></div>}
              <div className="pt-3 border-t border-border/50">
                <span className="text-muted-foreground">Last Service:</span> <span className="font-medium">{formatDate(appliance.last_service_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Next Service:</span>{" "}
                <span className={`font-bold ${appliance.next_service_due && new Date(appliance.next_service_due) < new Date() ? "text-destructive" : "text-emerald-600"}`}>
                  {formatDate(appliance.next_service_due)}
                </span>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            {appliance.property && (
              <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
                <h3 className="font-bold mb-2">Installed At</h3>
                <Link href={`/properties/${appliance.property_id}`} className="text-primary hover:underline font-medium">
                  {appliance.property.address_line1}, {appliance.property.postcode}
                </Link>
              </Card>
            )}

            {appliance.recent_jobs && appliance.recent_jobs.length > 0 && (
              <div>
                <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-purple-500" /> Service History</h2>
                <div className="space-y-3">
                  {[...appliance.recent_jobs]
                    .sort((a, b) => {
                      const aTime = a.scheduled_date ? Date.parse(`${a.scheduled_date}T00:00:00`) : 0;
                      const bTime = b.scheduled_date ? Date.parse(`${b.scheduled_date}T00:00:00`) : 0;
                      return bTime - aTime;
                    })
                    .map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}>
                      <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold capitalize">{job.job_type?.replace("_", " ")}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(job.scheduled_date)} - {job.technician_name || "Unassigned"}</p>
                          </div>
                          <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 capitalize">
                            {job.status?.replace("_", " ")}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditApplianceForm({ appliance, onClose }: { appliance: { id: string; manufacturer?: string | null; model?: string | null; serial_number?: string | null; boiler_type?: string | null; fuel_type?: string | null; system_type?: string | null; installation_date?: string | null; warranty_expiry?: string | null; burner_make?: string | null; burner_model?: string | null; nozzle_size?: string | null; pump_pressure?: string | null; notes?: string | null }; onClose: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateAppliance();
  const { toast } = useToast();
  const { register, handleSubmit, reset, watch, setValue } = useForm<ApplianceEditData>();
  const [customNozzle, setCustomNozzle] = useState("");
  const nozzleValue = watch("nozzle_size") || "";

  useEffect(() => {
    if (!nozzleValue || APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(nozzleValue) || nozzleValue === "Custom...") {
      return;
    }
    setCustomNozzle(nozzleValue);
  }, [nozzleValue]);

  useEffect(() => {
    reset({
      manufacturer: appliance.manufacturer || "",
      model: appliance.model || "",
      serial_number: appliance.serial_number || "",
      boiler_type: appliance.boiler_type || "",
      fuel_type: appliance.fuel_type || "",
      system_type: appliance.system_type || "",
      installation_date: appliance.installation_date || "",
      warranty_expiry: appliance.warranty_expiry || "",
      burner_make: appliance.burner_make || "",
      burner_model: appliance.burner_model || "",
      nozzle_size: appliance.nozzle_size || "",
      pump_pressure: appliance.pump_pressure || "",
      notes: appliance.notes || "",
    });
  }, [appliance, reset]);

  const onSubmit = async (data: ApplianceEditData) => {
    try {
      await update.mutateAsync({
        id: appliance.id,
        data: {
          manufacturer: data.manufacturer || undefined,
          model: data.model || undefined,
          serial_number: data.serial_number || undefined,
          boiler_type: data.boiler_type || undefined,
          fuel_type: data.fuel_type || undefined,
          system_type: data.system_type || undefined,
          installation_date: data.installation_date || undefined,
          warranty_expiry: data.warranty_expiry || undefined,
          burner_make: data.burner_make || undefined,
          burner_model: data.burner_model || undefined,
          nozzle_size: data.nozzle_size || undefined,
          pump_pressure: data.pump_pressure || undefined,
          notes: data.notes || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/appliances/${appliance.id}`] });
      toast({ title: "Updated", description: "Appliance updated successfully" });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-primary/20 shadow-lg">
      <h3 className="font-bold text-lg mb-4">Edit Appliance</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Manufacturer</Label>
            <Input {...register("manufacturer")} />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input {...register("model")} />
          </div>
          <div className="space-y-2">
            <Label>Serial Number</Label>
            <Input {...register("serial_number")} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Boiler Type</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("boiler_type")}>
              <option value="">Select...</option>
              {APPLIANCE_BOILER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Fuel Type</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("fuel_type")}>
              <option value="">Select...</option>
              {APPLIANCE_FUEL_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>System Type</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("system_type")}>
              <option value="">Select...</option>
              <option value="open_vented">Open Vented</option>
              <option value="sealed">Sealed</option>
              <option value="gravity_fed">Gravity Fed</option>
              <option value="pressurised">Pressurised</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Installation Date</Label>
            <Input type="date" {...register("installation_date")} />
          </div>
          <div className="space-y-2">
            <Label>Warranty Expiry</Label>
            <Input type="date" {...register("warranty_expiry")} />
          </div>
          <div className="space-y-2">
            <Label>Burner Make</Label>
            <Input {...register("burner_make")} />
          </div>
          <div className="space-y-2">
            <Label>Burner Model</Label>
            <Input {...register("burner_model")} />
          </div>
          <div className="space-y-2">
            <Label>Nozzle Size</Label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              value={nozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(nozzleValue) && nozzleValue !== "Custom..." ? "Custom..." : (nozzleValue || "")}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === "Custom...") {
                  setCustomNozzle(nozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(nozzleValue) && nozzleValue !== "Custom..." ? nozzleValue : "");
                  setValue("nozzle_size", "");
                  return;
                }
                setCustomNozzle("");
                setValue("nozzle_size", nextValue);
              }}
            >
              <option value="">Select...</option>
              {APPLIANCE_NOZZLE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {(nozzleValue === "" || (nozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(nozzleValue) && nozzleValue !== "Custom...")) && (
              <Input
                value={customNozzle}
                onChange={(event) => {
                  const nextValue = event.target.value.trim();
                  setCustomNozzle(nextValue);
                  setValue("nozzle_size", nextValue);
                }}
                placeholder="Enter custom nozzle size"
                className="mt-2"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Pump Pressure</Label>
            <Input {...register("pump_pressure")} placeholder="e.g. 10 bar" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...register("notes")} />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={update.isPending}>
            <Check className="w-4 h-4 mr-2" /> {update.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
