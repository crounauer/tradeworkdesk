import { useState } from "react";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateInvoice, type InvoiceLineItem, type InvoiceType } from "@/hooks/use-invoices";
import { useLocation } from "wouter";

interface DuplicateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceInvoiceNumber: string;
  type: InvoiceType;
  lineItems: InvoiceLineItem[];
  notes?: string | null;
  customerNotes?: string | null;
  worksOrder?: string | null;
  vatRate?: number | null;
}

// Copy the parts a new draft needs; drop ids/timestamps that belong to the original document.
function cloneLineItems(items: InvoiceLineItem[]): InvoiceLineItem[] {
  return items.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    item_type: l.item_type,
    serial_number: l.serial_number ?? null,
    status: l.status ?? null,
    arrival_time: l.arrival_time ?? null,
    departure_time: l.departure_time ?? null,
    hourly_rate: l.hourly_rate ?? null,
    callout_fee: l.callout_fee ?? null,
    callout_rate_id: l.callout_rate_id ?? null,
    notes: l.notes ?? null,
    catalogue_item_id: l.catalogue_item_id ?? null,
  }));
}

export function DuplicateInvoiceDialog({
  open,
  onOpenChange,
  sourceInvoiceNumber,
  type,
  lineItems,
  notes,
  customerNotes,
  worksOrder,
  vatRate,
}: DuplicateInvoiceDialogProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createMut = useCreateInvoice();

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: customers } = useListCustomers(undefined, {
    query: { queryKey: getListCustomersQueryKey(), enabled: open },
  });

  const filteredCustomers = (customers || []).filter((c) => {
    const q = customerSearch.toLowerCase();
    if (!q) return true;
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.business_name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.mobile || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.postcode || "").toLowerCase().includes(q)
    );
  });

  const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);
  const documentLabel = type === "quote" ? "Quote" : "Invoice";

  function handleSelect(customerId: string) {
    setSelectedCustomerId(customerId);
    setDropdownOpen(false);
    const c = customers?.find((c) => c.id === customerId);
    if (c) setCustomerSearch(c.business_name || `${c.first_name} ${c.last_name}`);
  }

  function reset() {
    setCustomerSearch("");
    setSelectedCustomerId("");
    setDropdownOpen(false);
  }

  async function handleSubmit() {
    if (!selectedCustomerId) {
      toast({ title: "Missing info", description: "Please select a customer.", variant: "destructive" });
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        customer_id: selectedCustomerId,
        type,
        line_items: cloneLineItems(lineItems),
        notes: notes || undefined,
        customer_notes: customerNotes || undefined,
        works_order: worksOrder || undefined,
        vat_rate: vatRate ?? undefined,
      } as any);
      toast({ title: `${documentLabel} duplicated`, description: `${created.invoice_number} created for ${selectedCustomer?.business_name || `${selectedCustomer?.first_name} ${selectedCustomer?.last_name}`}.` });
      onOpenChange(false);
      reset();
      navigate(`/invoices/${created.id}?edit=1`);
    } catch (e) {
      toast({ title: "Failed to duplicate", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Duplicate {sourceInvoiceNumber}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the customer for the new {documentLabel.toLowerCase()}. Line items will be copied as a new draft.
          </p>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Customer</Label>
          <div className="relative">
            <Input
              placeholder="Name, phone, email or postcode…"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(""); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              autoComplete="off"
              autoFocus
            />
            {dropdownOpen && filteredCustomers.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center gap-2"
                    onMouseDown={() => handleSelect(c.id)}
                  >
                    <span className="font-medium">{c.business_name || `${c.first_name} ${c.last_name}`}</span>
                    {c.business_name ? <span className="text-xs text-muted-foreground">{c.first_name} {c.last_name}</span> : null}
                    <span className="text-muted-foreground text-xs truncate">{c.mobile || c.phone || c.email || ""}</span>
                  </button>
                ))}
              </div>
            )}
            {dropdownOpen && customerSearch.length > 0 && filteredCustomers.length === 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-white shadow-lg px-3 py-2 text-sm text-muted-foreground">
                No customers found
              </div>
            )}
          </div>
          {selectedCustomer && (
            <p className="text-xs text-emerald-600 font-medium">
              ✓ {selectedCustomer.business_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
            </p>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={createMut.isPending || !selectedCustomerId}>
            {createMut.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Duplicating…</>
            ) : (
              <><Copy className="w-4 h-4 mr-2" /> Duplicate</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
