import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";

const PostcodeAddressFinder = lazy(() =>
  import("@/components/postcode-address-finder").then(m => ({ default: m.PostcodeAddressFinder }))
);

const ENQUIRY_SOURCE_OPTIONS = [
  { value: "phone", label: "Phone" }, { value: "email", label: "Email" },
  { value: "text", label: "Text/SMS" }, { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" }, { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

export function QuickEnquiryDialog({ open, onOpenChange, initialDate }: { open: boolean; onOpenChange: (v: boolean) => void; initialDate?: string }) {
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
    new_first_name: "",
    new_last_name: "",
    contact_phone: "",
    contact_email: "",
    source: "phone",
    description: datePrefix,
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    new_is_landlord: false,
    new_prop_address_line1: "",
    new_prop_address_line2: "",
    new_prop_city: "",
    new_prop_county: "",
    new_prop_postcode: "",
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
    const contactName = customerMode === "new"
      ? `${form.new_first_name} ${form.new_last_name}`.trim()
      : form.contact_name.trim();

    if (!contactName) {
      toast({ title: "Missing info", description: customerMode === "new" ? "Please enter first name and surname." : "Please enter a contact name.", variant: "destructive" });
      return;
    }
    if (customerMode === "new" && form.new_is_landlord && (!form.new_prop_address_line1.trim() || !form.new_prop_postcode.trim())) {
      toast({ title: "Missing info", description: "Please enter the job location address and postcode.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        contact_name: contactName,
        linked_customer_id: selectedCustomerId || undefined,
        force_new_customer: customerMode === "new",
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
      toast({ title: "Enquiry added", description: `Enquiry for ${contactName} created.` });
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
          {customerMode === "new" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input value={form.new_first_name} onChange={e => setForm(f => ({ ...f, new_first_name: e.target.value }))} placeholder="John" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Surname *</Label>
                <Input value={form.new_last_name} onChange={e => setForm(f => ({ ...f, new_last_name: e.target.value }))} placeholder="Smith" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Contact Name *</Label>
              <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Smith" autoFocus />
            </div>
          )}
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

          {customerMode === "new" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={form.new_is_landlord}
                  onChange={e => setForm(f => ({ ...f, new_is_landlord: e.target.checked }))}
                />
                <span className="text-muted-foreground">Landlord - job is at a different address</span>
              </label>

              {form.new_is_landlord && (
                <div className="border border-primary/20 rounded-lg p-3 bg-background space-y-2">
                  <p className="text-sm font-semibold">Job Location</p>
                  {hasFeature("uk_address_lookup") && (
                    <Suspense fallback={null}>
                      <PostcodeAddressFinder
                        initialPostcode={form.new_prop_postcode}
                        onAddressSelected={addr => setForm(f => ({
                          ...f,
                          new_prop_address_line1: addr.address_line1,
                          new_prop_address_line2: addr.address_line2 || "",
                          new_prop_city: addr.city || "",
                          new_prop_county: addr.county || "",
                          new_prop_postcode: addr.postcode,
                        }))}
                      />
                    </Suspense>
                  )}
                  <Input
                    value={form.new_prop_address_line1}
                    onChange={e => setForm(f => ({ ...f, new_prop_address_line1: e.target.value }))}
                    placeholder="Address"
                  />
                  <Input
                    value={form.new_prop_address_line2}
                    onChange={e => setForm(f => ({ ...f, new_prop_address_line2: e.target.value }))}
                    placeholder="Address Line 2"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={form.new_prop_city}
                      onChange={e => setForm(f => ({ ...f, new_prop_city: e.target.value }))}
                      placeholder="Town / City"
                    />
                    <Input
                      value={form.new_prop_county}
                      onChange={e => setForm(f => ({ ...f, new_prop_county: e.target.value }))}
                      placeholder="County"
                    />
                  </div>
                  <Input
                    value={form.new_prop_postcode}
                    onChange={e => setForm(f => ({ ...f, new_prop_postcode: e.target.value.toUpperCase() }))}
                    placeholder="Postcode"
                  />
                </div>
              )}
            </div>
          )}

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
