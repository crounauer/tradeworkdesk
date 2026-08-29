import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, X, Check, Pencil, Trash2 } from "lucide-react";
import { useCatalogueSearch } from "@/hooks/use-catalogue-search";
import { defaultMoneyFormatter, type MoneyFormatter, type PartLine, type PartStatus } from "./types";

export interface PartsSectionProps {
  parts: PartLine[];
  onAdd: (part: Omit<PartLine, "key">) => void | Promise<void>;
  onUpdate: (key: string, patch: Partial<PartLine>, options?: { updateCataloguePrice?: boolean }) => void | Promise<void>;
  onDelete: (key: string) => void | Promise<void>;
  canEditCatalogue?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  formatMoney?: MoneyFormatter;
}

export function PartsSection({
  parts,
  onAdd,
  onUpdate,
  onDelete,
  canEditCatalogue = false,
  readOnly = false,
  loading = false,
  loadError = false,
  onRetry,
  formatMoney = defaultMoneyFormatter,
}: PartsSectionProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partPrice, setPartPrice] = useState("");
  const [partSerial, setPartSerial] = useState("");
  const [partStatus, setPartStatus] = useState<PartStatus>("fitted");
  const [catalogueItemId, setCatalogueItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingToCatalogue, setSavingToCatalogue] = useState(false);

  const [editingQtyKey, setEditingQtyKey] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [updateCataloguePrice, setUpdateCataloguePrice] = useState(false);

  const catalogue = useCatalogueSearch();
  const suggestionsOpen = catalogue.activeKey === "add";

  const resetForm = () => {
    setPartName("");
    setPartQty("1");
    setPartPrice("");
    setPartSerial("");
    setPartStatus("fitted");
    setCatalogueItemId(null);
    catalogue.clear();
  };

  const handleAdd = async () => {
    if (!partName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAdd({
        name: partName.trim(),
        quantity: Number(partQty) || 1,
        unitPrice: partPrice === "" ? null : Number(partPrice),
        serialNumber: partSerial.trim() || null,
        status: partStatus,
        catalogueItemId,
      });
      resetForm();
      setShowAdd(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToCatalogue = async () => {
    if (!partName.trim() || savingToCatalogue) return;
    setSavingToCatalogue(true);
    try {
      const created = await catalogue.addToCatalogue("product", partName, partPrice ? Number(partPrice) : null);
      setPartName(created.name);
      if (created.default_price != null) setPartPrice(String(created.default_price));
      setCatalogueItemId(created.id);
      catalogue.clear();
    } finally {
      setSavingToCatalogue(false);
    }
  };

  const fittedParts = parts.filter(p => p.status !== "to_order");
  const toOrderParts = parts.filter(p => p.status === "to_order");
  const partsSubtotal = fittedParts.reduce((sum, p) => sum + (Number(p.unitPrice) || 0) * p.quantity, 0);

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
        <h3 className="font-bold text-lg flex items-center gap-2 text-blue-600">
          <Package className="w-5 h-5" /> Parts Used
        </h3>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => { if (showAdd) resetForm(); setShowAdd(!showAdd); }}>
            {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Part</>}
          </Button>
        )}
      </div>

      {showAdd && !readOnly && (
        <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1 relative col-span-2 sm:col-span-1">
              <Label className="text-xs">Part Name *</Label>
              <Input
                value={partName}
                onChange={(e) => { setPartName(e.target.value); setCatalogueItemId(null); catalogue.search(e.target.value, "add", "product"); }}
                onBlur={() => setTimeout(() => catalogue.clear(), 200)}
                placeholder="Type to search catalogue..."
                autoComplete="off"
              />
              {suggestionsOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {catalogue.suggestions.length > 0 ? (
                    catalogue.suggestions.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex justify-between items-center"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPartName(p.name);
                          if (p.default_price != null) setPartPrice(String(p.default_price));
                          setCatalogueItemId(p.id);
                          catalogue.clear();
                        }}
                      >
                        <span>{p.name}</span>
                        {p.default_price != null && <span className="text-muted-foreground">{formatMoney(Number(p.default_price))}</span>}
                      </button>
                    ))
                  ) : (
                    <>
                      <div className="px-3 py-2 text-sm text-muted-foreground">No matching products found — type a custom name</div>
                      {canEditCatalogue && (
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-slate-100 flex items-center gap-1 border-t"
                          onMouseDown={(e) => { e.preventDefault(); handleAddToCatalogue(); }}
                          disabled={savingToCatalogue}
                        >
                          + {savingToCatalogue ? "Saving..." : `Add "${partName}" to catalogue`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input type="text" inputMode="decimal" value={partQty} onChange={(e) => setPartQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Price</Label>
              <Input type="text" inputMode="decimal" value={partPrice} onChange={(e) => setPartPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Serial Number</Label>
              <Input value={partSerial} onChange={(e) => setPartSerial(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Status:</span>
            <div className="flex rounded-md overflow-hidden border border-border text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 font-medium transition-colors ${partStatus === "fitted" ? "bg-emerald-500 text-white" : "bg-white text-muted-foreground hover:bg-slate-50"}`}
                onClick={() => setPartStatus("fitted")}
              >
                Fitted
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 font-medium border-l border-border transition-colors ${partStatus === "to_order" ? "bg-amber-400 text-white" : "bg-white text-muted-foreground hover:bg-slate-50"}`}
                onClick={() => setPartStatus("to_order")}
              >
                To Order
              </button>
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={submitting || !partName.trim()}>
            <Check className="w-4 h-4 mr-1" /> {submitting ? "Adding..." : "Add Part"}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading parts...</p>
      ) : loadError ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span>Parts could not be loaded.</span>
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
        </div>
      ) : parts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No parts recorded yet.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-2 sm:px-4 py-2 font-medium">Part</th>
                <th className="text-left px-2 sm:px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-2 sm:px-4 py-2 font-medium">Price</th>
                <th className="text-right px-2 sm:px-4 py-2 font-medium">Total</th>
                <th className="text-left px-2 sm:px-4 py-2 font-medium hidden sm:table-cell">Serial #</th>
                <th className="w-8 sm:w-10"></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.key} className={`border-b last:border-0 ${p.status === "to_order" ? "opacity-75" : ""}`}>
                  <td className="px-2 sm:px-4 py-2 break-words max-w-[120px] sm:max-w-none">
                    <div className="space-y-0.5">
                      <span>{p.name}</span>
                      <div>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => onUpdate(p.key, { status: p.status === "fitted" ? "to_order" : "fitted" })}
                          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
                            p.status !== "to_order"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          }`}
                        >
                          {p.status !== "to_order" ? "✓ Fitted" : "⏳ To Order"}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2">
                    {editingQtyKey === p.key ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text" inputMode="decimal"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveQty(p.key); if (e.key === "Escape") setEditingQtyKey(null); }}
                          className="w-14 h-7 text-xs"
                          autoFocus
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => saveQty(p.key)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingQtyKey(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : readOnly ? (
                      <span>{p.quantity}</span>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary inline-flex items-center gap-1"
                        onClick={() => { setEditingQtyKey(p.key); setEditQty(String(p.quantity)); }}
                      >
                        {p.quantity}
                        <Pencil className="w-3 h-3 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right">
                    {editingPriceKey === p.key ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <Input
                            type="text" inputMode="decimal"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") savePrice(p.key); if (e.key === "Escape") setEditingPriceKey(null); }}
                            className="w-16 h-7 text-xs"
                            autoFocus
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => savePrice(p.key)}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingPriceKey(null); setUpdateCataloguePrice(false); }}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {p.catalogueItemId && canEditCatalogue && (
                          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                            <input type="checkbox" checked={updateCataloguePrice} onChange={e => setUpdateCataloguePrice(e.target.checked)} className="w-3 h-3" />
                            Update catalogue
                          </label>
                        )}
                      </div>
                    ) : readOnly ? (
                      <span>{p.unitPrice != null ? formatMoney(Number(p.unitPrice)) : "—"}</span>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary inline-flex items-center gap-1"
                        onClick={() => { setEditingPriceKey(p.key); setEditPrice(p.unitPrice != null ? String(p.unitPrice) : ""); setUpdateCataloguePrice(false); }}
                      >
                        {p.unitPrice != null ? formatMoney(Number(p.unitPrice)) : "—"}
                        <Pencil className="w-3 h-3 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-right font-medium">
                    {p.unitPrice != null ? formatMoney(Number(p.unitPrice) * p.quantity) : "—"}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-muted-foreground hidden sm:table-cell">{p.serialNumber || "—"}</td>
                  <td className="px-1 sm:px-2 py-2">
                    {!readOnly && (
                      <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => onDelete(p.key)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {(partsSubtotal > 0 || toOrderParts.length > 0) && (
              <tfoot className="bg-slate-50 border-t">
                {partsSubtotal > 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 sm:px-4 py-2 font-semibold text-right">Parts Subtotal</td>
                    <td className="px-2 sm:px-4 py-2 font-bold text-right">{formatMoney(partsSubtotal)}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                {toOrderParts.length > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 sm:px-4 py-1.5 text-xs text-amber-600">
                      {toOrderParts.length} part{toOrderParts.length > 1 ? "s" : ""} to order — not included in subtotal
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}
