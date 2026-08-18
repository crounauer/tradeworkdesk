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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Phone, Mail, MapPin, Edit, ArrowLeft, Plus, X, Check, Trash2, Briefcase, Calendar, Globe, Send, ToggleLeft, ToggleRight, Loader2, MessageSquare, Receipt, ChevronRight, LogIn } from "lucide-react";
import { useState, useEffect, lazy, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { BookJobDialog } from "@/components/book-job-dialog";
import { SmsSendDialog } from "@/components/sms-send-dialog";

const PropertyLocationLookup = lazy(() => import("@/components/property-location-lookup").then(m => ({ default: m.PropertyLocationLookup })));
const PostcodeAddressFinder = lazy(() => import("@/components/postcode-address-finder").then(m => ({ default: m.PostcodeAddressFinder })));
const PropertyMapPreview = lazy(() => import("@/components/property-map-preview"));

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
  business_name?: string;
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
  const [fixingCustomerLocation, setFixingCustomerLocation] = useState(false);
  const [showBookJob, setShowBookJob] = useState(false);
  const [showBookEnquiry, setShowBookEnquiry] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (new URLSearchParams(search).get("addProperty") === "1") {
      setShowPropertyForm(true);
    }
  }, [search]);
  const [editing, setEditing] = useState(() => new URLSearchParams(search).get("edit") === "1");

  useEffect(() => {
    if (new URLSearchParams(search).get("edit") === "1") setEditing(true);
  }, [search]);
  const { profile } = useAuth();
  const [, navigate] = useLocation();
  const deleteMutation = useDeleteCustomer();
  const { toast } = useToast();

  const { hasAddon } = usePlanFeatures();
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
              {customer.business_name || `${customer.title ? `${customer.title} ` : ""}${customer.first_name} ${customer.last_name}`.trim()}
            </h1>
            {customer.business_name ? <p className="text-muted-foreground mt-1">{customer.title ? `${customer.title} ` : ""}{customer.first_name} {customer.last_name}</p> : null}
            <p className="text-muted-foreground mt-1">Customer since {new Date(customer.created_at).getFullYear()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setShowBookJob(true)}>
            <Briefcase className="w-4 h-4 mr-2" /> Book Job
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowBookEnquiry(true)}>
            <MessageSquare className="w-4 h-4 mr-2" /> New Enquiry
          </Button>
          {hasAddon("sms_messaging") && (customer.phone || customer.mobile) && (
            <Button size="sm" variant="outline" onClick={() => setShowSms(true)}>
              <MessageSquare className="w-4 h-4 mr-2" /> Send SMS
            </Button>
          )}
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
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 border border-border/50 shadow-sm space-y-4">
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
              {customer.latitude != null && customer.longitude != null && (
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Coordinates</p>
                    <button
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      onClick={() => setFixingCustomerLocation((v) => !v)}
                    >
                      <Edit className="w-3 h-3" /> Fix location
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{customer.latitude.toFixed(6)}, {customer.longitude.toFixed(6)}</p>
                  {fixingCustomerLocation ? (
                    <Suspense fallback={<div className="h-[220px] bg-slate-100 rounded animate-pulse" />}>
                      <PropertyLocationLookup
                        address={[customer.address_line1, customer.address_line2, customer.city, customer.county, customer.postcode].filter(Boolean).join(", ")}
                        latitude={customer.latitude}
                        longitude={customer.longitude}
                        onLocationFound={async (lat, lng) => {
                          await customFetch(`/api/customers/${customer.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ latitude: lat, longitude: lng }),
                          });
                          qc.invalidateQueries({ queryKey: [`/api/customers/${customer.id}`] });
                          setFixingCustomerLocation(false);
                          toast({ title: "Location updated" });
                        }}
                        onClearLocation={() => setFixingCustomerLocation(false)}
                      />
                    </Suspense>
                  ) : (
                    <Suspense fallback={<div className="h-[150px] bg-slate-100 rounded animate-pulse" />}>
                      <PropertyMapPreview key={`${customer.latitude}-${customer.longitude}`} latitude={customer.latitude} longitude={customer.longitude} />
                    </Suspense>
                  )}
                </div>
              )}
              {customer.notes && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-foreground text-sm mt-1">{customer.notes}</p>
                </div>
              )}
            </Card>

            <PortalAccessSection customerId={customer.id} customerEmail={customer.email} />
          </div>

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

            <CustomerJobsSection customerId={customer.id} onBookJob={() => setShowBookJob(true)} />

            <CustomerEnquiriesSection customerId={customer.id} onNewEnquiry={() => setShowBookEnquiry(true)} />

            <CustomerInvoicesSection customerId={customer.id} />

            <CustomerCommsSection customerId={customer.id} />
          </div>
        </div>
      )}

      {/* Book Job dialog pre-filled with this customer */}
      <BookJobDialog
        open={showBookJob}
        onOpenChange={setShowBookJob}
        initialCustomerId={customer.id}
        initialCustomerAddress={{ address_line1: customer.address_line1 ?? undefined, city: customer.city ?? undefined, postcode: customer.postcode ?? undefined }}
      />

      <SmsSendDialog
        open={showSms}
        onOpenChange={setShowSms}
        destination={customer.mobile || customer.phone || ""}
        customerId={customer.id}
      />

      {/* New Enquiry dialog pre-filled with this customer */}
      <BookEnquiryDialog
        open={showBookEnquiry}
        onOpenChange={setShowBookEnquiry}
        initialCustomerId={customer.id}
        initialName={`${customer.title ? customer.title + " " : ""}${customer.first_name} ${customer.last_name}`.trim()}
        initialPhone={customer.phone || customer.mobile || ""}
        initialEmail={customer.email || ""}
        onCreated={() => qc.invalidateQueries({ queryKey: ["customer-enquiries", customer.id] })}
      />
    </div>
  );
}

function CustomerJobsSection({ customerId, onBookJob }: { customerId: string; onBookJob?: () => void }) {
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const { data: jobsResponse } = useQuery({
    queryKey: ["customer-jobs", customerId],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/jobs?customer_id=${customerId}&limit=100`),
  });
  const jobs = (jobsResponse as any)?.jobs as Array<{ id: string; job_ref?: string; status: string; job_type?: string; job_type_name?: string; scheduled_date?: string; scheduled_time?: string; created_at?: string; description?: string }> || [];
  const sortedJobs = [...jobs].sort((a, b) => {
    const aDate = String(a.scheduled_date || "").slice(0, 10);
    const bDate = String(b.scheduled_date || "").slice(0, 10);
    if (aDate !== bDate) return sortDirection === "desc" ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);

    const aTime = String(a.scheduled_time || "");
    const bTime = String(b.scheduled_time || "");
    if (aTime !== bTime) return sortDirection === "desc" ? bTime.localeCompare(aTime) : aTime.localeCompare(bTime);

    const aCreated = String(a.created_at || "");
    const bCreated = String(b.created_at || "");
    if (aCreated !== bCreated) return sortDirection === "desc" ? bCreated.localeCompare(aCreated) : aCreated.localeCompare(bCreated);

    return sortDirection === "desc" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
  });

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Briefcase className="w-5 h-5" /> Jobs
          <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{jobs.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
          >
            {sortDirection === "desc" ? "Newest First" : "Oldest First"}
          </Button>
          {onBookJob && (
            <Button size="sm" variant="outline" onClick={onBookJob}>
              <Plus className="w-4 h-4 mr-1" /> Book Job
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {sortedJobs.map(job => (
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

function CustomerInvoicesSection({ customerId }: { customerId: string }) {
  const [, navigate] = useLocation();
  const { hasFeature } = usePlanFeatures();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-invoices", customerId],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/invoices?customer_id=${customerId}&limit=50`),
    enabled: hasFeature("invoicing"),
  });

  const docs = ((data as any)?.invoices ?? []) as Array<{
    id: string;
    type: "invoice" | "quote";
    invoice_number: string;
    status: string;
    issue_date: string;
    total: number;
    currency: string;
    sent_at: string | null;
  }>;

  if (!hasFeature("invoicing") || isLoading || docs.length === 0) return null;

  const statusColors: Record<string, string> = {
    draft:     "bg-gray-100 text-gray-700",
    sent:      "bg-blue-100 text-blue-700",
    paid:      "bg-green-100 text-green-700",
    overdue:   "bg-red-100 text-red-700",
    cancelled: "bg-gray-50 text-gray-400",
    accepted:  "bg-teal-100 text-teal-700",
    declined:  "bg-red-50 text-red-500",
    converted: "bg-purple-100 text-purple-700",
  };
  const statusLabels: Record<string, string> = {
    draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue",
    cancelled: "Cancelled", accepted: "Accepted", declined: "Declined", converted: "Converted",
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display font-bold flex items-center gap-2">
        <Receipt className="w-5 h-5" /> Invoices &amp; Quotes
        <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{docs.length}</span>
      </h2>
      <div className="space-y-2">
        {docs.map((doc) => (
          <Card
            key={doc.id}
            className="p-4 border border-border/50 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate(`/invoices/${doc.id}`)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[doc.status] || "bg-slate-100 text-slate-600"}`}>
                  {statusLabels[doc.status] || doc.status}
                </span>
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-sm text-foreground">{doc.invoice_number}</p>
                  <p className="text-xs text-muted-foreground capitalize">{doc.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="font-semibold text-sm">
                  {new Intl.NumberFormat("en-GB", { style: "currency", currency: doc.currency || "GBP" }).format(Number(doc.total))}
                </p>
                {doc.sent_at && (
                  <span className="text-xs text-blue-600 whitespace-nowrap flex items-center gap-1" title={`Last sent ${new Date(doc.sent_at).toLocaleString("en-GB")}`}>
                    <Mail className="w-3.5 h-3.5" />
                    {new Date(doc.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                )}
                {doc.issue_date && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(doc.issue_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CustomerEnquiriesSection({ customerId, onNewEnquiry }: { customerId: string; onNewEnquiry?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-enquiries", customerId],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/enquiries?customer_id=${customerId}`),
  });

  const enquiries = (data as Array<{
    id: string;
    contact_name?: string;
    source?: string;
    status?: string;
    description?: string;
    created_at?: string;
  }> | undefined) ?? [];

  if (isLoading || enquiries.length === 0) return null;

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-amber-100 text-amber-700",
    quoted: "bg-purple-100 text-purple-700",
    converted: "bg-emerald-100 text-emerald-700",
    lost: "bg-slate-100 text-slate-500",
  };

  const sourceLabels: Record<string, string> = {
    phone: "Phone",
    email: "Email",
    text: "Text/SMS",
    facebook: "Facebook",
    whatsapp: "WhatsApp",
    messenger: "Messenger",
    website: "Website",
    website_contact_form: "Website Contact Form",
    website_free_survey: "Website Free Survey",
    referral: "Referral",
    other: "Other",
    walk_in: "Walk-in",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Enquiries
          <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{enquiries.length}</span>
        </h2>
        {onNewEnquiry && (
          <Button size="sm" variant="outline" onClick={onNewEnquiry}>
            <Plus className="w-4 h-4 mr-1" /> New Enquiry
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {enquiries.map((enquiry) => (
          <Link key={enquiry.id} href={`/enquiries/${enquiry.id}`}>
            <Card className="p-4 border border-border/50 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[String(enquiry.status || "")] || "bg-slate-100 text-slate-600"}`}>
                    {String(enquiry.status || "new").replace(/_/g, " ")}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {enquiry.contact_name || "Enquiry"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sourceLabels[String(enquiry.source || "")] || String(enquiry.source || "Other")}
                    </p>
                    {enquiry.description && (
                      <p className="text-xs text-muted-foreground truncate">{enquiry.description}</p>
                    )}
                  </div>
                </div>
                {enquiry.created_at && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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

// ---------------------------------------------------------------------------
// Email history — all emails sent for this customer's jobs & invoices
// ---------------------------------------------------------------------------

interface EmailLogEntry {
  id: string;
  job_id: string | null;
  job_ref: string | null;
  sent_to: string;
  subject: string;
  forms_included: { form_type: string; form_label: string; form_id: string }[];
  body_text?: string | null;
  sent_by_name: string | null;
  created_at: string;
}

function getCustomerEmailLogBodyText(log: EmailLogEntry): string {
  if (log.body_text && log.body_text.trim().length > 0) {
    return log.body_text;
  }

  const lines = [
    `To: ${log.sent_to}`,
    `Subject: ${log.subject}`,
  ];

  if (log.forms_included?.length > 0) {
    lines.push("", "Attachments:");
    for (const form of log.forms_included) {
      lines.push(`- ${form.form_label}`);
    }
  }

  return lines.join("\n");
}

function CustomerCommsSection({ customerId }: { customerId: string }) {
  const { data: logs = [], isLoading } = useQuery<EmailLogEntry[]>({
    queryKey: ["customer-email-log", customerId],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/email-log`) as Promise<EmailLogEntry[]>,
    staleTime: 2 * 60_000,
  });
  const [openEntries, setOpenEntries] = useState<Set<string>>(new Set());

  const toggleEntry = (id: string) => {
    setOpenEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading || logs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display font-bold flex items-center gap-2">
        <Mail className="w-5 h-5" /> Email History
        <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{logs.length}</span>
      </h2>
      <div className="space-y-2">
        {logs.map(log => {
          const isOpen = openEntries.has(log.id);
          const emailBody = getCustomerEmailLogBodyText(log);
          const enquiryAttachment = (log.forms_included || []).find((entry) => entry.form_type === "enquiry_acknowledgement");
          const enquiryId = enquiryAttachment?.form_id || null;
          const card = (
            <Card className={`p-4 border border-border/50 transition-all ${log.job_id ? "hover:border-primary/50 hover:shadow-md" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{log.subject}</p>
                    {log.job_ref && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono shrink-0">#{log.job_ref}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="text-xs text-muted-foreground">To: {log.sent_to}</p>
                    {log.sent_by_name && (
                      <p className="text-xs text-muted-foreground">By: {log.sent_by_name}</p>
                    )}
                    {log.forms_included?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {log.forms_included.map(f => f.form_label).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {log.job_id && (
                    <Link href={`/jobs/${log.job_id}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => e.stopPropagation()}>
                        View job
                      </Button>
                    </Link>
                  )}
                  {enquiryId && (
                    <Link href={`/enquiries/${enquiryId}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => e.stopPropagation()}>
                        View enquiry
                      </Button>
                    </Link>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleEntry(log.id);
                    }}
                  >
                    {isOpen ? "Hide email" : "View email"}
                    <ChevronRight className={`w-3.5 h-3.5 ml-1 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              {isOpen && (
                <div className="mt-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium text-muted-foreground">Email content</p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed">
                    {emailBody}
                  </pre>
                </div>
              )}
            </Card>
          );

          return <div key={log.id}>{card}</div>;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Book Enquiry dialog — pre-populated with customer details
// ---------------------------------------------------------------------------
const SOURCE_OPTIONS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "other", label: "Other" },
];

function BookEnquiryDialog({
  open, onOpenChange, initialCustomerId, initialName, initialPhone, initialEmail, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCustomerId?: string;
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  onCreated?: () => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const { hasFeature } = usePlanFeatures();
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source: "phone",
    description: "",
    notes: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    priority: "medium",
  });

  // Populate from customer when dialog opens
  useEffect(() => {
    if (open) {
      setForm(f => ({
        ...f,
        contact_name: initialName || "",
        contact_phone: initialPhone || "",
        contact_email: initialEmail || "",
      }));
    }
  }, [open, initialName, initialPhone, initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim()) {
      toast({ title: "Missing info", description: "Please enter a contact name.", variant: "destructive" });
      return;
    }
    const contactName = form.contact_name.trim();
    const contactEmail = form.contact_email.trim();
    setSubmitting(true);
    try {
      let sendAcknowledgementEmail = false;
      if (contactEmail) {
        sendAcknowledgementEmail = window.confirm(
          `Send an acknowledgement email to ${contactName} at ${contactEmail}?`,
        );
      }

      const res = await customFetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          send_acknowledgement_email: sendAcknowledgementEmail,
          linked_customer_id: initialCustomerId,
        }),
      }) as { id?: string; acknowledgement_email_sent?: boolean };
      toast({
        title: "Enquiry created",
        description: res.acknowledgement_email_sent
          ? "The enquiry has been logged and the customer was emailed a confirmation."
          : "The enquiry has been logged.",
      });
      onCreated?.();
      onOpenChange(false);
      if (res?.id) navigate(`/enquiries/${res.id}`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Enquiry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2 space-y-1.5">
            <Label>Contact Name *</Label>
            <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="07700 900000" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} type="email" placeholder="john@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Address</Label>
            {hasFeature("uk_address_lookup") && (
              <Suspense fallback={null}>
                <PostcodeAddressFinder
                  onAddressSelected={(addr) => setForm(f => ({
                    ...f,
                    address_line1: addr.address_line1,
                    address_line2: addr.address_line2 || "",
                    city: addr.city || "",
                    postcode: addr.postcode,
                  }))}
                />
              </Suspense>
            )}
            <Input value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} placeholder="Address Line 1" />
            <Input value={form.address_line2} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))} placeholder="Address Line 2" className="mt-1.5" />
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Town / City" />
              <Input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))} placeholder="Postcode" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[64px] resize-y"
              placeholder="What does the customer need?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 flex gap-3 pt-1">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><MessageSquare className="w-4 h-4 mr-2" /> Create Enquiry</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCustomerForm({ customer, onClose }: { customer: { id: string; title?: string | null; business_name?: string | null; first_name: string; last_name: string; email?: string | null; phone?: string | null; mobile?: string | null; address_line1?: string | null; address_line2?: string | null; city?: string | null; county?: string | null; postcode?: string | null; notes?: string | null }; onClose: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateCustomer();
  const { toast } = useToast();
  const { hasFeature } = usePlanFeatures();
  const { register, handleSubmit, setValue } = useForm<CustomerEditData>({
    defaultValues: {
      title: customer.title || "",
      business_name: customer.business_name || "",
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
    },
  });

  const onSubmit = async (data: CustomerEditData) => {
    try {
      await update.mutateAsync({
        id: customer.id,
        data: {
          title: data.title || undefined,
          business_name: data.business_name || undefined,
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
          <div className="space-y-2 md:col-span-2">
            <Label>Business Name</Label>
            <Input {...register("business_name")} placeholder="Acme Heating Ltd" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          {hasFeature("uk_address_lookup") && (
            <div className="md:col-span-2">
              <Suspense fallback={null}>
                <PostcodeAddressFinder
                  onAddressSelected={(addr) => {
                    setValue("address_line1", addr.address_line1);
                    setValue("address_line2", addr.address_line2);
                    setValue("city", addr.city);
                    setValue("county", addr.county);
                    setValue("postcode", addr.postcode);
                  }}
                />
              </Suspense>
            </div>
          )}
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

function PortalAccessSection({ customerId, customerEmail }: { customerId: string; customerEmail?: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sendingInvite, setSendingInvite] = useState(false);
  const [extendingInvite, setExtendingInvite] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [openingPortalView, setOpeningPortalView] = useState(false);

  const { data: portalStatus, isLoading } = useQuery({
    queryKey: ["portal-status", customerId],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/portal-status`),
    staleTime: 30_000,
  });

  const status = portalStatus as {
    has_portal: boolean;
    is_active: boolean;
    is_registered: boolean;
    invite_expires_at?: string;
    created_at?: string;
    pending_access_request?: {
      id: string;
      requested_email: string;
      requested_postcode?: string | null;
      requested_at: string;
    } | null;
  } | undefined;

  const sendInvite = async () => {
    if (!customerEmail) {
      toast({ title: "No email", description: "Customer must have an email address to receive a portal invitation.", variant: "destructive" });
      return;
    }
    setSendingInvite(true);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/portal-invite`, {
        method: "POST",
      });
      toast({ title: "Invite sent", description: "Portal invitation has been sent to the customer." });
      qc.invalidateQueries({ queryKey: ["portal-status", customerId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send invite";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSendingInvite(false);
    }
  };

  const toggleAccess = async () => {
    if (!status?.has_portal) return;
    setToggling(true);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/portal-toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !status.is_active }),
      });
      toast({ title: status.is_active ? "Portal disabled" : "Portal enabled", description: `Customer portal access has been ${status.is_active ? "disabled" : "enabled"}.` });
      qc.invalidateQueries({ queryKey: ["portal-status", customerId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to toggle access";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  const extendInviteExpiry = async () => {
    if (!status?.has_portal || status.is_registered) return;
    setExtendingInvite(true);
    try {
      const result = await customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/portal-invite/extend`, {
        method: "POST",
      }) as { invite_expires_at?: string };
      toast({
        title: "Invite expiry extended",
        description: result.invite_expires_at
          ? `Invite now expires ${new Date(result.invite_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`
          : "Invite expiry has been extended by 7 days.",
      });
      qc.invalidateQueries({ queryKey: ["portal-status", customerId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to extend invite expiry";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setExtendingInvite(false);
    }
  };

  const approvePendingRequest = async () => {
    if (!status?.pending_access_request?.id) return;
    setSendingInvite(true);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/portal-access-requests/${status.pending_access_request.id}/approve`, {
        method: "POST",
      });
      toast({ title: "Request approved", description: "Portal invite sent to customer." });
      qc.invalidateQueries({ queryKey: ["portal-status", customerId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to approve access request";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSendingInvite(false);
    }
  };

  const rejectPendingRequest = async () => {
    if (!status?.pending_access_request?.id) return;
    setToggling(true);
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/portal-access-requests/${status.pending_access_request.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_notes: "Rejected by staff" }),
      });
      toast({ title: "Request rejected" });
      qc.invalidateQueries({ queryKey: ["portal-status", customerId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to reject access request";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  const openPortalView = async () => {
    if (!status?.has_portal || !status.is_active) {
      toast({ title: "Portal unavailable", description: "Enable customer portal access first.", variant: "destructive" });
      return;
    }

    setOpeningPortalView(true);
    try {
      const result = await customFetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/portal-impersonation`, {
        method: "POST",
      }) as { portal_url?: string; expires_at?: string };

      if (!result.portal_url) {
        throw new Error("No portal URL returned");
      }

      window.open(result.portal_url, "_blank", "noopener,noreferrer");
      const expiresText = result.expires_at
        ? new Date(result.expires_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : null;
      toast({
        title: "Customer portal opened",
        description: expiresText
          ? `View-as-customer mode is active until ${expiresText}.`
          : "View-as-customer mode started in a new tab.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to open customer portal";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setOpeningPortalView(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display font-bold flex items-center gap-2">
        <Globe className="w-5 h-5" /> Customer Portal
      </h2>
      <Card className="p-5 border border-border/50 shadow-sm">
        {!status?.has_portal ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
              <p className="text-sm text-muted-foreground">
                This customer doesn't have portal access yet. Send an invitation to let them view their service history, properties, and certificates online.
              </p>
              {!customerEmail && (
                <p className="text-sm text-amber-600 mt-1">An email address is required to send an invitation.</p>
              )}
              </div>
              <Button size="sm" onClick={sendInvite} disabled={sendingInvite || !customerEmail}>
                {sendingInvite ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {sendingInvite ? "Sending..." : "Send Portal Invite"}
              </Button>
            </div>

            {status?.pending_access_request && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                <p className="text-sm font-medium text-amber-900">Customer requested portal access</p>
                <p className="text-xs text-amber-800">
                  {status.pending_access_request.requested_email}
                  {status.pending_access_request.requested_postcode ? ` · ${status.pending_access_request.requested_postcode}` : ""}
                  {` · ${new Date(status.pending_access_request.requested_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={approvePendingRequest} disabled={sendingInvite}>
                    {sendingInvite ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Approve & Send Invite
                  </Button>
                  <Button size="sm" variant="outline" onClick={rejectPendingRequest} disabled={toggling || sendingInvite}>
                    {toggling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                    Reject Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold px-2 py-0.5 rounded-full ${status.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {status.is_active ? "Active" : "Disabled"}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold px-2 py-0.5 rounded-full ${status.is_registered ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {status.is_registered ? "Registered" : "Invite Pending"}
                  </span>
                </div>
                {!status.is_registered && status.invite_expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Invite expires: {new Date(status.invite_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:justify-end">
                {!status.is_registered && (
                  <Button size="sm" className="whitespace-nowrap" variant="outline" onClick={extendInviteExpiry} disabled={extendingInvite || toggling || sendingInvite}>
                    {extendingInvite ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {extendingInvite ? "Extending..." : "Extend 7 Days"}
                  </Button>
                )}
                {!status.is_registered && (
                  <Button size="sm" className="whitespace-nowrap" variant="outline" onClick={sendInvite} disabled={sendingInvite || !customerEmail}>
                    {sendingInvite ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Resend Invite
                  </Button>
                )}
                <Button
                  size="sm"
                  className="whitespace-nowrap"
                  variant={status.is_active ? "destructive" : "default"}
                  onClick={toggleAccess}
                  disabled={toggling}
                >
                  {toggling ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : status.is_active ? (
                    <ToggleRight className="w-4 h-4 mr-2" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 mr-2" />
                  )}
                  {status.is_active ? "Disable Access" : "Enable Access"}
                </Button>
                <Button
                  size="sm"
                  className="whitespace-nowrap"
                  variant="outline"
                  onClick={openPortalView}
                  disabled={openingPortalView || !status.is_active}
                >
                  {openingPortalView ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                  {openingPortalView ? "Opening..." : "View As Customer"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

type CustomerAddress = {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  const [showLocationLookup, setShowLocationLookup] = useState(false);

  const addressForLookup = [
    watch("address_line1"),
    watch("address_line2"),
    watch("city"),
    watch("county"),
    watch("postcode"),
  ].filter(Boolean).join(", ");

  const fillCustomerAddress = () => {
    const hasCoords = customerAddress?.latitude != null && customerAddress?.longitude != null;
    reset({
      address_line1: customerAddress?.address_line1 ?? "",
      address_line2: customerAddress?.address_line2 ?? "",
      city: customerAddress?.city ?? "",
      county: customerAddress?.county ?? "",
      postcode: customerAddress?.postcode ?? "",
      // Copy customer coords if they exist (set from Ideal Postcodes — accurate).
      // If null, show the location lookup so the user pins the location manually.
      latitude: customerAddress?.latitude ?? undefined,
      longitude: customerAddress?.longitude ?? undefined,
    });
    if (!hasCoords) setShowLocationLookup(true);
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {hasFeature("uk_address_lookup") && (
          <Suspense fallback={null}>
            <PostcodeAddressFinder
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
        </div>
        {showLocationLookup && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Pin the exact property location (drag the marker or search):</p>
            <Suspense fallback={<div className="h-[220px] bg-slate-100 rounded animate-pulse" />}>
              <PropertyLocationLookup
                address={addressForLookup}
                latitude={watchedLat ?? undefined}
                longitude={watchedLng ?? undefined}
                onLocationFound={(lat, lng) => {
                  setValue("latitude", lat);
                  setValue("longitude", lng);
                  setShowLocationLookup(false);
                }}
                onClearLocation={() => setShowLocationLookup(false)}
              />
            </Suspense>
          </div>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Adding..." : "Add Property"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
