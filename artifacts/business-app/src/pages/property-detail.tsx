import { useGetProperty, useUpdateProperty, useDeleteProperty, useCreateAppliance, type UpdatePropertyBody } from "@workspace/api-client-react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Home, MapPin, Briefcase, X, Edit, Check, Trash2, Flame, Plus } from "lucide-react";
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

type ApplianceCreateData = {
  manufacturer: string;
  model: string;
  serial_number: string;
  boiler_type: string;
  fuel_type: string;
  system_type: string;
  installation_date: string;
  next_service_due: string;
  warranty_expiry: string;
  nozzle_size: string;
  notes: string;
};

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

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading, error } = useGetProperty(id);
  const search = useSearch();
  const [editing, setEditing] = useState(() => new URLSearchParams(search).get("edit") === "1");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fixingLocation, setFixingLocation] = useState(false);
  const [showAddAppliance, setShowAddAppliance] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(search).get("edit") === "1") setEditing(true);
  }, [search]);
  const { hasFeature } = usePlanFeatures();
  const deleteProperty = useDeleteProperty();
  const createAppliance = useCreateAppliance();
  const updateProperty = useUpdateProperty();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { register: registerAppliance, handleSubmit: handleSubmitAppliance, reset: resetAppliance, watch: watchAppliance, setValue: setApplianceValue } = useForm<ApplianceCreateData>({
    defaultValues: {
      manufacturer: "",
      model: "",
      serial_number: "",
      boiler_type: "regular",
      fuel_type: "gas",
      system_type: "",
      installation_date: "",
      next_service_due: "",
      warranty_expiry: "",
      nozzle_size: "",
      notes: "",
    },
  });
  const [customApplianceNozzle, setCustomApplianceNozzle] = useState("");
  const applianceNozzleValue = watchAppliance("nozzle_size") || "";

  useEffect(() => {
    if (applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue)) {
      setCustomApplianceNozzle(applianceNozzleValue);
    }
  }, [applianceNozzleValue]);

  // Lazy geocode: if this property has no coords, trigger a background PATCH
  // which the API will use to geocode and persist the coordinates.
  useEffect(() => {
    if (property && property.latitude == null && id) {
      updateProperty.mutate(
        { id, data: {} },
        { onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/properties/${id}`] }) }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  const handleDelete = async () => {
    try {
      await deleteProperty.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({ title: "Deleted", description: "Property has been removed" });
      navigate("/properties");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete property";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setConfirmDelete(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error || !property) return <div className="p-8 text-destructive">Property not found</div>;

  const appliances = property.appliances || [];

  const onAddAppliance = async (data: ApplianceCreateData) => {
    try {
      await createAppliance.mutateAsync({
        data: {
          property_id: id,
          manufacturer: data.manufacturer.trim() || undefined,
          model: data.model.trim() || undefined,
          serial_number: data.serial_number.trim() || undefined,
          boiler_type: data.boiler_type || undefined,
          fuel_type: data.fuel_type || undefined,
          system_type: data.system_type || undefined,
          installation_date: data.installation_date || undefined,
          next_service_due: data.next_service_due || undefined,
          warranty_expiry: data.warranty_expiry || undefined,
          nozzle_size: data.nozzle_size || undefined,
          notes: data.notes.trim() || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/properties/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/appliances"] });
      setShowAddAppliance(false);
      resetAppliance();
      toast({ title: "Appliance added", description: "Appliance has been added to this property." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add appliance";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Edit className="w-4 h-4 mr-2"/> Edit</>}
          </Button>
          {!editing && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive font-medium">Are you sure?</span>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteProperty.isPending}>
                  {deleteProperty.isPending ? "Deleting..." : "Yes, Delete"}
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
        <EditPropertyForm property={property} onClose={() => setEditing(false)} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 border border-border/50 shadow-sm">
            <h3 className="font-bold text-lg border-b border-border/50 pb-2 mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Address:</span>
                <div className="font-medium mt-1">
                  <div>{property.address_line1}</div>
                  {property.address_line2 && <div>{property.address_line2}</div>}
                  {property.city && <div>{property.city}</div>}
                  {property.county && <div>{property.county}</div>}
                  {property.postcode && <div>{property.postcode}</div>}
                </div>
              </div>
              {property.property_type && (
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{property.property_type}</span></div>
              )}
              {property.occupancy_type && (
                <div><span className="text-muted-foreground">Occupancy:</span> <span className="font-medium capitalize">{property.occupancy_type.replace('_', ' ')}</span></div>
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
              {property.latitude != null && property.longitude != null && (
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Coordinates:</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        onClick={() => setFixingLocation((v) => !v)}
                      >
                        <Edit className="w-3 h-3" /> Fix location
                      </button>
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
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{property.latitude.toFixed(6)}, {property.longitude.toFixed(6)}</p>
                  {fixingLocation ? (
                    <Suspense fallback={<div className="h-[220px] bg-slate-100 rounded animate-pulse" />}>
                      <PropertyLocationLookup
                        address={[property.address_line1, property.address_line2, property.city, property.county, property.postcode].filter(Boolean).join(", ")}
                        latitude={property.latitude}
                        longitude={property.longitude}
                        onLocationFound={async (lat, lng) => {
                          // latitude/longitude exist in the API schema but not in the generated
                          // UpdatePropertyBody type yet — cast to bypass until client is regenerated
                          await updateProperty.mutateAsync({ id, data: { latitude: lat, longitude: lng } as unknown as UpdatePropertyBody });
                          qc.invalidateQueries({ queryKey: [`/api/properties/${id}`] });
                          setFixingLocation(false);
                          toast({ title: "Location updated" });
                        }}
                        onClearLocation={() => setFixingLocation(false)}
                      />
                    </Suspense>
                  ) : (
                    <Suspense fallback={<div className="h-[150px] bg-slate-100 rounded animate-pulse" />}>
                      <PropertyMapPreview key={`${property.latitude}-${property.longitude}`} latitude={property.latitude} longitude={property.longitude} />
                    </Suspense>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" /> Appliances
                </h2>
                <Button size="sm" variant="secondary" onClick={() => setShowAddAppliance((v) => !v)}>
                  {showAddAppliance ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> Add Appliance</>}
                </Button>
              </div>

              {showAddAppliance && (
                <Card className="p-5 border border-border/50 shadow-sm mb-4">
                  <form onSubmit={handleSubmitAppliance(onAddAppliance)} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Manufacturer</Label>
                        <Input placeholder="e.g. Worcester Bosch" {...registerAppliance("manufacturer")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Model</Label>
                        <Input placeholder="e.g. Greenstar 30i" {...registerAppliance("model")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Serial Number</Label>
                        <Input placeholder="Optional" {...registerAppliance("serial_number")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Appliance Type</Label>
                        <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...registerAppliance("boiler_type")}>
                          <option value="">Select...</option>
                          {[
                            { value: "regular", label: "Regular" },
                            { value: "combi", label: "Combi" },
                            { value: "system", label: "System" },
                            { value: "back_boiler", label: "Back Boiler" },
                            { value: "other", label: "Other" },
                          ].map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Fuel Type</Label>
                        <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...registerAppliance("fuel_type")}>
                          <option value="">Select...</option>
                          {[
                            { value: "gas", label: "Gas" },
                            { value: "oil", label: "Oil" },
                            { value: "lpg", label: "LPG" },
                            { value: "electric", label: "Electric" },
                            { value: "solid_fuel", label: "Solid Fuel" },
                            { value: "other", label: "Other" },
                          ].map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>System Type</Label>
                        <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...registerAppliance("system_type")}>
                          <option value="">Select...</option>
                          <option value="open_vented">Open Vented</option>
                          <option value="sealed">Sealed</option>
                          <option value="gravity_fed">Gravity Fed</option>
                          <option value="pressurised">Pressurised</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Installation Date</Label>
                        <Input type="date" {...registerAppliance("installation_date")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Next Service Due</Label>
                        <Input type="date" {...registerAppliance("next_service_due")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Warranty Expiry</Label>
                        <Input type="date" {...registerAppliance("warranty_expiry")} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nozzle Size</Label>
                        <select
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                          value={applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue) ? "Custom..." : (applianceNozzleValue || "")}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            if (nextValue === "Custom...") {
                              setCustomApplianceNozzle(applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue) ? applianceNozzleValue : "");
                              setApplianceValue("nozzle_size", "");
                              return;
                            }
                            setCustomApplianceNozzle("");
                            setApplianceValue("nozzle_size", nextValue);
                          }}
                        >
                          <option value="">Select...</option>
                          {APPLIANCE_NOZZLE_SIZE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {(applianceNozzleValue === "" || (applianceNozzleValue && !APPLIANCE_NOZZLE_SIZE_OPTIONS.includes(applianceNozzleValue))) && (
                          <Input
                            value={customApplianceNozzle}
                            onChange={(event) => {
                              const nextValue = event.target.value.trim();
                              setCustomApplianceNozzle(nextValue);
                              setApplianceValue("nozzle_size", nextValue);
                            }}
                            placeholder="Enter custom nozzle size"
                            className="mt-2"
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" {...registerAppliance("notes")} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createAppliance.isPending}>
                        <Check className="w-4 h-4 mr-2" /> {createAppliance.isPending ? "Adding..." : "Add Appliance"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setShowAddAppliance(false); resetAppliance(); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {appliances.length === 0 ? (
                <Card className="p-6 text-center border-dashed">
                  <p className="text-muted-foreground">No appliances recorded for this property yet.</p>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {appliances.map((appliance) => (
                    <Link key={appliance.id} href={`/appliances/${appliance.id}`}>
                      <Card className="p-4 border border-border/50 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <p className="font-semibold text-foreground truncate">
                            {[appliance.manufacturer, appliance.model].filter(Boolean).join(" ") || "Unnamed Appliance"}
                          </p>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">Type: <span className="text-foreground capitalize">{String(appliance.boiler_type || "n/a").replace(/_/g, " ")}</span></p>
                          <p className="text-muted-foreground">Fuel: <span className="text-foreground capitalize">{String(appliance.fuel_type || "n/a").replace(/_/g, " ")}</span></p>
                          {appliance.serial_number && (
                            <p className="text-muted-foreground">Serial: <span className="text-foreground font-mono">{appliance.serial_number}</span></p>
                          )}
                          {appliance.next_service_due && (
                            <p className="text-muted-foreground">Next Service: <span className="text-foreground">{formatDate(appliance.next_service_due)}</span></p>
                          )}
                        </div>
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
                  {[...property.recent_jobs]
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
        {hasFeature("uk_address_lookup") && (
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

