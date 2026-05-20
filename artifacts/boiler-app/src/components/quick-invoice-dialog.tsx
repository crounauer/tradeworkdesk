import { useState, lazy, Suspense, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";

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

interface QuickInvoiceDialogProps {
  type: "invoice" | "quote";
  onOpenChange: (v: boolean) => void;
}

export function QuickInvoiceDialog({ type, onOpenChange }: QuickInvoiceDialogProps) {
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
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      onOpenChange(false);
      navigate(`/invoices/${inv.id}?edit=1`);
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
