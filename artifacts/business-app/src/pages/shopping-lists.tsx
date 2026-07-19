import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Plus, ShoppingCart, Wand2 } from "lucide-react";

interface ShoppingList {
  id: string;
  title: string;
  status: "draft" | "active" | "partially_purchased" | "complete" | "archived";
  created_at: string;
  updated_at: string;
}

interface ShoppingListItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_estimate: number | null;
  status: "needed" | "ordered" | "purchased" | "unavailable";
  source_type: "invoice_line_item" | "job_part" | "manual";
  source_ref: string | null;
  notes: string | null;
}

interface ShoppingListDetail extends ShoppingList {
  items: ShoppingListItem[];
}

interface CompanySettingsLite {
  technicians_can_update_shopping_list_items?: boolean | null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  return res.json() as Promise<T>;
}

function statusClass(status: ShoppingList["status"]): string {
  if (status === "active") return "bg-blue-100 text-blue-700";
  if (status === "partially_purchased") return "bg-amber-100 text-amber-700";
  if (status === "complete") return "bg-green-100 text-green-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-700";
}

function itemStatusClass(status: ShoppingListItem["status"]): string {
  if (status === "purchased") return "bg-green-100 text-green-700";
  if (status === "ordered") return "bg-blue-100 text-blue-700";
  if (status === "unavailable") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

export default function ShoppingListsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const canManage = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";
  const canConfigureTechUpdates = profile?.role === "admin" || profile?.role === "super_admin";
  const isTechnician = profile?.role === "technician";
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | ShoppingList["status"]>("open");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [generateTitle, setGenerateTitle] = useState("");
  const [invoiceIdsCsv, setInvoiceIdsCsv] = useState("");
  const [includeToOrderParts, setIncludeToOrderParts] = useState(true);

  const [manualItemName, setManualItemName] = useState("");
  const [manualItemQty, setManualItemQty] = useState("1");
  const [manualItemEstimate, setManualItemEstimate] = useState("");
  const [manualItemNotes, setManualItemNotes] = useState("");

  const { data: lists = [], isLoading: listsLoading } = useQuery<ShoppingList[]>({
    queryKey: ["shopping-lists", statusFilter],
    queryFn: () => apiFetch<ShoppingList[]>(`/shopping-lists?status=${statusFilter}`),
  });

  const { data: companySettings } = useQuery<CompanySettingsLite>({
    queryKey: ["company-settings-lite", "shopping-lists"],
    queryFn: () => apiFetch<CompanySettingsLite>("/company-settings"),
  });

  const techUpdatesEnabled = companySettings?.technicians_can_update_shopping_list_items !== false;

  const effectiveListId = selectedListId || lists[0]?.id || null;

  const { data: selectedList, isLoading: detailLoading } = useQuery<ShoppingListDetail | null>({
    queryKey: ["shopping-list", effectiveListId],
    queryFn: () => {
      if (!effectiveListId) return Promise.resolve(null);
      return apiFetch<ShoppingListDetail>(`/shopping-lists/${effectiveListId}`);
    },
    enabled: !!effectiveListId,
  });

  const createListMutation = useMutation({
    mutationFn: () => apiFetch<ShoppingList>("/shopping-lists", {
      method: "POST",
      body: JSON.stringify({ title: newTitle || undefined }),
    }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      setSelectedListId(created.id);
      setNewTitle("");
      toast({ title: "Shopping list created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      const invoiceIds = invoiceIdsCsv
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      return apiFetch<{ list: ShoppingList; item_count: number }>("/shopping-lists/generate", {
        method: "POST",
        body: JSON.stringify({
          title: generateTitle || undefined,
          invoice_ids: invoiceIds,
          include_to_order_parts: includeToOrderParts,
        }),
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      setSelectedListId(result.list.id);
      setGenerateTitle("");
      setInvoiceIdsCsv("");
      toast({ title: "Shopping list generated", description: `${result.item_count} items added` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addManualItemMutation = useMutation({
    mutationFn: () => {
      if (!effectiveListId) throw new Error("No shopping list selected");
      return apiFetch<ShoppingListItem>(`/shopping-lists/${effectiveListId}/items`, {
        method: "POST",
        body: JSON.stringify({
          item_name: manualItemName,
          quantity: Number(manualItemQty || "1"),
          unit_estimate: manualItemEstimate ? Number(manualItemEstimate) : null,
          notes: manualItemNotes || null,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list", effectiveListId] });
      setManualItemName("");
      setManualItemQty("1");
      setManualItemEstimate("");
      setManualItemNotes("");
      toast({ title: "Item added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: ShoppingListItem["status"] }) => {
      if (!effectiveListId) throw new Error("No shopping list selected");
      return apiFetch<ShoppingListItem>(`/shopping-lists/${effectiveListId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list", effectiveListId] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateListStatusMutation = useMutation({
    mutationFn: (status: ShoppingList["status"]) => {
      if (!effectiveListId) throw new Error("No shopping list selected");
      return apiFetch<ShoppingList>(`/shopping-lists/${effectiveListId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      qc.invalidateQueries({ queryKey: ["shopping-list", effectiveListId] });
      toast({ title: "List status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTechToggleMutation = useMutation({
    mutationFn: (enabled: boolean) => apiFetch<CompanySettingsLite>("/admin/company-settings", {
      method: "PUT",
      body: JSON.stringify({ technicians_can_update_shopping_list_items: enabled }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings-lite", "shopping-lists"] });
      toast({ title: "Technician update setting saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totals = useMemo(() => {
    if (!selectedList?.items) return { items: 0, estimate: 0 };
    const estimate = selectedList.items.reduce((sum, item) => {
      if (item.unit_estimate == null) return sum;
      return sum + item.unit_estimate * Number(item.quantity || 0);
    }, 0);
    return { items: selectedList.items.length, estimate };
  }, [selectedList]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShoppingCart className="w-6 h-6" />Shopping Lists</h1>
        <p className="text-muted-foreground mt-1">Generate and manage purchasing lists from invoices and job parts.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Lists</h2>
              <select
                className="h-9 rounded border px-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="open">Open</option>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="partially_purchased">Partially Purchased</option>
                <option value="complete">Complete</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {listsLoading ? (
              <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading lists...</div>
            ) : lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shopping lists yet.</p>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className={`w-full text-left rounded border p-3 hover:bg-accent ${effectiveListId === list.id ? "border-primary" : ""}`}
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{list.title}</p>
                      <Badge className={statusClass(list.status)}>{list.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Updated {new Date(list.updated_at).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {canManage && (
            <>
              {canConfigureTechUpdates && (
                <Card className="p-4 space-y-3">
                  <h2 className="font-semibold">Permissions</h2>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Technicians can update item statuses</span>
                    <Checkbox
                      checked={techUpdatesEnabled}
                      onCheckedChange={(checked) => updateTechToggleMutation.mutate(checked === true)}
                      disabled={updateTechToggleMutation.isPending}
                    />
                  </label>
                </Card>
              )}

              <Card className="p-4 space-y-3">
                <h2 className="font-semibold">Create Empty List</h2>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Weekly merchants run" />
                <Button className="w-full" onClick={() => createListMutation.mutate()} disabled={createListMutation.isPending}>
                  {createListMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Create List
                </Button>
              </Card>

              <Card className="p-4 space-y-3">
                <h2 className="font-semibold">Generate from Data</h2>
                <div className="space-y-1.5">
                  <Label>List title (optional)</Label>
                  <Input value={generateTitle} onChange={(e) => setGenerateTitle(e.target.value)} placeholder="Parts to order this week" />
                </div>
                <div className="space-y-1.5">
                  <Label>Invoice IDs (comma separated, optional)</Label>
                  <Textarea value={invoiceIdsCsv} onChange={(e) => setInvoiceIdsCsv(e.target.value)} placeholder="uuid-1, uuid-2" rows={3} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={includeToOrderParts} onCheckedChange={(v) => setIncludeToOrderParts(v === true)} />
                  Include job parts marked to_order
                </label>
                <Button className="w-full" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}Generate List
                </Button>
              </Card>
            </>
          )}
        </div>

        <Card className="p-4 space-y-4 min-h-[520px]">
          {!effectiveListId ? (
            <div className="text-sm text-muted-foreground">Create or select a shopping list to view items.</div>
          ) : detailLoading || !selectedList ? (
            <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading list...</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{selectedList.title}</h2>
                  <p className="text-sm text-muted-foreground">{totals.items} items • Estimated total £{totals.estimate.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusClass(selectedList.status)}>{selectedList.status.replace("_", " ")}</Badge>
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateListStatusMutation.isPending || selectedList.status === "active"}
                        onClick={() => updateListStatusMutation.mutate("active")}
                      >
                        Set Active
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateListStatusMutation.isPending || selectedList.status === "complete"}
                        onClick={() => updateListStatusMutation.mutate("complete")}
                      >
                        Mark Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateListStatusMutation.isPending || selectedList.status === "archived"}
                        onClick={() => updateListStatusMutation.mutate("archived")}
                      >
                        Archive
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-left px-3 py-2">Qty</th>
                      <th className="text-left px-3 py-2">Unit</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedList.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">No items yet.</td></tr>
                    ) : selectedList.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.item_name}</p>
                          {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                        </td>
                        <td className="px-3 py-2">{Number(item.quantity).toFixed(3).replace(/\.000$/, "")}</td>
                        <td className="px-3 py-2">{item.unit_estimate == null ? "-" : `£${Number(item.unit_estimate).toFixed(2)}`}</td>
                        <td className="px-3 py-2">
                          <select
                            className={`h-8 rounded border px-2 text-xs ${itemStatusClass(item.status)}`}
                            value={item.status}
                            disabled={isTechnician && !techUpdatesEnabled}
                            onChange={(e) => updateItemMutation.mutate({ itemId: item.id, status: e.target.value as ShoppingListItem["status"] })}
                          >
                            <option value="needed">Needed</option>
                            <option value="ordered">Ordered</option>
                            <option value="purchased">Purchased</option>
                            <option value="unavailable">Unavailable</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.source_ref || item.source_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canManage && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-medium">Add Manual Item</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Item name</Label>
                      <Input value={manualItemName} onChange={(e) => setManualItemName(e.target.value)} placeholder="28mm copper fittings" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Quantity</Label>
                      <Input value={manualItemQty} onChange={(e) => setManualItemQty(e.target.value)} placeholder="1" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit estimate (optional)</Label>
                      <Input value={manualItemEstimate} onChange={(e) => setManualItemEstimate(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Notes (optional)</Label>
                      <Input value={manualItemNotes} onChange={(e) => setManualItemNotes(e.target.value)} placeholder="Preferred supplier: City Plumbing" />
                    </div>
                  </div>
                  <Button onClick={() => addManualItemMutation.mutate()} disabled={addManualItemMutation.isPending || !manualItemName.trim()}>
                    {addManualItemMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Item
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
