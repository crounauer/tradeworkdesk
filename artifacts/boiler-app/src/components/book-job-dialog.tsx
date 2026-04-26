import { useState, useEffect, lazy, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateJob, useCreateCustomer, useCreateProperty, useListCustomers, useListProperties, useListProfiles,
  getListCustomersQueryKey, getListPropertiesQueryKey, getListProfilesQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Home, Mail, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useIsSoleTrader } from "@/hooks/use-sole-trader";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { useOffline } from "@/contexts/offline-context";
import { getCachedCustomers, getCachedProperties, getCachedJobTypes, getCachedTechnicians, useCacheJobTypes } from "@/hooks/use-offline-data";

const PostcodeAddressFinder = lazy(() =>
  import("@/components/postcode-address-finder").then(m => ({ default: m.PostcodeAddressFinder }))
);

interface JobType {
  id: number;
  name: string;
  slug: string;
  category: string;
  color: string;
  default_duration_minutes: number | null;
  is_active: boolean;
}

type BookJobFormData = {
  customer_mode: "existing" | "new";
  // Existing customer
  customer_id: string;
  property_id: string;
  // New customer
  new_first_name: string;
  new_last_name: string;
  new_phone: string;
  new_email: string;
  new_address_line1: string;
  new_address_line2: string;
  new_city: string;
  new_county: string;
  new_postcode: string;
  new_latitude: number | null;
  new_longitude: number | null;
  new_is_landlord: boolean;
  // Landlord job location
  new_prop_address_line1: string;
  new_prop_address_line2: string;
  new_prop_city: string;
  new_prop_county: string;
  new_prop_postcode: string;
  new_prop_latitude: number | null;
  new_prop_longitude: number | null;
  // Job details
  job_type_id: string;
  fuel_category: string;
  priority: string;
  scheduled_date: string;
  scheduled_end_date: string;
  scheduled_time: string;
  assigned_technician_id: string;
  description: string;
};

function GatedAddressFinder({ onAddressSelected }: {
  onAddressSelected: (addr: { address_line1: string; address_line2: string; city: string; county: string; postcode: string; latitude?: number; longitude?: number }) => void;
}) {
  const { hasFeature } = usePlanFeatures();
  if (!hasFeature("uk_address_lookup")) return null;
  return (
    <Suspense fallback={null}>
      <PostcodeAddressFinder onAddressSelected={onAddressSelected} />
    </Suspense>
  );
}

interface BookJobDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: string;
}

export function BookJobDialog({ open, onOpenChange, initialDate }: BookJobDialogProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { isSoleTrader } = useIsSoleTrader();
  const { hasFeature } = usePlanFeatures();
  const { isOnline, queueJobCreation, getCachedData } = useOffline();

  const createJob = useCreateJob();
  const createCustomer = useCreateCustomer();
  const createProperty = useCreateProperty();

  const { data: onlineCustomers } = useListCustomers(undefined, {
    query: { queryKey: getListCustomersQueryKey(), enabled: isOnline },
  });
  const { data: onlineProperties } = useListProperties(undefined, {
    query: { queryKey: getListPropertiesQueryKey(), enabled: isOnline },
  });
  const { data: onlineTechnicians } = useListProfiles({
    query: { queryKey: getListProfilesQueryKey(), enabled: isOnline },
  });

  const [cachedCustomers, setCachedCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [cachedProperties, setCachedProperties] = useState<Array<Record<string, unknown>>>([]);
  const [cachedTechnicians, setCachedTechnicians] = useState<Array<Record<string, unknown>>>([]);
  const [cachedJobTypesData, setCachedJobTypesData] = useState<JobType[]>([]);

  useEffect(() => {
    if (!isOnline) {
      getCachedCustomers(getCachedData).then(d => d && setCachedCustomers(d));
      getCachedProperties(getCachedData).then(d => d && setCachedProperties(d));
      getCachedTechnicians(getCachedData).then(d => d && setCachedTechnicians(d));
      getCachedJobTypes(getCachedData).then(d => d && setCachedJobTypesData(d as unknown as JobType[]));
    }
  }, [isOnline, getCachedData]);

  const customers = isOnline ? onlineCustomers : (cachedCustomers as unknown as typeof onlineCustomers);
  const properties = isOnline ? onlineProperties : (cachedProperties as unknown as typeof onlineProperties);
  const technicians = isOnline ? onlineTechnicians : (cachedTechnicians as unknown as typeof onlineTechnicians);

  const { data: onlineJobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch("/api/job-types");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOnline,
  });
  useCacheJobTypes(onlineJobTypes.length > 0 ? onlineJobTypes : undefined);
  const jobTypes = isOnline ? onlineJobTypes : (cachedJobTypesData.length > 0 ? cachedJobTypesData : onlineJobTypes);

  const todayStr = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, watch, reset, setValue } = useForm<BookJobFormData>({
    defaultValues: {
      customer_mode: "existing",
      priority: "medium",
      scheduled_date: initialDate || todayStr,
      new_is_landlord: false,
    },
  });

  const customerMode = watch("customer_mode");
  const selectedCustomerId = watch("customer_id");
  const isLandlord = watch("new_is_landlord");
  const filteredProperties = properties?.filter(p => !selectedCustomerId || p.customer_id === selectedCustomerId);

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const existingCustomerEmail = selectedCustomer?.email || null;

  const isAdminOrOffice = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  // Inline "add property" state for existing-customer mode
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropAddress, setNewPropAddress] = useState("");
  const [newPropCity, setNewPropCity] = useState("");
  const [newPropPostcode, setNewPropPostcode] = useState("");
  const [creatingProperty, setCreatingProperty] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [confirmationState, setConfirmationState] = useState<{
    jobId: string;
    customerEmail: string;
    customerName: string;
  } | null>(null);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);

  const handleClose = () => {
    setConfirmationState(null);
    setShowAddProperty(false);
    setNewPropAddress("");
    setNewPropCity("");
    setNewPropPostcode("");
    reset();
    onOpenChange(false);
  };

  const prefillPropertyFromCustomer = () => {
    if (selectedCustomer) {
      setNewPropAddress((selectedCustomer as any).address_line1 || "");
      setNewPropCity((selectedCustomer as any).city || "");
      setNewPropPostcode((selectedCustomer as any).postcode || "");
    }
    setShowAddProperty(true);
  };

  const handleCreateProperty = async () => {
    if (!selectedCustomerId || !newPropAddress.trim() || !newPropPostcode.trim()) {
      toast({ title: "Missing info", description: "Address and postcode are required.", variant: "destructive" });
      return;
    }
    setCreatingProperty(true);
    try {
      const propRes = await createProperty.mutateAsync({
        data: {
          customer_id: selectedCustomerId,
          address_line1: newPropAddress.trim(),
          city: newPropCity.trim() || undefined,
          postcode: newPropPostcode.trim(),
        },
      });
      const newId = (propRes as { id: string }).id;
      qc.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      setValue("property_id", newId);
      setShowAddProperty(false);
      setNewPropAddress("");
      setNewPropCity("");
      setNewPropPostcode("");
      toast({ title: "Property added", description: "Property created and selected." });
    } catch {
      toast({ title: "Error", description: "Failed to create property.", variant: "destructive" });
    } finally {
      setCreatingProperty(false);
    }
  };

  const handleSendConfirmation = async () => {
    if (!confirmationState) return;
    setSendingConfirmation(true);
    try {
      const res = await fetch(`/api/jobs/${confirmationState.jobId}/send-confirmation`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send confirmation email");
      }
      toast({ title: "Email sent", description: `Confirmation sent to ${confirmationState.customerEmail}` });
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      toast({ title: "Email error", description: message, variant: "destructive" });
    } finally {
      setSendingConfirmation(false);
    }
  };

  const onSubmit = async (data: BookJobFormData) => {
    setSubmitting(true);
    try {
      let customerId = data.customer_id;
      let propertyId = data.property_id;
      let customerEmail = "";
      let customerName = "";

      if (data.customer_mode === "new") {
        if (!data.new_first_name || !data.new_last_name) {
          toast({ title: "Missing info", description: "Please enter the customer's name.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        if (!data.new_address_line1 || !data.new_postcode) {
          toast({ title: "Missing info", description: "Please enter the customer's address.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        if (data.new_is_landlord && (!data.new_prop_address_line1 || !data.new_prop_postcode)) {
          toast({ title: "Missing info", description: "Please enter the job location address.", variant: "destructive" });
          setSubmitting(false);
          return;
        }

        const trimmedEmail = data.new_email?.trim() || undefined;
        const custRes = await createCustomer.mutateAsync({
          data: {
            first_name: data.new_first_name.trim(),
            last_name: data.new_last_name.trim(),
            phone: data.new_phone?.trim() || undefined,
            email: trimmedEmail,
            address_line1: data.new_address_line1.trim(),
            address_line2: data.new_address_line2?.trim() || undefined,
            city: data.new_city?.trim() || undefined,
            county: data.new_county?.trim() || undefined,
            postcode: data.new_postcode.trim(),
          },
        });
        customerId = (custRes as { id: string }).id;
        customerEmail = trimmedEmail || "";
        customerName = `${data.new_first_name.trim()} ${data.new_last_name.trim()}`;

        const propAddress = data.new_is_landlord ? {
          address_line1: data.new_prop_address_line1.trim(),
          address_line2: data.new_prop_address_line2?.trim() || undefined,
          city: data.new_prop_city?.trim() || undefined,
          county: data.new_prop_county?.trim() || undefined,
          postcode: data.new_prop_postcode.trim(),
          latitude: data.new_prop_latitude ?? undefined,
          longitude: data.new_prop_longitude ?? undefined,
        } : {
          address_line1: data.new_address_line1.trim(),
          address_line2: data.new_address_line2?.trim() || undefined,
          city: data.new_city?.trim() || undefined,
          county: data.new_county?.trim() || undefined,
          postcode: data.new_postcode.trim(),
          latitude: data.new_latitude ?? undefined,
          longitude: data.new_longitude ?? undefined,
        };

        const propRes = await createProperty.mutateAsync({
          data: { customer_id: customerId, ...propAddress },
        });
        propertyId = (propRes as { id: string }).id;
      } else {
        const cust = customers?.find(c => c.id === data.customer_id);
        customerEmail = cust?.email || "";
        customerName = cust ? `${cust.first_name} ${cust.last_name}` : "";
      }

      if (!customerId || !propertyId) {
        toast({ title: "Missing info", description: "Please select a customer and property.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const selectedType = jobTypes.find((t) => t.id === parseInt(data.job_type_id, 10));
      const jobTypeCategory = (selectedType?.category ?? "service") as "service" | "breakdown" | "installation" | "inspection" | "follow_up";
      const technicianId = isSoleTrader && profile?.id
        ? profile.id
        : (isAdminOrOffice ? data.assigned_technician_id || undefined : undefined);

      const jobPayload = {
        customer_id: customerId,
        property_id: propertyId,
        job_type: jobTypeCategory,
        job_type_id: selectedType ? selectedType.id : undefined,
        fuel_category: data.fuel_category || undefined,
        priority: (data.priority || "medium") as "low" | "medium" | "high" | "urgent",
        scheduled_date: data.scheduled_date,
        scheduled_end_date: data.scheduled_end_date || undefined,
        scheduled_time: data.scheduled_time || undefined,
        description: data.description || undefined,
        assigned_technician_id: technicianId,
      };

      if (!isOnline) {
        await queueJobCreation(jobPayload);
        toast({ title: "Job saved offline", description: "It will sync automatically when you're back online." });
        handleClose();
        return;
      }

      const jobRes = await createJob.mutateAsync({ data: jobPayload });

      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      qc.invalidateQueries({ queryKey: ["/api/properties"] });
      qc.invalidateQueries({ queryKey: ["homepage"] });
      qc.invalidateQueries({ queryKey: ["me-init"] });

      toast({ title: "Job booked", description: data.customer_mode === "new" ? "Customer, property and job created successfully." : "Job created successfully." });

      const createdJobId = (jobRes as { id: string }).id;
      if (customerEmail) {
        setConfirmationState({ jobId: createdJobId, customerEmail, customerName });
      } else {
        handleClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {confirmationState ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Send Booking Confirmation?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <Mail className="w-8 h-8 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Would you like to send a booking confirmation email to the customer?
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground space-y-1">
                    <p><strong>To:</strong> {confirmationState.customerName}</p>
                    <p><strong>Email:</strong> {confirmationState.customerEmail}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSendConfirmation} disabled={sendingConfirmation} className="flex-1 gap-2">
                  <Send className="w-4 h-4" />
                  {sendingConfirmation ? "Sending..." : "Send Confirmation"}
                </Button>
                <Button type="button" variant="outline" onClick={handleClose} disabled={sendingConfirmation}>
                  Skip
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Book Job</DialogTitle>
            </DialogHeader>

            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                Offline — job will sync automatically when back online
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Customer / New Customer tabs */}
              <div className="flex gap-2 bg-muted rounded-lg p-1">
                <button
                  type="button"
                  className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${customerMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setValue("customer_mode", "existing")}
                >
                  Existing Customer
                </button>
                <button
                  type="button"
                  className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${customerMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setValue("customer_mode", "new")}
                >
                  New Customer
                </button>
              </div>

              {customerMode === "existing" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CustomerAutocomplete
                      customers={customers || []}
                      selectedId={selectedCustomerId}
                      onSelect={(id) => {
                        setValue("customer_id", id);
                        setValue("property_id", "");
                        const cust = customers?.find(c => c.id === id);
                        const custProperties = properties?.filter(p => p.customer_id === id) ?? [];
                        if (cust && custProperties.length === 0 && (cust as any).address_line1) {
                          setNewPropAddress((cust as any).address_line1 || "");
                          setNewPropCity((cust as any).city || "");
                          setNewPropPostcode((cust as any).postcode || "");
                          setShowAddProperty(true);
                        } else {
                          setShowAddProperty(false);
                        }
                      }}
                    />
                    <div className="space-y-1.5">
                      <Label>Property *</Label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                          required
                          {...register("property_id")}
                        >
                          <option value="">Select property...</option>
                          {filteredProperties?.map(p => (
                            <option key={p.id} value={p.id}>{p.address_line1}, {p.postcode}</option>
                          ))}
                        </select>
                        {selectedCustomerId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            title="Add new property"
                            onClick={prefillPropertyFromCustomer}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {selectedCustomerId && filteredProperties?.length === 0 && !showAddProperty && (
                        <p className="text-xs text-amber-600">No properties yet. Click + to add one.</p>
                      )}
                    </div>
                  </div>
                  {selectedCustomerId && showAddProperty && (
                    <div className="border border-primary/20 rounded-lg p-4 bg-background space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Home className="w-4 h-4" /> Add Property
                        {(selectedCustomer as any)?.address_line1 && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">(pre-filled from customer)</span>
                        )}
                      </h4>
                      <div className="space-y-1.5">
                        <Label>Address *</Label>
                        <Input value={newPropAddress} onChange={e => setNewPropAddress(e.target.value)} placeholder="123 High Street" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Town / City</Label>
                          <Input value={newPropCity} onChange={e => setNewPropCity(e.target.value)} placeholder="Manchester" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Postcode *</Label>
                          <Input value={newPropPostcode} onChange={e => setNewPropPostcode(e.target.value)} placeholder="M1 1AA" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateProperty}
                          disabled={creatingProperty || !newPropAddress.trim() || !newPropPostcode.trim()}
                        >
                          {creatingProperty ? "Creating..." : "Create Property"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddProperty(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {selectedCustomerId && (
                    <div className="flex items-center gap-2 text-sm px-1">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {existingCustomerEmail ? (
                        <span className="text-muted-foreground">{existingCustomerEmail}</span>
                      ) : (
                        <span className="text-muted-foreground/60 italic">No email on file</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>First Name *</Label>
                      <Input {...register("new_first_name")} placeholder="John" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name *</Label>
                      <Input {...register("new_last_name")} placeholder="Smith" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input {...register("new_phone")} placeholder="07700 900000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input {...register("new_email")} placeholder="john@example.com" type="email" />
                    </div>
                  </div>
                  <div className="border-t pt-4 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Customer Address</p>
                    <GatedAddressFinder
                      onAddressSelected={(addr) => {
                        setValue("new_address_line1", addr.address_line1);
                        setValue("new_address_line2", addr.address_line2);
                        setValue("new_city", addr.city);
                        setValue("new_county", addr.county);
                        setValue("new_postcode", addr.postcode);
                        if (addr.latitude && addr.longitude) {
                          setValue("new_latitude", addr.latitude);
                          setValue("new_longitude", addr.longitude);
                        }
                      }}
                    />
                    <div className="space-y-1.5">
                      <Label>Address *</Label>
                      <Input {...register("new_address_line1")} placeholder="123 High Street" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Address Line 2</Label>
                      <Input {...register("new_address_line2")} placeholder="Flat 2, etc." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Town / City *</Label>
                        <Input {...register("new_city")} placeholder="Manchester" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>County</Label>
                        <Input {...register("new_county")} placeholder="Greater Manchester" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Postcode *</Label>
                        <Input {...register("new_postcode")} placeholder="M1 1AA" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none pt-1">
                      <input type="checkbox" className="rounded border-border" {...register("new_is_landlord")} />
                      <span className="text-muted-foreground">Landlord — job is at a different address</span>
                    </label>
                  </div>
                  {isLandlord && (
                    <div className="border border-primary/20 rounded-lg p-4 bg-background space-y-3">
                      <p className="text-sm font-semibold">Job Location</p>
                      <GatedAddressFinder
                        onAddressSelected={(addr) => {
                          setValue("new_prop_address_line1", addr.address_line1);
                          setValue("new_prop_address_line2", addr.address_line2);
                          setValue("new_prop_city", addr.city);
                          setValue("new_prop_county", addr.county);
                          setValue("new_prop_postcode", addr.postcode);
                          if (addr.latitude && addr.longitude) {
                            setValue("new_prop_latitude", addr.latitude);
                            setValue("new_prop_longitude", addr.longitude);
                          }
                        }}
                      />
                      <div className="space-y-1.5">
                        <Label>Address *</Label>
                        <Input {...register("new_prop_address_line1")} placeholder="123 High Street" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Address Line 2</Label>
                        <Input {...register("new_prop_address_line2")} placeholder="Flat 2, etc." />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Town / City *</Label>
                          <Input {...register("new_prop_city")} placeholder="Manchester" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>County</Label>
                          <Input {...register("new_prop_county")} placeholder="Greater Manchester" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Postcode *</Label>
                        <Input {...register("new_prop_postcode")} placeholder="M1 1AA" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Job details */}
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Job Type *</Label>
                    <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required {...register("job_type_id")}>
                      <option value="">Select type...</option>
                      {jobTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("priority")}>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Forms Required</Label>
                  <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("fuel_category")}>
                    <option value="">Select...</option>
                    <option value="gas">Gas</option>
                    <option value="oil">Oil</option>
                    <option value="heat_pump">Heat Pump</option>
                    <option value="general">Plumbing</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Start Date *</Label>
                    <Input type="date" required {...register("scheduled_date")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Date <span className="text-xs text-muted-foreground">(multi-day only)</span></Label>
                    <Input type="date" {...register("scheduled_end_date")} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Input type="time" {...register("scheduled_time")} />
                  </div>
                  {isAdminOrOffice && !isSoleTrader && (
                    <div className="space-y-1.5">
                      <Label>Assign Technician</Label>
                      <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("assigned_technician_id")}>
                        <option value="">Unassigned</option>
                        {technicians
                          ?.filter(t => (t as any).can_be_assigned_jobs === true || t.role === "technician")
                          .map(t => (
                            <option key={t.id} value={t.id}>{t.full_name}{t.role === "admin" ? " (Admin)" : ""}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <textarea
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]"
                    placeholder="Any details about the job..."
                    {...register("description")}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Booking..." : "Book Job"}
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
