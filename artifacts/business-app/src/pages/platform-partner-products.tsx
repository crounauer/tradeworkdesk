import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, X, Save, Trash2, ExternalLink, Handshake } from "lucide-react";

interface PartnerProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  partner_name: string | null;
  description_short: string;
  description_long: string | null;
  cta_label: string;
  partner_url: string;
  logo_url: string | null;
  disclosure_text: string;
  commission_model: string;
  audience_tags: string[];
  placement_keys: string[];
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
}

interface PartnerProductAnalytics {
  days: number;
  since: string;
  total_clicks: number;
  placement_breakdown: Array<{ placement_key: string; clicks: number }>;
  top_products: Array<{ id: string; name: string; slug: string; clicks: number }>;
}

interface PartnerProductFormState {
  slug: string;
  name: string;
  category: string;
  partner_name: string;
  description_short: string;
  description_long: string;
  cta_label: string;
  partner_url: string;
  logo_url: string;
  disclosure_text: string;
  commission_model: string;
  audience_tags: string;
  placement_keys: string;
  is_active: boolean;
  priority: number | string;
  starts_at: string;
  ends_at: string;
}

const EMPTY_FORM: PartnerProductFormState = {
  slug: "",
  name: "",
  category: "insurance",
  partner_name: "",
  description_short: "",
  description_long: "",
  cta_label: "Learn more",
  partner_url: "",
  logo_url: "",
  disclosure_text: "We may earn a commission if you buy through this link.",
  commission_model: "affiliate",
  audience_tags: "",
  placement_keys: "help",
  is_active: true,
  priority: 0,
  starts_at: "",
  ends_at: "",
};

function toPayload(form: PartnerProductFormState) {
  return {
    slug: form.slug.trim().toLowerCase(),
    name: form.name.trim(),
    category: form.category.trim().toLowerCase(),
    partner_name: form.partner_name.trim() || null,
    description_short: form.description_short.trim(),
    description_long: form.description_long.trim() || null,
    cta_label: form.cta_label.trim() || "Learn more",
    partner_url: form.partner_url.trim(),
    logo_url: form.logo_url.trim() || null,
    disclosure_text: form.disclosure_text.trim() || "We may earn a commission if you buy through this link.",
    commission_model: form.commission_model.trim() || "affiliate",
    audience_tags: form.audience_tags.split(",").map((s) => s.trim()).filter(Boolean),
    placement_keys: form.placement_keys.split(",").map((s) => s.trim()).filter(Boolean),
    is_active: form.is_active,
    priority: Number(form.priority) || 0,
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
  };
}

export default function PlatformPartnerProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerProductFormState>(EMPTY_FORM);

  const { data: products, isLoading } = useQuery({
    queryKey: ["platform-partner-products"],
    queryFn: async () => {
      const res = await fetch("/api/platform/partner-products");
      if (!res.ok) throw new Error("Failed to load partner products");
      return res.json() as Promise<PartnerProduct[]>;
    },
  });

  const { data: analytics } = useQuery<PartnerProductAnalytics>({
    queryKey: ["platform-partner-products-analytics", 30],
    queryFn: async () => {
      const res = await fetch("/api/platform/partner-products/analytics?days=30");
      if (!res.ok) throw new Error("Failed to load partner product analytics");
      return res.json() as Promise<PartnerProductAnalytics>;
    },
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/partner-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to create partner product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-products"] });
      toast({ title: "Partner product created" });
      setShowNew(false);
      setForm(EMPTY_FORM);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/partner-products/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to update partner product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-products"] });
      toast({ title: "Partner product updated" });
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/platform/partner-products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to delete partner product");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-products"] });
      toast({ title: "Partner product deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function startEdit(product: PartnerProduct) {
    setForm({
      slug: product.slug,
      name: product.name,
      category: product.category,
      partner_name: product.partner_name || "",
      description_short: product.description_short,
      description_long: product.description_long || "",
      cta_label: product.cta_label,
      partner_url: product.partner_url,
      logo_url: product.logo_url || "",
      disclosure_text: product.disclosure_text,
      commission_model: product.commission_model,
      audience_tags: (product.audience_tags || []).join(", "),
      placement_keys: (product.placement_keys || []).join(", "),
      is_active: product.is_active,
      priority: product.priority,
      starts_at: product.starts_at ? product.starts_at.slice(0, 10) : "",
      ends_at: product.ends_at ? product.ends_at.slice(0, 10) : "",
    });
    setEditingId(product.id);
    setShowNew(false);
  }

  function resetForm() {
    setShowNew(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Partner Products</h1>
          <p className="text-muted-foreground mt-1">Manage optional partner recommendations shown in tenant experiences.</p>
        </div>
        {!showNew && !editingId && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Partner Product
          </Button>
        )}
      </div>

      {(showNew || editingId) && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-bold">{showNew ? "New Partner Product" : "Edit Partner Product"}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Van Insurance" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="van-insurance" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="insurance" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Partner Name</Label>
                <Input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="Example Partner Ltd" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Partner URL</Label>
                <Input value={form.partner_url} onChange={(e) => setForm({ ...form, partner_url: e.target.value })} placeholder="https://partner.example" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Short Description</Label>
              <Textarea value={form.description_short} onChange={(e) => setForm({ ...form, description_short: e.target.value })} rows={2} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Long Description</Label>
              <Textarea value={form.description_long} onChange={(e) => setForm({ ...form, description_long: e.target.value })} rows={3} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CTA Label</Label>
                <Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="Learn more" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Placement Keys (comma-separated)</Label>
                <Input value={form.placement_keys} onChange={(e) => setForm({ ...form, placement_keys: e.target.value })} placeholder="help, finance" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Audience Tags (comma-separated)</Label>
                <Input value={form.audience_tags} onChange={(e) => setForm({ ...form, audience_tags: e.target.value })} placeholder="sole_trader, heating" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Commission Model</Label>
                <Input value={form.commission_model} onChange={(e) => setForm({ ...form, commission_model: e.target.value })} placeholder="affiliate" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Disclosure Text</Label>
              <Input value={form.disclosure_text} onChange={(e) => setForm({ ...form, disclosure_text: e.target.value })} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(value) => setForm({ ...form, is_active: value })} />
              <Label className="text-xs">Active</Label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => (showNew ? createMutation.mutate() : updateMutation.mutate())}
                disabled={createMutation.isPending || updateMutation.isPending || !form.name || !form.slug || !form.partner_url || !form.description_short}
              >
                <Save className="w-3 h-3 mr-1" />
                {showNew ? "Create" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                <X className="w-3 h-3 mr-1" />Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="w-4 h-4" /> Partner Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card className="border border-border">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Clicks (last {analytics.days} days)</p>
                  <p className="text-2xl font-semibold">{analytics.total_clicks}</p>
                </CardContent>
              </Card>

              <Card className="border border-border sm:col-span-2">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Top placements</p>
                  {analytics.placement_breakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No placement clicks yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {analytics.placement_breakdown.slice(0, 5).map((row) => (
                        <Badge key={row.placement_key} variant="outline">
                          {row.placement_key}: {row.clicks}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border sm:col-span-3">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Top clicked partner products</p>
                  {analytics.top_products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No partner clicks yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {analytics.top_products.slice(0, 6).map((row) => (
                        <div key={row.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-sm">
                          <span className="truncate mr-2">{row.name}</span>
                          <Badge variant="secondary">{row.clicks}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading partner products…</p>
          ) : !products || products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No partner products yet.</p>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <Card key={product.id} className="border border-border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.slug}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{product.category}</Badge>
                        <Badge variant={product.is_active ? "default" : "outline"}>{product.is_active ? "Active" : "Inactive"}</Badge>
                        <Badge variant="outline">Priority {product.priority}</Badge>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{product.description_short}</p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Placements: {(product.placement_keys || []).join(", ") || "none"}</span>
                      <span>Audience: {(product.audience_tags || []).join(", ") || "all"}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(product)}>
                        <Pencil className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={product.partner_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />Open
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm("Delete this partner product?")) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}