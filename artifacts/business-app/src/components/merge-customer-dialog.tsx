import { useState } from "react";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, GitMerge, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MergeCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer being viewed — kept as the survivor of the merge. */
  primaryCustomerId: string;
  primaryCustomerName: string;
  onMerged?: () => void;
}

export function MergeCustomerDialog({
  open,
  onOpenChange,
  primaryCustomerId,
  primaryCustomerName,
  onMerged,
}: MergeCustomerDialogProps) {
  const { toast } = useToast();
  const [merging, setMerging] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: customers } = useListCustomers(undefined, {
    query: { queryKey: getListCustomersQueryKey(), enabled: open },
  });

  const filtered = (customers || []).filter((c) => {
    if (c.id === primaryCustomerId) return false;
    const q = search.toLowerCase();
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

  const selected = customers?.find((c) => c.id === selectedId);
  const selectedName = selected ? (selected.business_name || `${selected.first_name} ${selected.last_name}`) : "";

  function handleSelect(customerId: string) {
    setSelectedId(customerId);
    setDropdownOpen(false);
    const c = customers?.find((c) => c.id === customerId);
    if (c) setSearch(c.business_name || `${c.first_name} ${c.last_name}`);
  }

  function reset() {
    setSearch("");
    setSelectedId("");
    setDropdownOpen(false);
  }

  async function handleMerge() {
    if (!selectedId) {
      toast({ title: "Missing info", description: "Please select the duplicate customer to merge.", variant: "destructive" });
      return;
    }
    setMerging(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/customers/${primaryCustomerId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duplicate_customer_id: selectedId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to merge customers");
      }
      const result = await res.json().catch(() => ({})) as {
        success?: boolean;
        filled_fields?: string[];
        unmigrated?: Record<string, number>;
        error?: string;
      };
      if (result.success === false) {
        const tables = Object.keys(result.unmigrated || {}).join(", ");
        throw new Error(result.error || `Merge incomplete — some records could not be moved (${tables}). The duplicate was left active so you can retry.`);
      }
      const filledDescription = result.filled_fields && result.filled_fields.length > 0
        ? ` Filled in missing ${result.filled_fields.join(", ")} from the duplicate.`
        : "";
      toast({ title: "Customers merged", description: `${selectedName} was merged into ${primaryCustomerName}. All jobs, invoices, quotes and other records have been moved.${filledDescription}` });
      onOpenChange(false);
      reset();
      onMerged?.();
    } catch (e) {
      toast({ title: "Merge failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-primary" />
            Merge Duplicate Customer
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Search for the duplicate customer record. All of its jobs, invoices, quotes,
            properties, maintenance plans and other history will be moved onto{" "}
            <strong>{primaryCustomerName}</strong>, and the duplicate will be deactivated.
            Any contact details (email, phone, address) that are blank on {primaryCustomerName}
            will be filled in from the duplicate — existing values are never overwritten.
          </p>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Duplicate customer to merge in</Label>
          <div className="relative">
            <Input
              placeholder="Name, phone, email or postcode…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedId(""); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              autoComplete="off"
              autoFocus
            />
            {dropdownOpen && filtered.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
                {filtered.map((c) => (
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
            {dropdownOpen && search.length > 0 && filtered.length === 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-white shadow-lg px-3 py-2 text-sm text-muted-foreground">
                No customers found
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>{selectedName}</strong> will be deactivated and all of its data moved onto{" "}
              <strong>{primaryCustomerName}</strong>. This cannot be undone automatically.
            </p>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button type="button" onClick={handleMerge} disabled={merging || !selectedId}>
            {merging ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Merging…</>
            ) : (
              <><GitMerge className="w-4 h-4 mr-2" /> Merge</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
