import { useGetProperty, useCreateAppliance } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Home, Flame, MapPin, Briefcase, Plus, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";

type ApplianceFormData = {
  manufacturer: string;
  model: string;
  serial_number?: string;
  boiler_type?: string;
  fuel_type?: string;
  installation_date?: string;
};

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading, error } = useGetProperty(id);
  const [showApplianceForm, setShowApplianceForm] = useState(false);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error || !property) return <div className="p-8 text-destructive">Property not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Link href="/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Properties
      </Link>

      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Home className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">{property.address_line1}</h1>
          <p className="text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4" /> {property.city}, {property.postcode}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 border border-border/50 shadow-sm">
          <h3 className="font-bold text-lg border-b border-border/50 pb-2 mb-4">Details</h3>
          <div className="space-y-3 text-sm">
            {property.property_type && (
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{property.property_type}</span></div>
            )}
            {property.address_line2 && (
              <div><span className="text-muted-foreground">Address Line 2:</span> <span className="font-medium">{property.address_line2}</span></div>
            )}
            {property.access_notes && (
              <div><span className="text-muted-foreground">Access:</span> <span className="font-medium">{property.access_notes}</span></div>
            )}
            {property.parking_notes && (
              <div><span className="text-muted-foreground">Parking:</span> <span className="font-medium">{property.parking_notes}</span></div>
            )}
            {property.boiler_location && (
              <div><span className="text-muted-foreground">Boiler Location:</span> <span className="font-medium">{property.boiler_location}</span></div>
            )}
            {property.customer && (
              <div className="pt-3 border-t border-border/50">
                <span className="text-muted-foreground">Customer:</span>{" "}
                <Link href={`/customers/${property.customer_id}`} className="text-primary hover:underline font-medium">
                  {property.customer.first_name} {property.customer.last_name}
                </Link>
              </div>
            )}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-display font-bold flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> Appliances</h2>
              <Button size="sm" variant="secondary" onClick={() => setShowApplianceForm(!showApplianceForm)}>
                {showApplianceForm ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Plus className="w-4 h-4 mr-2"/> Add Appliance</>}
              </Button>
            </div>

            {showApplianceForm && (
              <AddApplianceForm propertyId={property.id} onClose={() => setShowApplianceForm(false)} />
            )}

            {!property.appliances || property.appliances.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Flame className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No appliances at this property.</p>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {property.appliances.map((app) => (
                  <Card key={app.id} className="p-5 border border-border/50 hover:border-orange-500/30 transition-colors">
                    <h4 className="font-bold">{app.manufacturer} {app.model}</h4>
                    <p className="text-sm text-muted-foreground font-mono mt-1">SN: {app.serial_number || "N/A"}</p>
                    {app.boiler_type && <p className="text-sm text-muted-foreground capitalize mt-1">{app.boiler_type} - {app.fuel_type}</p>}
                    {app.next_service_due && (
                      <p className="text-sm mt-2">
                        Next service: <span className={new Date(app.next_service_due) < new Date() ? "text-destructive font-bold" : "text-emerald-600 font-medium"}>
                          {formatDate(app.next_service_due)}
                        </span>
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {property.recent_jobs && property.recent_jobs.length > 0 && (
            <div>
              <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-purple-500" /> Recent Jobs</h2>
              <div className="space-y-3">
                {property.recent_jobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold capitalize">{job.job_type?.replace("_", " ")}</p>
                          <p className="text-sm text-muted-foreground">{job.technician_name || "Unassigned"}</p>
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
    </div>
  );
}

function AddApplianceForm({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateAppliance();
  const { register, handleSubmit } = useForm<ApplianceFormData>();

  const onSubmit = async (data: ApplianceFormData) => {
    await create.mutateAsync({
      data: {
        property_id: propertyId,
        manufacturer: data.manufacturer || undefined,
        model: data.model || undefined,
        serial_number: data.serial_number || undefined,
        boiler_type: data.boiler_type || undefined,
        fuel_type: data.fuel_type || undefined,
        installation_date: data.installation_date || undefined,
      }
    });
    qc.invalidateQueries({ queryKey: [`/api/properties/${propertyId}`] });
    onClose();
  };

  return (
    <Card className="p-6 border-orange-500/20 shadow-lg bg-orange-50/50 mb-4">
      <h3 className="font-bold text-lg mb-4">Add New Appliance</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="Manufacturer" {...register("manufacturer")} />
        <Input placeholder="Model" {...register("model")} />
        <Input placeholder="Serial Number" {...register("serial_number")} />
        <select className="border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("boiler_type")}>
          <option value="">Boiler Type...</option>
          <option value="combi">Combi</option>
          <option value="system">System</option>
          <option value="regular">Regular</option>
          <option value="back_boiler">Back Boiler</option>
          <option value="other">Other</option>
        </select>
        <select className="border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("fuel_type")}>
          <option value="">Fuel Type...</option>
          <option value="oil">Oil</option>
          <option value="gas">Gas</option>
          <option value="lpg">LPG</option>
          <option value="electric">Electric</option>
          <option value="solid_fuel">Solid Fuel</option>
          <option value="other">Other</option>
        </select>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Installation Date</label>
          <Input type="date" {...register("installation_date")} />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Adding..." : "Add Appliance"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
