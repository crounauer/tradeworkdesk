import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Plus, ShoppingCart, Trash2 } from "lucide-react";

interface ShoppingList {
  id: string;
  title: string;
  status: "draft" | "active" | "partially_purchased" | "complete" | "archived";
  assignment_mode?: "unassigned" | "specific_technician" | "all_technicians";
  assigned_to?: string | null;
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

interface ShoppingListMyPermissions {
  can_create_own_shopping_lists: boolean;
}

interface TechnicianOption {
  id: string;
  full_name?: string | null;
  email?: string | null;
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

export default function ShoppingListsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const canManage = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";
  const canConfigureTechUpdates = profile?.role === "admin" || profile?.role === "super_admin";
  const isTechnician = profile?.role === "technician";
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | ShoppingList["status"]>("open");
  const [scopeFilter, setScopeFilter] = useState<"all" | "assigned_to_me" | "shared" | "unassigned">("all");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [includeJobProducts, setIncludeJobProducts] = useState(false);
  const [jobProductsScope, setJobProductsScope] = useState<"week" | "month" | "custom">("week");
  const [jobProductsStartDate, setJobProductsStartDate] = useState("");
  const [jobProductsEndDate, setJobProductsEndDate] = useState("");
  const [generateTitle, setGenerateTitle] = useState("");
  const [includeToOrderParts, setIncludeToOrderParts] = useState(true);
  const [createAssignmentMode, setCreateAssignmentMode] = useState<"unassigned" | "specific_technician" | "all_technicians">("unassigned");
  const [createAssignedTo, setCreateAssignedTo] = useState("");
  const [generateAssignmentMode, setGenerateAssignmentMode] = useState<"unassigned" | "specific_technician" | "all_technicians">("unassigned");
  const [generateAssignedTo, setGenerateAssignedTo] = useState("");
  const [editAssignmentMode, setEditAssignmentMode] = useState<"unassigned" | "specific_technician" | "all_technicians">("unassigned");
  const [editAssignedTo, setEditAssignedTo] = useState("");

  const [manualItemName, setManualItemName] = useState("");
  const [manualItemQty, setManualItemQty] = useState("1");
  const [manualItemEstimate, setManualItemEstimate] = useState("");
  const [manualItemNotes, setManualItemNotes] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<{ id: string; name: string; default_price: number | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchError, setSearchError] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [savingToCatalogue, setSavingToCatalogue] = useState(false);
  const productSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);

  const { data: lists = [], isLoading: listsLoading } = useQuery<ShoppingList[]>({
    queryKey: ["shopping-lists", statusFilter],
    queryFn: () => apiFetch<ShoppingList[]>(`/shopping-lists?status=${statusFilter}`),
  });

  const { data: companySettings } = useQuery<CompanySettingsLite>({
    queryKey: ["company-settings-lite", "shopping-lists"],
    queryFn: () => apiFetch<CompanySettingsLite>("/company-settings"),
  });

  const { data: myPermissions } = useQuery<ShoppingListMyPermissions>({
    queryKey: ["shopping-lists-me-permissions"],
    queryFn: () => apiFetch<ShoppingListMyPermissions>("/shopping-lists/me/permissions"),
  });

  const canCreateLists = canManage || (isTechnician && myPermissions?.can_create_own_shopping_lists === true);

  const { data: technicians = [] } = useQuery<TechnicianOption[]>({
    queryKey: ["shopping-lists-technicians"],
    queryFn: () => apiFetch<TechnicianOption[]>("/shopping-lists/technicians"),
    enabled: canCreateLists,
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

  const visibleLists = useMemo(() => {
    if (!isTechnician || scopeFilter === "all") return lists;
    return lists.filter((list) => {
      const mode = list.assignment_mode || (list.assigned_to ? "specific_technician" : "unassigned");
      if (scopeFilter === "assigned_to_me") return mode === "specific_technician" && list.assigned_to === profile?.id;
      if (scopeFilter === "shared") return mode === "all_technicians";
      if (scopeFilter === "unassigned") return mode === "unassigned";
      return true;
    });
  }, [isTechnician, scopeFilter, lists, profile?.id]);

  const createListMutation = useMutation({
    mutationFn: () => {
      if (canManage && createAssignmentMode === "specific_technician" && !createAssignedTo) {
        throw new Error("Select a technician for specific assignment");
      }
      return apiFetch<ShoppingList>("/shopping-lists", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle || undefined,
          assignment_mode: canManage ? createAssignmentMode : undefined,
          assigned_to: canManage && createAssignmentMode === "specific_technician" ? createAssignedTo : null,
          include_job_products: includeJobProducts,
          date_scope: includeJobProducts ? jobProductsScope : undefined,
          start_date: includeJobProducts && jobProductsScope === "custom" ? jobProductsStartDate : undefined,
          end_date: includeJobProducts && jobProductsScope === "custom" ? jobProductsEndDate : undefined,
        }),
      });
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      setSelectedListId(created.id);
      setNewTitle("");
      setIncludeJobProducts(false);
      setJobProductsScope("week");
      setJobProductsStartDate("");
      setJobProductsEndDate("");
      setCreateAssignmentMode("unassigned");
      setCreateAssignedTo("");
      toast({ title: "Shopping list created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!includeToOrderParts) {
        throw new Error("Job parts source must be enabled");
      }
      if (canManage && generateAssignmentMode === "specific_technician" && !generateAssignedTo) {
        throw new Error("Select a technician for specific assignment");
      }
      return apiFetch<{ list: ShoppingList; item_count: number }>("/shopping-lists/generate", {
        method: "POST",
        body: JSON.stringify({
          title: generateTitle || undefined,
          include_to_order_parts: includeToOrderParts,
          assignment_mode: canManage ? generateAssignmentMode : undefined,
          assigned_to: canManage && generateAssignmentMode === "specific_technician" ? generateAssignedTo : null,
        }),
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      setSelectedListId(result.list.id);
      setGenerateTitle("");
      setGenerateAssignmentMode("unassigned");
      setGenerateAssignedTo("");
      toast({ title: "Shopping list generated", description: `${result.item_count} items added` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const searchProducts = (query: string) => {
    if (productSearchTimeout.current) clearTimeout(productSearchTimeout.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    if (!query.trim()) {
      setProductSuggestions([]);
      setShowSuggestions(false);
      setSearchedQuery("");
      setSearchError(false);
      return;
    }

    productSearchTimeout.current = setTimeout(async () => {
      const seq = ++searchSeqRef.current;
      const abortCtrl = new AbortController();
      searchAbortRef.current = abortCtrl;
      try {
        setSearchError(false);
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`, {
          signal: abortCtrl.signal,
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error("Failed to search products");
        const payload: unknown = await response.json();
        const results = Array.isArray(payload) ? payload as { id: string; name: string; default_price: number | null }[] : [];
        if (seq !== searchSeqRef.current) return;
        setProductSuggestions(results);
        setSearchedQuery(query.trim());
        setShowSuggestions(true);
      } catch (e: unknown) {
        if (seq !== searchSeqRef.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setProductSuggestions([]);
        setSearchedQuery(query.trim());
        setSearchError(true);
        setShowSuggestions(true);
      }
    }, 250);
  };

  const selectProduct = (product: { id?: string; name: string; default_price: number | null }) => {
    setManualItemName(product.name);
    setSelectedProductId(product.id ?? null);
    setShowSuggestions(false);
  };

  const saveToCatalogue = async () => {
    const trimmedName = manualItemName.trim();
    if (!trimmedName || !canManage) return;
    setSavingToCatalogue(true);
    try {
      const created = await apiFetch<{ id: string; name: string; default_price: number | null }>('/admin/products', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName }),
      });
      setManualItemName(created.name);
      setSelectedProductId(created.id);
      setProductSuggestions([]);
      setShowSuggestions(false);
      setSearchedQuery("");
      setSearchError(false);
      toast({ title: 'Saved to product catalogue', description: `"${created.name}" added successfully` });
    } catch (err: unknown) {
      toast({ title: 'Failed to save', description: err instanceof Error ? err.message : 'Unable to save product', variant: 'destructive' });
    } finally {
      setSavingToCatalogue(false);
    }
  };

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
      setSelectedProductId(null);
      setProductSuggestions([]);
      setShowSuggestions(false);
      setSearchedQuery("");
      setSearchError(false);
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

  const toggleItemStatus = (item: ShoppingListItem) => {
    updateItemMutation.mutate({
      itemId: item.id,
      status: item.status === "purchased" ? "needed" : "purchased",
    });
  };

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!effectiveListId) throw new Error("No shopping list selected");
      return apiFetch<{ success: true }>(`/shopping-lists/${effectiveListId}/items/${itemId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list", effectiveListId] });
      toast({ title: "Item deleted" });
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

  const updateAssignmentMutation = useMutation({
    mutationFn: () => {
      if (!effectiveListId) throw new Error("No shopping list selected");
      if (editAssignmentMode === "specific_technician" && !editAssignedTo) {
        throw new Error("Select a technician for specific assignment");
      }
      return apiFetch<ShoppingList>(`/shopping-lists/${effectiveListId}`, {
        method: "PATCH",
        body: JSON.stringify({
          assignment_mode: editAssignmentMode,
          assigned_to: editAssignmentMode === "specific_technician" ? editAssignedTo : null,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      qc.invalidateQueries({ queryKey: ["shopping-list", effectiveListId] });
      toast({ title: "Assignment updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: string) => apiFetch<{ success: true }>(`/shopping-lists/${listId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      qc.removeQueries({ queryKey: ["shopping-list", effectiveListId] });
      setSelectedListId(null);
      toast({ title: "Shopping list deleted" });
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

  const totals = useMemo(() => ({
    items: selectedList?.items?.length ?? 0,
  }), [selectedList]);

  const scopeCounts = useMemo(() => {
    const counts = {
      all: lists.length,
      assigned_to_me: 0,
      shared: 0,
      unassigned: 0,
    };

    for (const list of lists) {
      const mode = list.assignment_mode || (list.assigned_to ? "specific_technician" : "unassigned");
      if (mode === "specific_technician" && list.assigned_to === profile?.id) counts.assigned_to_me += 1;
      else if (mode === "all_technicians") counts.shared += 1;
      else if (mode === "unassigned") counts.unassigned += 1;
    }

    return counts;
  }, [lists, profile?.id]);

  useEffect(() => {
    if (!selectedList) return;
    const mode = selectedList.assignment_mode || (selectedList.assigned_to ? "specific_technician" : "unassigned");
    setEditAssignmentMode(mode);
    setEditAssignedTo(selectedList.assigned_to || "");
  }, [selectedList?.id, selectedList?.assignment_mode, selectedList?.assigned_to]);

  const assignmentLabel = (list: ShoppingList): string => {
    const mode = list.assignment_mode || (list.assigned_to ? "specific_technician" : "unassigned");
    if (mode === "all_technicians") return "All technicians";
    if (mode === "specific_technician") {
      const tech = technicians.find((t) => t.id === list.assigned_to);
      return tech?.full_name || tech?.email || "Specific technician";
    }
    return "Unassigned";
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShoppingCart className="w-6 h-6" />Shopping Lists</h1>
        <p className="text-muted-foreground mt-1">Create lists and tick items off as you buy them.</p>
      </div>

      <div className="grid gap-6 min-w-0 xl:grid-cols-[370px_minmax(0,1fr)]">
        <div className="space-y-6 min-w-0">
          <Card className="p-3 sm:p-4 space-y-3 min-w-0">
            <div>
              <h2 className="font-semibold">Lists</h2>
            </div>

            {listsLoading ? (
              <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading lists...</div>
            ) : visibleLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shopping lists yet.</p>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-auto pr-1 min-w-0">
                {visibleLists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className={`w-full min-w-0 text-left rounded border p-2.5 sm:p-3 hover:bg-accent ${effectiveListId === list.id ? "border-primary" : ""}`}
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm break-words min-w-0">{list.title}</p>
                      <p className="text-xs text-muted-foreground shrink-0">{new Date(list.updated_at).toLocaleDateString()}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {canCreateLists && (
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">Create New List</h2>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Weekly merchants run" />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeJobProducts} onCheckedChange={(checked) => setIncludeJobProducts(checked === true)} />
                Include job products from selected period
              </label>
              {includeJobProducts && (
                <div className="space-y-2 rounded border p-3 text-sm">
                  <div className="space-y-1.5">
                    <Label>Period</Label>
                    <select
                      className="h-9 w-full rounded border px-2 text-sm"
                      value={jobProductsScope}
                      onChange={(e) => setJobProductsScope(e.target.value as "week" | "month" | "custom")}
                    >
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                      <option value="custom">Custom dates</option>
                    </select>
                  </div>
                  {jobProductsScope === "custom" && (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Start date</Label>
                        <Input type="date" value={jobProductsStartDate} onChange={(e) => setJobProductsStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>End date</Label>
                        <Input type="date" value={jobProductsEndDate} onChange={(e) => setJobProductsEndDate(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Button className="w-full h-10" onClick={() => createListMutation.mutate()} disabled={createListMutation.isPending}>
                {createListMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Create List
              </Button>
            </Card>
          )}
        </div>

        <Card className="p-3 sm:p-4 space-y-4 min-h-[520px] min-w-0">
          {!effectiveListId ? (
            <div className="text-sm text-muted-foreground">Create or select a shopping list to view items.</div>
          ) : detailLoading || !selectedList ? (
            <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading list...</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold break-words">{selectedList.title}</h2>
                  <p className="text-sm text-muted-foreground break-words">{totals.items} item{totals.items === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <Button
                      size="sm"
                      className="h-10 sm:h-9"
                      variant="destructive"
                      disabled={deleteListMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Delete this shopping list and all of its items?")) {
                          deleteListMutation.mutate(selectedList.id);
                        }
                      }}
                    >
                      {deleteListMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}Delete
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded border overflow-hidden">
                <div className="sm:hidden divide-y">
                  {selectedList.items.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">No items yet.</div>
                  ) : selectedList.items.map((item) => (
                    <div key={item.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">Qty {Number(item.quantity).toFixed(3).replace(/\.000$/, "")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-0 py-0 text-sm hover:bg-transparent"
                            disabled={(isTechnician && !techUpdatesEnabled) || updateItemMutation.isPending}
                            onClick={() => toggleItemStatus(item)}
                          >
                            <span className="flex items-center gap-2">
                              <Checkbox
                                checked={item.status === "purchased"}
                                disabled={(isTechnician && !techUpdatesEnabled) || updateItemMutation.isPending}
                                className="pointer-events-none"
                              />
                              <span>{item.status === "purchased" ? "Done" : "Need"}</span>
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={deleteItemMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete \"${item.item_name}\" from this shopping list?`)) {
                                deleteItemMutation.mutate(item.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-left px-3 py-2">Qty</th>
                        <th className="text-left px-3 py-2">Done</th>
                        <th className="text-right px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedList.items.length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">No items yet.</td></tr>
                      ) : selectedList.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.item_name}</p>
                          </td>
                          <td className="px-3 py-2">{Number(item.quantity).toFixed(3).replace(/\.000$/, "")}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-auto px-0 py-0 text-xs hover:bg-transparent"
                              disabled={(isTechnician && !techUpdatesEnabled) || updateItemMutation.isPending}
                              onClick={() => toggleItemStatus(item)}
                            >
                              <span className="flex items-center gap-2">
                                <Checkbox
                                  checked={item.status === "purchased"}
                                  disabled={(isTechnician && !techUpdatesEnabled) || updateItemMutation.isPending}
                                  className="pointer-events-none"
                                />
                                <span>{item.status === "purchased" ? "Done" : "Need"}</span>
                              </span>
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={deleteItemMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Delete \"${item.item_name}\" from this shopping list?`)) {
                                  deleteItemMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {canCreateLists && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-medium">Add Item</h3>
                  <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                    <div className="space-y-1.5 relative">
                      <Label>Item name</Label>
                      <Input
                        value={manualItemName}
                        onChange={(e) => {
                          setManualItemName(e.target.value);
                          searchProducts(e.target.value);
                        }}
                        onFocus={() => {
                          if (productSuggestions.length > 0) setShowSuggestions(true);
                        }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="28mm copper fittings"
                        autoComplete="off"
                      />
                      {showSuggestions && searchedQuery && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {searchError ? (
                            <div className="px-3 py-2 text-sm text-red-500">Failed to search catalogue</div>
                          ) : productSuggestions.length > 0 ? (
                            productSuggestions.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex justify-between items-center"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectProduct(product);
                                }}
                              >
                                <span>{product.name}</span>
                                {product.default_price != null && <span className="text-muted-foreground">£{Number(product.default_price).toFixed(2)}</span>}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No matching products found — type a custom name</div>
                          )}
                          {canManage && manualItemName.trim() && (
                            <div className="border-t px-3 py-2">
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded font-medium bg-purple-50 text-purple-700 hover:bg-purple-100"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  void saveToCatalogue();
                                }}
                                disabled={savingToCatalogue}
                              >
                                {savingToCatalogue ? 'Saving…' : `+ Save "${manualItemName.trim()}" as product`}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Qty</Label>
                      <Input value={manualItemQty} onChange={(e) => setManualItemQty(e.target.value)} placeholder="1" />
                    </div>
                  </div>
                  <Button className="h-10" onClick={() => addManualItemMutation.mutate()} disabled={addManualItemMutation.isPending || !manualItemName.trim()}>
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
