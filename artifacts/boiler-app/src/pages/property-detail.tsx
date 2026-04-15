import { useGetProperty, useCreateAppliance, useUpdateProperty } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Home, Flame, MapPin, Briefcase, Plus, X, Edit, Check } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useState, useEffect, lazy, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLookupOptions } from "@/hooks/use-lookup-options";
import { usePlanFeatures } from "@/hooks/use-plan-features";

const PropertyLocationLookup = lazy(() => import("@/components/property-location-lookup").then(m => ({ default: m.PropertyLocationLookup })));
const PostcodeAddressFinder = lazy(() => import("@/components/postcode-address-finder").then(m => ({ default: m.PostcodeAddressFinder })));
const PropertyMapPreview = lazy(() => import("@/components/property-map-preview"));

type ApplianceFormData = {
  manufacturer: string;
  model: string;
  boiler_type?: string;
  fuel_type?: string;
  installation_date?: string;
};

type PropertyEditData = {
  address_line1: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode: string;
  property_type?: string;
  occupancy_type?: string;
  access_notes?: string;
  parking_notes?: string;
  boiler_location?: string;
  flue_location?: string;
  tank_location?: string;
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading, error } = useGetProperty(id);
  const [showApplianceForm, setShowApplianceForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const { hasFeature } = usePlanFeatures();

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error || !property) return <div className="p-8 text-destructive">Property not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Link href="/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Properties
      </Link>

      <div className="flex justify-between items-start">
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
        <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
          {editing ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Edit className="w-4 h-4 mr-2"/> Edit</>}
        </Button>
      </div>

      {editing ? (
        <EditPropertyForm property={property} onClose={() => setEditing(false)} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 border border-border/50 shadow-sm">
            <h3 className="font-bold text-lg border-b border-border/50 pb-2 mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              {property.property_type && (
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{property.property_type}</span></div>
              )}
              {property.occupancy_type && (
                <div><span className="text-muted-foreground">Occupancy:</span> <span className="font-medium capitalize">{property.occupancy_type.replace('_', ' ')}</span></div>
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
              {property.flue_location && (
                <div><span className="text-muted-foreground">Flue Location:</span> <span className="font-medium">{property.flue_location}</span></div>
              )}
              {property.tank_location && (
                <div><span className="text-muted-foreground">Tank Location:</span> <span className="font-medium">{property.tank_location}</span></div>
              )}
              {property.customer && (
                <div className="pt-3 border-t border-border/50">
                  <span className="text-muted-foreground">Customer:</span>{" "}
                  <Link href={`/customers/${property.customer_id}`} className="text-primary hover:underline font-medium">
                    {property.customer.first_name} {property.customer.last_name}
                  </Link>
                </div>
              )}
              {hasFeature("geo_mapping") && property.latitude != null && property.longitude != null && (
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <button
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={() => {
                        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        if (isIos) {
                          window.open(`maps://maps.apple.com/?daddr=${property.latitude},${property.longitude}`, "_blank");
                        } else {
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`, "_blank");
                        }
                      }}
                    >
                      <MapPin className="w-3 h-3" /> Navigate
                    </button>
                  </div>
                  <Suspense fallback={<div className="h-[150px] bg-slate-100 rounded animate-pulse" />}>
                    <PropertyMapPreview latitude={property.latitude} longitude={property.longitude} />
                  </Suspense>
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
                    <Link key={app.id} href={`/appliances/${app.id}`}>
                      <Card className="p-5 border border-border/50 hover:border-orange-500/30 transition-colors cursor-pointer">
                        <h4 className="font-bold">{app.manufacturer} {app.model}</h4>
                        {app.boiler_type && <p className="text-sm text-muted-foreground capitalize mt-1">{app.boiler_type} - {app.fuel_type}</p>}
                        {app.next_service_due && (
                          <p className="text-sm mt-2">
                            Next service: <span className={new Date(app.next_service_due) < new Date() ? "text-destructive font-bold" : "text-emerald-600 font-medium"}>
                              {formatDate(app.next_service_due)}
                            </span>
                          </p>
                        )}
                      </Card>
                    </Link>
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
      )}
    </div>
  );
}

function EditPropertyForm({ property, onClose }: { property: { id: string; address_line1?: string | null; address_line2?: string | null; city?: string | null; county?: string | null; postcode?: string | null; property_type?: string | null; occupancy_type?: string | null; access_notes?: string | null; parking_notes?: string | null; boiler_location?: string | null; flue_location?: string | null; tank_location?: string | null; notes?: string | null; latitude?: number | null; longitude?: number | null }; onClose: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateProperty();
  const { toast } = useToast();
  const { register, handleSubmit, reset, watch, setValue } = useForm<PropertyEditData>();
  const { data: propertyTypes } = useLookupOptions("property_type");
  const { data: occupancyTypes } = useLookupOptions("occupancy_type");
  const { hasFeature } = usePlanFeatures();

  const watchedLat = watch("latitude");
  const watchedLng = watch("longitude");

  useEffect(() => {
    reset({
      address_line1: property.address_line1 || "",
      address_line2: property.address_line2 || "",
      city: property.city || "",
      county: property.county || "",
      postcode: property.postcode || "",
      property_type: property.property_type || "",
      occupancy_type: property.occupancy_type || "",
      access_notes: property.access_notes || "",
      parking_notes: property.parking_notes || "",
      boiler_location: property.boiler_location || "",
      flue_location: property.flue_location || "",
      tank_location: property.tank_location || "",
      notes: property.notes || "",
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null,
    });
  }, [property, reset]);

  const addressForLookup = [
    watch("address_line1"),
    watch("address_line2"),
    watch("city"),
    watch("county"),
    watch("postcode"),
  ].filter(Boolean).join(", ");

  const onSubmit = async (data: PropertyEditData) => {
    try {
      await update.mutateAsync({
        id: property.id,
        data: {
          address_line1: data.address_line1,
          postcode: data.postcode,
          address_line2: data.address_line2 || undefined,
          city: data.city || undefined,
          county: data.county || undefined,
          property_type: data.property_type || undefined,
          occupancy_type: data.occupancy_type || undefined,
          access_notes: data.access_notes || undefined,
          parking_notes: data.parking_notes || undefined,
          boiler_location: data.boiler_location || undefined,
          flue_location: data.flue_location || undefined,
          tank_location: data.tank_location || undefined,
          notes: data.notes || undefined,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/properties/${property.id}`] });
      toast({ title: "Updated", description: "Property updated successfully" });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-primary/20 shadow-lg">
      <h3 className="font-bold text-lg mb-4">Edit Property</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {hasFeature("geo_mapping") && (
          <Suspense fallback={null}>
            <PostcodeAddressFinder
              initialPostcode={property.postcode || ""}
              onAddressSelected={(addr) => {
                setValue("address_line1", addr.address_line1);
                setValue("address_line2", addr.address_line2);
                setValue("city", addr.city);
                setValue("county", addr.county);
                setValue("postcode", addr.postcode);
                if (addr.latitude && addr.longitude) {
                  setValue("latitude", addr.latitude);
                  setValue("longitude", addr.longitude);
                }
              }}
            />
          </Suspense>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Address Line 1 *</Label>
            <Input {...register("address_line1")} required />
          </div>
          <div className="space-y-2">
            <Label>Address Line 2</Label>
            <Input {...register("address_line2")} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input {...register("city")} />
          </div>
          <div className="space-y-2">
            <Label>County</Label>
            <Input {...register("county")} />
          </div>
          <div className="space-y-2">
            <Label>Postcode *</Label>
            <Input {...register("postcode")} required />
          </div>
          <div className="space-y-2">
            <Label>Property Type</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("property_type")}>
              <option value="">Select...</option>
              {(propertyTypes || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Occupancy Type</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("occupancy_type")}>
              <option value="">Select...</option>
              {(occupancyTypes || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Access Notes</Label>
            <Input {...register("access_notes")} />
          </div>
          <div className="space-y-2">
            <Label>Parking Notes</Label>
            <Input {...register("parking_notes")} />
          </div>
          <div className="space-y-2">
            <Label>Boiler Location</Label>
            <Input {...register("boiler_location")} />
          </div>
          <div className="space-y-2">
            <Label>Flue Location</Label>
            <Input {...register("flue_location")} />
          </div>
          <div className="space-y-2">
            <Label>Tank Location</Label>
            <Input {...register("tank_location")} />
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

function AddApplianceForm({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateAppliance();
  const { toast } = useToast();
  const { register, handleSubmit } = useForm<ApplianceFormData>();
  const { data: boilerTypes } = useLookupOptions("boiler_type");
  const { data: fuelTypes } = useLookupOptions("fuel_type");

  const onSubmit = async (data: ApplianceFormData) => {
    try {
      await create.mutateAsync({
        data: {
          property_id: propertyId,
          manufacturer: data.manufacturer || undefined,
          model: data.model || undefined,
          boiler_type: data.boiler_type || undefined,
          fuel_type: data.fuel_type || undefined,
          installation_date: data.installation_date || undefined,
        }
      });
      qc.invalidateQueries({ queryKey: [`/api/properties/${propertyId}`] });
      toast({ title: "Added", description: "Appliance added successfully" });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-orange-500/20 shadow-lg bg-orange-50/50 mb-4">
      <h3 className="font-bold text-lg mb-4">Add New Appliance</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="Manufacturer" {...register("manufacturer")} />
        <Input placeholder="Model" {...register("model")} />
        <select className="border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("boiler_type")}>
          <option value="">Boiler Type...</option>
          {(boilerTypes || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select className="border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("fuel_type")}>
          <option value="">Fuel Type...</option>
          {(fuelTypes || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
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
