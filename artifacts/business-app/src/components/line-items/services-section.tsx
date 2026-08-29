import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Plus, X, Check, Pencil, Trash2 } from "lucide-react";
import { useCatalogueSearch } from "@/hooks/use-catalogue-search";
import { defaultMoneyFormatter, type MoneyFormatter, type ServiceLine } from "./types";

export interface ServicesSectionProps {
  services: ServiceLine[];
  onAdd: (service: Omit<ServiceLine, "key">) => void | Promise<void>;
  onUpdate: (key: string, patch: Partial<ServiceLine>, options?: { updateCataloguePrice?: boolean }) => void | Promise<void>;
  onDelete: (key: string) => void | Promise<void>;
  canEditCatalogue?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  formatMoney?: MoneyFormatter;
}

export function ServicesSection({
  services,
  onAdd,
  onUpdate,
  onDelete,
  canEditCatalogue = false,
  readOnly = false,
  loading = false,
  loadError = false,
  onRetry,
  formatMoney = defaultMoneyFormatter,
}: ServicesSectionProps) {
  const [serviceName, setServiceName] = useState("");
  const [serviceQty, setServiceQty] = useState("1");
  const [servicePrice, setServicePrice] = useState("");
  const [catalogueItemId, setCatalogueItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingToCatalogue, setSavingToCatalogue] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [editingQtyKey, setEditingQtyKey] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [updateCataloguePrice, setUpdateCataloguePrice] = useState(false);

  const catalogue = useCatalogueSearch();
  const suggestionsOpen = catalogue.activeKey === "add";

  const resetForm = () => {
    setServiceName("");
    setServiceQty("1");
    setServicePrice("");
    setCatalogueItemId(null);
    catalogue.clear();
  };

  const handleAdd = async () => {
    if (!serviceName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAdd({
        name: serviceName.trim(),
        quantity: Number(serviceQty) || 1,
        unitPrice: servicePrice === "" ? null : Number(servicePrice),
        catalogueItemId,
      });
      resetForm();
      nameInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToCatalogue = async () => {
    if (!serviceName.trim() || savingToCatalogue) return;
    setSavingToCatalogue(true);
    try {
      const created = await catalogue.addToCatalogue("service", serviceName, servicePrice ? Number(servicePrice) : null);
      setServiceName(created.name);
      if (created.default_price != null) setServicePrice(String(created.default_price));
      setCatalogueItemId(created.id);
      catalogue.clear();
    } finally {
      setSavingToCatalogue(false);
    }
  };

  const servicesSubtotal = services.reduce((sum, s) => sum + (Number(s.unitPrice) || 0) * s.quantity, 0);

  const saveQty = async (key: string) => {
    const qty = Number(editQty);
    if (!qty || qty <= 0) return;
    await onUpdate(key, { quantity: qty });
    setEditingQtyKey(null);
  };

  const savePrice = async (key: string) => {
    await onUpdate(key, { unitPrice: editPrice === "" ? null : Number(editPrice) }, { updateCataloguePrice });
    setEditingPriceKey(null);
    setUpdateCataloguePrice(false);
  };

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2 text-purple-600">
          <Wrench className="w-5 h-5" /> Services Offered
        </h3>
      </div>

      {!readOnly && (
        <div className="border rounded-lg p-3 mb-4 bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_80px_100px_auto] gap-2 items-end">
            <div className="space-y-1 relative col-span-2 sm:col-span-1">
              <Label className="text-xs">Service</Label>
              <Input
                ref={nameInputRef}
                value={serviceName}
                onChange={(e) => { setServiceName(e.target.value); setCatalogueItemId(null); catalogue.search(e.target.value, "add", "service"); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
                  if (e.key === "Escape") resetForm();
                }}
                onBlur={() => setTimeout(() => catalogue.clear(), 200)}
                placeholder="Add a service — type to search catalogue…"
                autoComplete="off"
              />
              {suggestionsOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {catalogue.suggestions.length > 0 ? (
                    catalogue.suggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex justify-between items-center"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setServiceName(s.name);
                          if (s.default_price != null) setServicePrice(String(s.default_price));
                          setCatalogueItemId(s.id);
                          catalogue.clear();
                        }}
                      >
                        <span>{s.name}</span>
                        {s.default_price != null && <span className="text-muted-foreground">{formatMoney(Number(s.default_price))}</span>}
                      </button>
                    ))
                  ) : (
                    <>
                      <div className="px-3 py-2 text-sm text-muted-foreground">No matching services — type a custom name</div>
                      {canEditCatalogue && (
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-slate-100 flex items-center gap-1 border-t"
                          onMouseDown={(e) => { e.preventDefault(); handleAddToCatalogue(); }}
                          disabled={savingToCatalogue}
                        >
                          + {savingToCatalogue ? "Saving..." : `Add "${serviceName}" to catalogue`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input
                type="text" inputMode="decimal" value={serviceQty}
                onChange={(e) => setServiceQty(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } if (e.key === "Escape") resetForm(); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Price</Label>
              <Input
                type="text" inputMode="decimal" value={servicePrice} placeholder="0.00"
                onChange={(e) => setServicePrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } if (e.key === "Escape") resetForm(); }}
              />
            </div>
            <Button size="sm" className="col-span-2 sm:col-span-1" onClick={handleAdd} disabled={submitting || !serviceName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> {submitting ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading services...</p>
      ) : loadError ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span>Services could not be loaded.</span>
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
        </div>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services recorded yet.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-2 sm:px-4 py-2 font-medium">Service</th>
                <th className="text-left px-2 sm:px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-2 sm:px-4 py-2 font-medium">Price</th>
                <th className="text-right px-2 sm:px-4 py-2 font-medium">Total</th>
                <th className="w-8 sm:w-10"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.key} className="border-b last:border-0">
                  <td className="px-2 sm:px-4 py-2 break-words max-w-[150px] sm:max-w-none">{s.name}</td>
                  <td className="px-2 sm:px-4 py-2">
                    {editingQtyKey === s.key ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text" inputMode="decimal"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveQty(s.key); if (e.key === "Escape") setEditingQtyKey(null); }}
                          className="w-14 h-7 text-xs"
                          autoFocus
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => saveQty(s.key)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingQtyKey(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : readOnly ? (
                      <span>{s.quantity}</span>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary inline-flex items-center gap-1"
                        onClick={() => { setEditingQtyKey(s.key); setEditQty(String(s.quantity)); }}
                      >
                        {s.quantity}
                        <Pencil className="w-3 h-3 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right">
                    {editingPriceKey === s.key ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <Input
                            type="text" inputMode="decimal"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") savePrice(s.key); if (e.key === "Escape") setEditingPriceKey(null); }}
                            className="w-16 h-7 text-xs"
                            autoFocus
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => savePrice(s.key)}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingPriceKey(null); setUpdateCataloguePrice(false); }}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {s.catalogueItemId && canEditCatalogue && (
                          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                            <input type="checkbox" checked={updateCataloguePrice} onChange={e => setUpdateCataloguePrice(e.target.checked)} className="w-3 h-3" />
                            Update catalogue
                          </label>
                        )}
                      </div>
                    ) : readOnly ? (
                      <span>{s.unitPrice != null ? formatMoney(Number(s.unitPrice)) : "—"}</span>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary inline-flex items-center gap-1"
                        onClick={() => { setEditingPriceKey(s.key); setEditPrice(s.unitPrice != null ? String(s.unitPrice) : ""); setUpdateCataloguePrice(false); }}
                      >
                        {s.unitPrice != null ? formatMoney(Number(s.unitPrice)) : "—"}
                        <Pencil className="w-3 h-3 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right font-medium">
                    {s.unitPrice != null ? formatMoney(Number(s.unitPrice) * s.quantity) : "—"}
                  </td>
                  <td className="px-1 sm:px-2 py-2">
                    {!readOnly && (
                      <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => onDelete(s.key)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {servicesSubtotal > 0 && (
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td colSpan={2} className="px-2 sm:px-4 py-2 font-semibold text-right">Services Subtotal</td>
                  <td className="px-2 sm:px-4 py-2 font-bold text-right" colSpan={2}>{formatMoney(servicesSubtotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}
