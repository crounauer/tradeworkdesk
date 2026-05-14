import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { MessageSquarePlus, AlertTriangle, Plus, MessageSquare, MapPin, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useCallback, lazy, Suspense, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ScheduleCalendar from "@/components/schedule-calendar";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import AddToHomeScreen from "@/components/add-to-homescreen";
import { useInitData } from "@/hooks/use-init-data";
import { BookJobDialog } from "@/components/book-job-dialog";

const PostcodeAddressFinder = lazy(() =>
  import("@/components/postcode-address-finder").then(m => ({ default: m.PostcodeAddressFinder }))
);

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

export default function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: initData } = useInitData();
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddEnquiry, setShowAddEnquiry] = useState(false);
  const [quickDate, setQuickDate] = useState<string | undefined>(undefined);
  const [showQuickInvoice, setShowQuickInvoice] = useState<"invoice" | "quote" | null>(null);
  const { hasFeature: dashHasFeature } = usePlanFeatures();
  const hasJobManagement = dashHasFeature("job_management");

  const checkJobLimit = useCallback(() => {
    const limits = initData?.usageLimits;
    if (limits && limits.maxJobsPerMonth !== 9999 && limits.currentJobsThisMonth >= limits.maxJobsPerMonth) {
      toast({
        title: "Monthly job limit reached",
        description: `You've used ${limits.currentJobsThisMonth} of ${limits.maxJobsPerMonth} jobs this month. Upgrade your plan or purchase additional job capacity to create more.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  }, [initData, toast]);

  const handleBookJob = useCallback((date?: string) => {
    if (!checkJobLimit()) return;
    setQuickDate(date);
    setShowQuickBook(true);
  }, [checkJobLimit]);

  const handleDayAction = useCallback((date: string, action: "enquiry" | "job") => {
    if (action === "enquiry") {
      setQuickDate(date);
      setShowAddEnquiry(true);
    } else {
      handleBookJob(date);
    }
  }, [handleBookJob]);

  const canCreateJobs = hasJobManagement && (profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin");
  const canCreateInvoices = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  const overdueFollowUpsCount = initData?.overdueFollowUpsCount ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AddToHomeScreen />

      {hasJobManagement && overdueFollowUpsCount > 0 && (
        <a href="/follow-ups" className="block">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer text-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="font-medium text-orange-800">{overdueFollowUpsCount} overdue follow-up{overdueFollowUpsCount !== 1 ? "s" : ""}</span>
            <span className="text-orange-600 hidden sm:inline">&mdash; parts expected dates have passed</span>
            <span className="ml-auto text-orange-500 text-xs">Review &rarr;</span>
          </div>
        </a>
      )}

<div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-2">
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateInvoices && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQuickInvoice("quote")}>
              <FileText className="w-4 h-4" /> + Quote
            </Button>
          )}
          {canCreateInvoices && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQuickInvoice("invoice")}>
              <Receipt className="w-4 h-4" /> + Invoice
            </Button>
          )}
          {canCreateJobs && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setQuickDate(undefined); setShowAddEnquiry(true); }}>
              <MessageSquarePlus className="w-4 h-4" /> Add Enquiry
            </Button>
          )}
          {canCreateJobs && (
            <Button size="sm" className="gap-1.5" onClick={() => handleBookJob()}>
              <Plus className="w-4 h-4" /> Book Job
            </Button>
          )}
        </div>
      </div>

      {hasJobManagement && (
        <ScheduleCalendar
          onDayAction={canCreateJobs ? handleDayAction : undefined}
        />
      )}

      {hasJobManagement && showQuickBook && (
        <BookJobDialog open={showQuickBook} onOpenChange={setShowQuickBook} initialDate={quickDate} />
      )}
      {hasJobManagement && showAddEnquiry && (
        <QuickEnquiryDialog open={showAddEnquiry} onOpenChange={setShowAddEnquiry} initialDate={quickDate} />
      )}
      {showQuickInvoice && (
        <QuickInvoiceDialog type={showQuickInvoice} onOpenChange={(v) => { if (!v) setShowQuickInvoice(null); }} />
      )}
    </div>
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
  const { hasFeature } = usePlanFeatures();
  const [submitting, setSubmitting] = useState(false);
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  const { data: customers } = useListCustomers(undefined, {
    query: { queryKey: getListCustomersQueryKey() },
  });

  const datePrefix = initialDate
    ? `Preferred date: ${new Date(initialDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}\n`
    : "";
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source: "phone",
    description: datePrefix,
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    priority: "medium",
  });

  const filteredCustomers = (customers || []).filter(c => {
    const q = customerSearch.toLowerCase();
    if (!q) return true;
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.mobile || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.postcode || "").toLowerCase().includes(q)
    );
  });

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerDropdownOpen(false);
    if (!customerId) return;
    const c = customers?.find(c => c.id === customerId);
    if (!c) return;
    setCustomerSearch(`${c.first_name} ${c.last_name}`);
    setForm(f => ({
      ...f,
      contact_name: `${c.first_name} ${c.last_name}`.trim(),
      contact_phone: c.mobile || c.phone || f.contact_phone,
      contact_email: c.email || f.contact_email,
      address_line1: c.address_line1 || f.address_line1,
      address_line2: c.address_line2 || f.address_line2,
      city: c.city || f.city,
      postcode: c.postcode || f.postcode,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim()) {
      toast({ title: "Missing info", description: "Please enter a contact name.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        linked_customer_id: selectedCustomerId || undefined,
      };
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create enquiry");
      }
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["me-init"] });
      qc.invalidateQueries({ queryKey: ["homepage"] });
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
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Quick Add Enquiry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Customer mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
            <button
              type="button"
              className={`flex-1 py-2 transition-colors ${customerMode === "new" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => { setCustomerMode("new"); setSelectedCustomerId(""); }}
            >New Contact</button>
            <button
              type="button"
              className={`flex-1 py-2 transition-colors ${customerMode === "existing" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => setCustomerMode("existing")}
            >Existing Customer</button>
          </div>

          {/* Existing customer search */}
          {customerMode === "existing" && (
            <div className="space-y-1.5">
              <Label>Search Customer</Label>
              <div className="relative">
                <Input
                  placeholder="Name, phone, email or postcode…"
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomerId(""); setCustomerDropdownOpen(true); }}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                  autoComplete="off"
                />
                {customerDropdownOpen && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center gap-2"
                        onMouseDown={() => handleCustomerSelect(c.id)}
                      >
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <span className="text-muted-foreground text-xs truncate">{c.mobile || c.phone || c.email || ""}</span>
                      </button>
                    ))}
                  </div>
                )}
                {customerDropdownOpen && customerSearch.length > 0 && filteredCustomers.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-white shadow-lg px-3 py-2 text-sm text-muted-foreground">
                    No customers found
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <p className="text-xs text-emerald-600 font-medium">✓ Linked to {selectedCustomer.first_name} {selectedCustomer.last_name}</p>
              )}
            </div>
          )}

          {/* Contact fields */}
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

          {/* Source & Priority */}
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

          {/* Address */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Address</Label>
            {hasFeature("uk_address_lookup") && (
              <Suspense fallback={null}>
                <PostcodeAddressFinder
                  onAddressSelected={addr => setForm(f => ({
                    ...f,
                    address_line1: addr.address_line1,
                    address_line2: addr.address_line2 || "",
                    city: addr.city,
                    postcode: addr.postcode,
                  }))}
                />
              </Suspense>
            )}
            <div className="space-y-2">
              <Input
                value={form.address_line1}
                onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
                placeholder="Address line 1"
              />
              <Input
                value={form.address_line2}
                onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))}
                placeholder="Address line 2 (optional)"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="City / Town"
                />
                <Input
                  value={form.postcode}
                  onChange={e => setForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))}
                  placeholder="Postcode"
                />
              </div>
            </div>
          </div>

          {/* Description */}
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

function QuickInvoiceDialog({ type, onOpenChange }: { type: "invoice" | "quote"; onOpenChange: (v: boolean) => void }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: customers } = useListCustomers({});
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddr1, setNewAddr1] = useState("");
  const [newAddr2, setNewAddr2] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCounty, setNewCounty] = useState("");
  const [newPostcode, setNewPostcode] = useState("");
  const [newLat, setNewLat] = useState<number | undefined>();
  const [newLng, setNewLng] = useState<number | undefined>();
  const [newIsLandlord, setNewIsLandlord] = useState(false);
  const [newPropAddr1, setNewPropAddr1] = useState("");
  const [newPropAddr2, setNewPropAddr2] = useState("");
  const [newPropCity, setNewPropCity] = useState("");
  const [newPropCounty, setNewPropCounty] = useState("");
  const [newPropPostcode, setNewPropPostcode] = useState("");
  const [newPropLat, setNewPropLat] = useState<number | undefined>();
  const [newPropLng, setNewPropLng] = useState<number | undefined>();
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = type === "quote" ? "Quote" : "Invoice";

  const filtered = (customers || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.postcode || "").toLowerCase().includes(q);
  });

  async function handleCreateCustomer() {
    if (!newFirst.trim() || !newLast.trim()) return;
    setCreatingCustomer(true);
    try {
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newFirst.trim(),
          last_name: newLast.trim(),
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
          ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
          ...(newAddr1.trim() ? { address_line1: newAddr1.trim() } : {}),
          ...(newAddr2.trim() ? { address_line2: newAddr2.trim() } : {}),
          ...(newCity.trim() ? { city: newCity.trim() } : {}),
          ...(newCounty.trim() ? { county: newCounty.trim() } : {}),
          ...(newPostcode.trim() ? { postcode: newPostcode.trim() } : {}),
          ...(newLat != null ? { latitude: newLat } : {}),
          ...(newLng != null ? { longitude: newLng } : {}),
        }),
      });
      if (!custRes.ok) {
        const body = await custRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create customer");
      }
      const customer = await custRes.json();

      // If landlord, create a property at the separate address
      if (newIsLandlord && newPropAddr1.trim() && newPropPostcode.trim()) {
        const propRes = await fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: customer.id,
            address_line1: newPropAddr1.trim(),
            ...(newPropAddr2.trim() ? { address_line2: newPropAddr2.trim() } : {}),
            ...(newPropCity.trim() ? { city: newPropCity.trim() } : {}),
            ...(newPropCounty.trim() ? { county: newPropCounty.trim() } : {}),
            postcode: newPropPostcode.trim(),
            ...(newPropLat != null ? { latitude: newPropLat } : {}),
            ...(newPropLng != null ? { longitude: newPropLng } : {}),
          }),
        });
        if (!propRes.ok) {
          const body = await propRes.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create property");
        }
      }

      queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey({}) });
      setSelectedId(customer.id);
      setSelectedName(`${customer.first_name} ${customer.last_name}`);
      setSearch(`${customer.first_name} ${customer.last_name}`);
      setShowNewCustomer(false);
      toast({ title: "Customer created" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function handleCreate() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: selectedId, type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create");
      }
      const inv = await res.json();
      onOpenChange(false);
      navigate(`/invoices/${inv.id}`);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {!showNewCustomer ? (
            <>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input
                  ref={inputRef}
                  placeholder="Search by name, email or postcode…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedId(""); setSelectedName(""); }}
                  autoFocus
                />
              </div>
              {search && (
                <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-3 py-2">No customers found</p>
                  ) : filtered.slice(0, 20).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors ${selectedId === c.id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => { setSelectedId(c.id); setSelectedName(`${c.first_name} ${c.last_name}`); setSearch(`${c.first_name} ${c.last_name}`); }}
                    >
                      <span className="font-medium">{c.first_name} {c.last_name}</span>
                      {c.email && <span className="text-muted-foreground ml-2">{c.email}</span>}
                      {c.postcode && <span className="text-muted-foreground ml-2">{c.postcode}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedId && search === selectedName && (
                <p className="text-sm text-green-700 font-medium">✓ {selectedName}</p>
              )}
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => setShowNewCustomer(true)}
              >
                + Add new customer
              </button>
              <div className="flex gap-3 pt-1">
                <Button className="flex-1" disabled={!selectedId || submitting} onClick={handleCreate}>
                  {submitting ? "Creating…" : `Create ${label}`}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-semibold">New customer</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First name <span className="text-destructive">*</span></Label>
                  <Input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name <span className="text-destructive">*</span></Label>
                  <Input value={newLast} onChange={(e) => setNewLast(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Customer Address</p>
                <GatedAddressFinder onAddressSelected={(addr) => {
                  setNewAddr1(addr.address_line1);
                  setNewAddr2(addr.address_line2);
                  setNewCity(addr.city);
                  setNewCounty(addr.county);
                  setNewPostcode(addr.postcode);
                  if (addr.latitude) setNewLat(addr.latitude);
                  if (addr.longitude) setNewLng(addr.longitude);
                }} />
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={newAddr1} onChange={(e) => setNewAddr1(e.target.value)} placeholder="123 High Street" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Address Line 2</Label>
                    <Input value={newAddr2} onChange={(e) => setNewAddr2(e.target.value)} placeholder="Flat 2, etc." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Postcode</Label>
                    <Input value={newPostcode} onChange={(e) => setNewPostcode(e.target.value)} placeholder="M1 1AA" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Town / City</Label>
                    <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Manchester" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>County</Label>
                    <Input value={newCounty} onChange={(e) => setNewCounty(e.target.value)} placeholder="Greater Manchester" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none pt-1">
                  <input type="checkbox" className="rounded border-border" checked={newIsLandlord} onChange={(e) => setNewIsLandlord(e.target.checked)} />
                  <span className="text-muted-foreground">Landlord — job is at a different address</span>
                </label>
              </div>
              {newIsLandlord && (
                <div className="border border-primary/20 rounded-lg p-4 bg-background space-y-3">
                  <p className="text-sm font-semibold">Job Location</p>
                  <GatedAddressFinder onAddressSelected={(addr) => {
                    setNewPropAddr1(addr.address_line1);
                    setNewPropAddr2(addr.address_line2);
                    setNewPropCity(addr.city);
                    setNewPropCounty(addr.county);
                    setNewPropPostcode(addr.postcode);
                    if (addr.latitude) setNewPropLat(addr.latitude);
                    if (addr.longitude) setNewPropLng(addr.longitude);
                  }} />
                  <div className="space-y-1.5">
                    <Label>Address <span className="text-destructive">*</span></Label>
                    <Input value={newPropAddr1} onChange={(e) => setNewPropAddr1(e.target.value)} placeholder="123 High Street" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Address Line 2</Label>
                      <Input value={newPropAddr2} onChange={(e) => setNewPropAddr2(e.target.value)} placeholder="Flat 2, etc." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Postcode <span className="text-destructive">*</span></Label>
                      <Input value={newPropPostcode} onChange={(e) => setNewPropPostcode(e.target.value)} placeholder="M1 1AA" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Town / City</Label>
                      <Input value={newPropCity} onChange={(e) => setNewPropCity(e.target.value)} placeholder="Manchester" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>County</Label>
                      <Input value={newPropCounty} onChange={(e) => setNewPropCounty(e.target.value)} placeholder="Greater Manchester" />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1"
                  disabled={!newFirst.trim() || !newLast.trim() || creatingCustomer || (newIsLandlord && (!newPropAddr1.trim() || !newPropPostcode.trim()))}
                  onClick={handleCreateCustomer}
                >
                  {creatingCustomer ? "Saving…" : "Save Customer"}
                </Button>
                <Button variant="outline" onClick={() => setShowNewCustomer(false)}>Back</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

