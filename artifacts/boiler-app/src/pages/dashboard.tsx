import { useGetDashboard, useCreateJob, useCreateCustomer, useCreateProperty, useListCustomers, useListProperties } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Users, Briefcase, AlertCircle, CheckCircle2, Plus, MessageSquarePlus, Mail, Send, Home } from "lucide-react";
import { Link } from "wouter";
import { formatDateTime, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, lazy, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
const ScheduleCalendar = lazy(() => import("@/components/schedule-calendar"));
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useIsSoleTrader } from "@/hooks/use-sole-trader";
import { useInitData } from "@/hooks/use-init-data";
import AddToHomeScreen from "@/components/add-to-homescreen";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";

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
  priority: string;
  scheduled_date: string;
  scheduled_time: string;
  description: string;
};

export default function Dashboard() {
  const { data, isLoading } = useGetDashboard({ query: { staleTime: 60_000 } });
  const { profile } = useAuth();
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddEnquiry, setShowAddEnquiry] = useState(false);
  const { hasFeature } = usePlanFeatures();
  const hasJobManagement = hasFeature("job_management");
  const { data: initData } = useInitData();
  const enquiryCount = { count: initData?.enquiriesCount ?? 0 };

  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Card key={i} className="p-6 h-24 border-0 shadow-sm"><div className="h-4 w-20 bg-muted rounded mb-2" /><div className="h-6 w-12 bg-muted rounded" /></Card>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1,2,3].map(i => <Card key={i} className="p-6 h-[400px] border-0 shadow-sm"><div className="h-5 w-32 bg-muted rounded mb-4" /><div className="space-y-3">{[1,2,3].map(j => <div key={j} className="h-16 bg-muted rounded" />)}</div></Card>)}
      </div>
    </div>
  );
  if (!data) return null;
  const canCreateJobs = hasJobManagement && (profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin");

  const stats = [
    { label: "Total Customers", value: data.stats?.total_customers || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50", href: "/customers" },
    { label: "Jobs Today", value: data.stats?.total_jobs_today || 0, icon: Briefcase, color: "text-emerald-500", bg: "bg-emerald-50", href: "/jobs" },
    { label: "Overdue Services", value: data.stats?.overdue_count || 0, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", href: "/jobs" },
    { label: "Completed This Week", value: data.stats?.completed_this_week || 0, icon: CheckCircle2, color: "text-purple-500", bg: "bg-purple-50", href: "/jobs" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <AddToHomeScreen />
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-2">
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          {canCreateJobs && (
            <Button size="lg" variant="outline" className="gap-2 text-base px-5 py-3 shadow-sm" onClick={() => setShowAddEnquiry(true)}>
              <MessageSquarePlus className="w-5 h-5" /> Add Enquiry
            </Button>
          )}
          {canCreateJobs && (
            <Button size="lg" className="gap-2 text-base px-6 py-3 shadow-md" onClick={() => setShowQuickBook(true)}>
              <Plus className="w-5 h-5" /> Book Job
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Link key={i} href={stat.href}>
            <Card className="p-6 border-0 shadow-sm hover:shadow-md hover:border-primary/50 cursor-pointer transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {hasJobManagement && enquiryCount?.count > 0 && (
        <Link href="/enquiries">
          <Card className="p-5 border-0 shadow-sm hover:shadow-md hover:border-primary/50 cursor-pointer transition-all bg-gradient-to-r from-orange-50/80 to-amber-50/80">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <MessageSquarePlus className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Open Enquiries</p>
                <p className="text-2xl font-bold text-foreground">{enquiryCount.count}</p>
              </div>
              <span className="text-sm text-primary font-medium">View all &rarr;</span>
            </div>
          </Card>
        </Link>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="p-6 border-0 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <h2 className="text-xl font-display font-bold mb-4">Today's Jobs</h2>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3">
            {data.todays_jobs?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No jobs scheduled for today.</p>
            ) : (
              data.todays_jobs?.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block p-4 rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all bg-card">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-primary">{job.customer_name}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">{job.job_type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{job.property_address}</p>
                  <p className="text-sm font-medium">{(() => { const d = String(job.scheduled_date).slice(0, 10); return job.scheduled_time ? formatDateTime(`${d}T${job.scheduled_time}`) : formatDate(d); })()}</p>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <h2 className="text-xl font-display font-bold mb-4">Follow-up / Awaiting Parts</h2>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3">
            {data.follow_up_required?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No jobs require follow-up.</p>
            ) : (
              data.follow_up_required?.map(job => {
                const isAwaiting = job.status === "awaiting_parts";
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className={`block p-4 rounded-xl border ${isAwaiting ? "border-orange-200 bg-orange-50/50 hover:border-orange-400" : "border-rose-200 bg-rose-50/50 hover:border-rose-400"} transition-all`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-bold ${isAwaiting ? "text-orange-700" : "text-rose-700"}`}>{job.customer_name}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isAwaiting ? "bg-orange-100 text-orange-700" : "bg-rose-100 text-rose-700"}`}>{isAwaiting ? "Awaiting Parts" : "Follow-up Needed"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{job.property_address}</p>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {hasJobManagement && (
        <Suspense fallback={<Card className="p-8 text-center text-muted-foreground">Loading calendar...</Card>}>
          <ScheduleCalendar />
        </Suspense>
      )}

      {hasJobManagement && showQuickBook && (
        <QuickBookDialog open={showQuickBook} onOpenChange={setShowQuickBook} />
      )}
      {hasJobManagement && showAddEnquiry && (
        <QuickEnquiryDialog open={showAddEnquiry} onOpenChange={setShowAddEnquiry} />
      )}
    </div>
  );
}

function QuickBookDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
      scheduled_date: todayStr,
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

function QuickEnquiryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source: "phone",
    description: "",
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
