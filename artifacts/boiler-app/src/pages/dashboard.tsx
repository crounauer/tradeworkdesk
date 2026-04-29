import { useGetDashboard, useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { MessageSquarePlus, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useCallback, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ScheduleCalendar from "@/components/schedule-calendar";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import AddToHomeScreen from "@/components/add-to-homescreen";
import { useHomepageData } from "@/hooks/use-homepage-data";
import { useInitData } from "@/hooks/use-init-data";
import { BookJobDialog } from "@/components/book-job-dialog";

const PostcodeAddressFinder = lazy(() =>
  import("@/components/postcode-address-finder").then(m => ({ default: m.PostcodeAddressFinder }))
);

export default function Dashboard() {
  const { data: homepageData, isLoading: homepageLoading } = useHomepageData();
  const data = homepageData?.dashboard as ReturnType<typeof useGetDashboard>["data"];
  const isLoading = homepageLoading;
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: initData } = useInitData();
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddEnquiry, setShowAddEnquiry] = useState(false);
  const [quickDate, setQuickDate] = useState<string | undefined>(undefined);
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

  const overdueFollowUpsCount = initData?.overdueFollowUpsCount ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AddToHomeScreen />

      {hasJobManagement && overdueFollowUpsCount > 0 && (
        <a href="/follow-ups" className="block">
          <Card className="p-4 border-orange-300 bg-orange-50 shadow-sm flex items-center gap-3 hover:bg-orange-100 transition-colors cursor-pointer">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800">
                {overdueFollowUpsCount} overdue follow-up{overdueFollowUpsCount !== 1 ? "s" : ""} awaiting action
              </p>
              <p className="text-xs text-orange-600">Parts expected dates have passed. Click to review.</p>
            </div>
          </Card>
        </a>
      )}

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
            <Button size="lg" className="gap-2 text-base px-6 py-3 shadow-md" onClick={() => handleBookJob()}>
              <Plus className="w-5 h-5" /> Book Job
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

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) return;
    const c = customers?.find(c => c.id === customerId);
    if (!c) return;
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

          {/* Existing customer dropdown */}
          {customerMode === "existing" && (
            <div className="space-y-1.5">
              <Label>Select Customer</Label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                value={selectedCustomerId}
                onChange={e => handleCustomerSelect(e.target.value)}
              >
                <option value="">— Choose a customer —</option>
                {(customers || []).map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.phone ? ` · ${c.phone}` : ""}</option>
                ))}
              </select>
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


