import { useGetDashboard, useCreateJob, useCreateCustomer, useCreateProperty, useListCustomers, useListProperties } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Plus, MessageSquarePlus, Mail, Send, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ScheduleCalendar from "@/components/schedule-calendar";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useIsSoleTrader } from "@/hooks/use-sole-trader";
import AddToHomeScreen from "@/components/add-to-homescreen";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { useHomepageData } from "@/hooks/use-homepage-data";

interface JobType {
  id: number;
  name: string;
  slug: string;
  category: string;
  color: string;
  default_duration_minutes: number | null;
  is_active: boolean;
}

type QuickBookData = {
  customer_mode: "existing" | "new";
  customer_id: string;
  property_id: string;
  new_first_name: string;
  new_last_name: string;
  new_phone: string;
  new_email: string;
  new_address_line1: string;
  new_city: string;
  new_postcode: string;
  job_type_id: string;
  fuel_category: string;
  priority: string;
  scheduled_date: string;
  scheduled_time: string;
  description: string;
};

export default function Dashboard() {
  const { data: homepageData, isLoading: homepageLoading } = useHomepageData();
  const data = homepageData?.dashboard as ReturnType<typeof useGetDashboard>["data"];
  const isLoading = homepageLoading;
  const { profile } = useAuth();
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddEnquiry, setShowAddEnquiry] = useState(false);
  const [quickDate, setQuickDate] = useState<string | undefined>(undefined);
  const { hasFeature } = usePlanFeatures();
  const hasJobManagement = hasFeature("job_management");

  const handleDayAction = useCallback((date: string, action: "enquiry" | "job") => {
    setQuickDate(date);
    if (action === "enquiry") {
      setShowAddEnquiry(true);
    } else {
      setShowQuickBook(true);
    }
  }, []);

  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <Card className="p-6 border-0 shadow-sm h-[500px]">
        <div className="h-5 w-32 bg-muted rounded mb-4" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }, (_, i) => <div key={i} className="h-20 bg-muted rounded" />)}
        </div>
      </Card>
    </div>
  );
  if (!data) return null;
  const canCreateJobs = hasJobManagement && (profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AddToHomeScreen />
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-2">
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          {canCreateJobs && (
            <Button size="lg" variant="outline" className="gap-2 text-base px-5 py-3 shadow-sm" onClick={() => { setQuickDate(undefined); setShowAddEnquiry(true); }}>
              <MessageSquarePlus className="w-5 h-5" /> Add Enquiry
            </Button>
          )}
          {canCreateJobs && (
            <Button size="lg" className="gap-2 text-base px-6 py-3 shadow-md" onClick={() => { setQuickDate(undefined); setShowQuickBook(true); }}>
              <Plus className="w-5 h-5" /> Book Job
            </Button>
          )}
        </div>
      </div>

      {hasJobManagement && (
        <ScheduleCalendar
          onDayAction={canCreateJobs ? handleDayAction : undefined}
          prefetchedJobs={homepageData?.calendar_jobs?.jobs as any}
          prefetchedProfiles={homepageData?.profiles}
          prefetchedDateRange={homepageData?.calendar_date_range}
        />
      )}

      {hasJobManagement && showQuickBook && (
        <QuickBookDialog open={showQuickBook} onOpenChange={setShowQuickBook} initialDate={quickDate} />
      )}
      {hasJobManagement && showAddEnquiry && (
        <QuickEnquiryDialog open={showAddEnquiry} onOpenChange={setShowAddEnquiry} initialDate={quickDate} />
      )}
    </div>
  );
}

function QuickBookDialog({ open, onOpenChange, initialDate }: { open: boolean; onOpenChange: (v: boolean) => void; initialDate?: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { isSoleTrader } = useIsSoleTrader();
  const createJob = useCreateJob();
  const createCustomer = useCreateCustomer();
  const createProperty = useCreateProperty();

  const { data: customers } = useListCustomers();
  const { data: properties } = useListProperties();
  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch("/api/job-types");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const todayStr = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, watch, reset, setValue } = useForm<QuickBookData>({
    defaultValues: {
      customer_mode: "existing",
      priority: "medium",
      scheduled_date: initialDate || todayStr,
    },
  });

  const customerMode = watch("customer_mode");
  const selectedCustomerId = watch("customer_id");
  const filteredProperties = properties?.filter(p => !selectedCustomerId || p.customer_id === selectedCustomerId);

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const existingCustomerEmail = selectedCustomer?.email || null;

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
      qc.invalidateQueries({ queryKey: ["/api/properties"] });
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
      const res = await fetch(`/api/jobs/${confirmationState.jobId}/send-confirmation`, {
        method: "POST",
      });
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

  const onSubmit = async (data: QuickBookData) => {
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
        if (!data.new_address_line1 || !data.new_city || !data.new_postcode) {
          toast({ title: "Missing info", description: "Please enter the property address.", variant: "destructive" });
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
          },
        });
        customerId = (custRes as { id: string }).id;
        customerEmail = trimmedEmail || "";
        customerName = `${data.new_first_name.trim()} ${data.new_last_name.trim()}`;

        const propRes = await createProperty.mutateAsync({
          data: {
            customer_id: customerId,
            address_line1: data.new_address_line1.trim(),
            city: data.new_city.trim(),
            postcode: data.new_postcode.trim(),
          },
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

      const technicianId = isSoleTrader && profile?.id ? profile.id : undefined;
      const jobRes = await createJob.mutateAsync({
        data: {
          customer_id: customerId,
          property_id: propertyId,
          job_type: jobTypeCategory,
          job_type_id: selectedType ? selectedType.id : undefined,
          fuel_category: data.fuel_category || undefined,
          priority: (data.priority || "medium") as "low" | "medium" | "high" | "urgent",
          scheduled_date: data.scheduled_date,
          scheduled_time: data.scheduled_time || undefined,
          description: data.description || undefined,
          assigned_technician_id: technicianId,
        },
      });

      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      qc.invalidateQueries({ queryKey: ["/api/properties"] });

      toast({ title: "Job booked", description: data.customer_mode === "new" ? "Customer, property and job created successfully." : "Job created successfully." });

      const createdJobId = (jobRes as { id: string }).id;
      if (customerEmail) {
        setConfirmationState({ jobId: createdJobId, customerEmail, customerName });
      } else {
        reset();
        onOpenChange(false);
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
              <DialogTitle className="text-xl">Quick Book Job</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                      onSelect={(id) => { setValue("customer_id", id); setValue("property_id", ""); setShowAddProperty(false); }}
                    />
                    <div className="space-y-1.5">
                      <Label>Property *</Label>
                      <div className="flex gap-2">
                        <select className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background" required {...register("property_id")}>
                          <option value="">Select property...</option>
                          {filteredProperties?.map(p => (
                            <option key={p.id} value={p.id}>{p.address_line1}, {p.postcode}</option>
                          ))}
                        </select>
                        {selectedCustomerId && (
                          <Button type="button" variant="outline" size="icon" className="shrink-0" title="Add new property" onClick={prefillPropertyFromCustomer}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
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
                        <Button type="button" size="sm" onClick={handleCreateProperty} disabled={creatingProperty || !newPropAddress.trim() || !newPropPostcode.trim()}>
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
                    <p className="text-sm font-medium text-muted-foreground">Property Address</p>
                    <div className="space-y-1.5">
                      <Label>Address *</Label>
                      <Input {...register("new_address_line1")} placeholder="123 High Street" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Town / City *</Label>
                        <Input {...register("new_city")} placeholder="Manchester" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Postcode *</Label>
                        <Input {...register("new_postcode")} placeholder="M1 1AA" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                    <Label>Date *</Label>
                    <Input type="date" required {...register("scheduled_date")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Input type="time" {...register("scheduled_time")} />
                  </div>
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

const ENQUIRY_SOURCE_OPTIONS = [
  { value: "phone", label: "Phone" }, { value: "email", label: "Email" },
  { value: "text", label: "Text/SMS" }, { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" }, { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

function QuickEnquiryDialog({ open, onOpenChange, initialDate }: { open: boolean; onOpenChange: (v: boolean) => void; initialDate?: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const datePrefix = initialDate
    ? `Preferred date: ${new Date(initialDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}\n`
    : "";
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source: "phone",
    description: datePrefix,
    address: "",
    priority: "medium",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim()) {
      toast({ title: "Missing info", description: "Please enter a contact name.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create enquiry");
      }
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["me-init"] });
      toast({ title: "Enquiry added", description: `Enquiry for ${form.contact_name} created.` });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Quick Add Enquiry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Contact Name *</Label>
            <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Smith" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="07700 900000" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="john@example.com" type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {ENQUIRY_SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 High Street, Manchester, M1 1AA" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[70px]"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What does the customer need?"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Adding..." : "Add Enquiry"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
