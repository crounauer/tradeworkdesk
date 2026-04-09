import { useGetCustomer, useCreateProperty, useUpdateCustomer, useDeleteCustomer } from "@workspace/api-client-react";
import { useLookupOptions } from "@/hooks/use-lookup-options";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Home, Phone, Mail, MapPin, Edit, ArrowLeft, Plus, X, Check, Trash2, Briefcase, Calendar } from "lucide-react";
import { useState, useEffect, lazy, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";

const PropertyLocationLookup = lazy(() => import("@/components/property-location-lookup").then(m => ({ default: m.PropertyLocationLookup })));

type PropertyFormData = {
  address_line1: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode: string;
  property_type?: string;
  access_notes?: string;
  parking_notes?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type CustomerEditData = {
  title?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  notes?: string;
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useGetCustomer(id);
  const search = useSearch();
  const [showPropertyForm, setShowPropertyForm] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(search).get("addProperty") === "1") {
      setShowPropertyForm(true);
    }
  }, [search]);
  const [editing, setEditing] = useState(false);
  const { profile } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const deleteMutation = useDeleteCustomer();
  const { toast } = useToast();

  const canDelete = profile?.role === "admin" || profile?.role === "super_admin";

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Link href="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Customers
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-2xl">
            {customer.first_name[0]}{customer.last_name[0]}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {customer.title ? `${customer.title} ` : ''}{customer.first_name} {customer.last_name}
            </h1>
            <p className="text-muted-foreground mt-1">Customer since {new Date(customer.created_at).getFullYear()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Edit className="w-4 h-4 mr-2"/> Edit</>}
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {customer.first_name} {customer.last_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the customer record and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      try {
                        await deleteMutation.mutateAsync({ id: customer.id });
                        qc.invalidateQueries({ queryKey: ["/api/customers"] });
                        navigate("/customers");
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : "Unknown error";
                        toast({ title: "Delete failed", description: msg, variant: "destructive" });
                      }
                    }}
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete Customer"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {editing ? (
        <EditCustomerForm customer={customer} onClose={() => setEditing(false)} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-1 border border-border/50 shadow-sm space-y-4">
            <h3 className="font-bold text-lg border-b border-border/50 pb-2">Contact Info</h3>
            {customer.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-foreground">{customer.phone}</p>
                </div>
              </div>
            )}
            {customer.mobile && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Mobile</p>
                  <p className="text-foreground">{customer.mobile}</p>
                </div>
              </div>
            )}
            {customer.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-foreground">{customer.email}</p>
                </div>
              </div>
            )}
            {(customer.address_line1 || customer.postcode) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Billing Address</p>
                  <p className="text-foreground text-sm leading-relaxed">
                    {customer.address_line1}<br/>
                    {customer.address_line2 && <>{customer.address_line2}<br/></>}
                    {customer.city}{customer.city && customer.postcode ? ', ' : ''}{customer.postcode}
                  </p>
                </div>
              </div>
            )}
            {customer.notes && (
              <div className="pt-3 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p className="text-foreground text-sm mt-1">{customer.notes}</p>
              </div>
            )}
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display font-bold">Properties</h2>
              <Button size="sm" variant="secondary" onClick={() => setShowPropertyForm(!showPropertyForm)}>
                {showPropertyForm ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Plus className="w-4 h-4 mr-2"/> Add Property</>}
              </Button>
            </div>

            {showPropertyForm && (
              <AddPropertyForm customerId={customer.id} customerAddress={customer} onClose={() => setShowPropertyForm(false)} />
            )}

            {customer.properties?.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Home className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No properties linked to this customer.</p>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {customer.properties?.map(prop => (
                  <Link key={prop.id} href={`/properties/${prop.id}`}>
                    <Card className="p-5 border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                          <Home className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{prop.address_line1}</p>
                          <p className="text-sm text-muted-foreground">{prop.postcode}</p>
                          <span className="inline-block mt-2 text-xs font-medium bg-slate-100 px-2 py-1 rounded-md text-slate-600 capitalize">
                            {prop.property_type || 'Property'}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            <CustomerJobsSection customerId={customer.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerJobsSection({ customerId }: { customerId: string }) {
  const { data: jobsResponse } = useQuery({
    queryKey: ["customer-jobs", customerId],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/jobs?customer_id=${customerId}&limit=100`),
  });
  const jobs = (jobsResponse as any)?.jobs as Array<{ id: string; job_ref?: string; status: string; job_type?: string; job_type_name?: string; scheduled_date?: string; scheduled_time?: string; description?: string }> || [];

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
    requires_follow_up: "bg-rose-100 text-rose-700",
    awaiting_parts: "bg-orange-100 text-orange-700",
    invoiced: "bg-violet-100 text-violet-700",
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    requires_follow_up: "Follow Up",
    awaiting_parts: "Awaiting Parts",
    invoiced: "Invoiced",
  };

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display font-bold flex items-center gap-2">
        <Briefcase className="w-5 h-5" /> Jobs
        <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{jobs.length}</span>
      </h2>
      <div className="space-y-2">
        {jobs.map(job => (
          <Link key={job.id} href={`/jobs/${job.id}`}>
            <Card className="p-4 border border-border/50 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[job.status] || "bg-slate-100 text-slate-600"}`}>
                    {statusLabels[job.status] || job.status}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {job.job_ref ? `#${job.job_ref}` : `#${job.id.slice(0, 8)}`}
                      {(job.job_type_name || job.job_type) ? ` — ${job.job_type_name || job.job_type}` : ""}
                    </p>
                    {job.description && (
                      <p className="text-xs text-muted-foreground truncate">{job.description}</p>
                    )}
                  </div>
                </div>
                {job.scheduled_date && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EditCustomerForm({ customer, onClose }: { customer: { id: string; title?: string | null; first_name: string; last_name: string; email?: string | null; phone?: string | null; mobile?: string | null; address_line1?: string | null; address_line2?: string | null; city?: string | null; county?: string | null; postcode?: string | null; notes?: string | null }; onClose: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateCustomer();
  const { toast } = useToast();
  const { register, handleSubmit, reset } = useForm<CustomerEditData>();

  useEffect(() => {
    reset({
      title: customer.title || "",
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email || "",
      phone: customer.phone || "",
      mobile: customer.mobile || "",
      address_line1: customer.address_line1 || "",
      address_line2: customer.address_line2 || "",
      city: customer.city || "",
      county: customer.county || "",
      postcode: customer.postcode || "",
      notes: customer.notes || "",
    });
  }, [customer, reset]);

  const onSubmit = async (data: CustomerEditData) => {
    try {
      await update.mutateAsync({
        id: customer.id,
        data: {
          title: data.title || undefined,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          mobile: data.mobile || undefined,
          address_line1: data.address_line1 || undefined,
          address_line2: data.address_line2 || undefined,
          city: data.city || undefined,
          county: data.county || undefined,
          postcode: data.postcode || undefined,
          notes: data.notes || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/customers/${customer.id}`] });
      toast({ title: "Updated", description: "Customer updated successfully" });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-primary/20 shadow-lg">
      <h3 className="font-bold text-lg mb-4">Edit Customer</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register("title")} placeholder="Mr / Mrs / Ms..." />
          </div>
          <div className="space-y-2">
            <Label>First Name *</Label>
            <Input {...register("first_name")} required />
          </div>
          <div className="space-y-2">
            <Label>Last Name *</Label>
            <Input {...register("last_name")} required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label>Mobile</Label>
            <Input {...register("mobile")} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input {...register("address_line1")} />
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
            <Label>Postcode</Label>
            <Input {...register("postcode")} />
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

type CustomerAddress = {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
};

function AddPropertyForm({ customerId, customerAddress, onClose }: { customerId: string; customerAddress?: CustomerAddress; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateProperty();
  const { toast } = useToast();
  const { register, handleSubmit, reset, watch, setValue } = useForm<PropertyFormData>();
  const { data: propertyTypes } = useLookupOptions("property_type");
  const { hasFeature } = usePlanFeatures();

  const watchedLat = watch("latitude");
  const watchedLng = watch("longitude");

  const addressForLookup = [
    watch("address_line1"),
    watch("address_line2"),
    watch("city"),
    watch("county"),
    watch("postcode"),
  ].filter(Boolean).join(", ");

  const fillCustomerAddress = () => {
    reset({
      address_line1: customerAddress?.address_line1 ?? "",
      address_line2: customerAddress?.address_line2 ?? "",
      city: customerAddress?.city ?? "",
      county: customerAddress?.county ?? "",
      postcode: customerAddress?.postcode ?? "",
    });
  };

  const hasCustomerAddress = !!(customerAddress?.address_line1 || customerAddress?.postcode);

  const onSubmit = async (data: PropertyFormData) => {
    try {
      await create.mutateAsync({
        data: {
          customer_id: customerId,
          address_line1: data.address_line1,
          address_line2: data.address_line2 || undefined,
          city: data.city || undefined,
          county: data.county || undefined,
          postcode: data.postcode,
          property_type: data.property_type || undefined,
          access_notes: data.access_notes || undefined,
          parking_notes: data.parking_notes || undefined,
          latitude: data.latitude ?? undefined,
          longitude: data.longitude ?? undefined,
        }
      });
      qc.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      toast({ title: "Added", description: "Property added successfully" });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-primary/20 shadow-lg bg-primary/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Add New Property</h3>
        {hasCustomerAddress && (
          <Button type="button" variant="outline" size="sm" onClick={fillCustomerAddress}>
            <MapPin className="w-4 h-4 mr-2" /> Use customer's address
          </Button>
        )}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="Address Line 1 *" required {...register("address_line1")} />
        <Input placeholder="Address Line 2" {...register("address_line2")} />
        <Input placeholder="City" {...register("city")} />
        <Input placeholder="County" {...register("county")} />
        <Input placeholder="Postcode *" required {...register("postcode")} />
        <select className="border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("property_type")}>
          <option value="">Property Type...</option>
          {(propertyTypes || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Input placeholder="Access Notes" {...register("access_notes")} />
        <Input placeholder="Parking Notes" {...register("parking_notes")} />
        {hasFeature("geo_mapping") && (
          <div className="md:col-span-2 border-t border-border/50 pt-3">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Property Location</label>
            <Suspense fallback={<div className="h-8 bg-slate-100 rounded animate-pulse" />}>
              <PropertyLocationLookup
                address={addressForLookup}
                latitude={watchedLat}
                longitude={watchedLng}
                onLocationFound={(lat, lng) => {
                  setValue("latitude", lat);
                  setValue("longitude", lng);
                }}
                onClearLocation={() => {
                  setValue("latitude", null);
                  setValue("longitude", null);
                }}
              />
            </Suspense>
          </div>
        )}
        <div className="md:col-span-2 flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Adding..." : "Add Property"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
