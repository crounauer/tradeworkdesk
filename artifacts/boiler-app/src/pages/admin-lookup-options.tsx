import { useState } from "react";
import { Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAllLookupOptions, useCreateLookupOption, useUpdateLookupOption, useDeleteLookupOption } from "@/hooks/use-lookup-options";
import type { LookupOption } from "@/hooks/use-lookup-options";
import { Plus, Trash2, Pencil, Check, X, Settings2 } from "lucide-react";

const CATEGORIES = [
  { key: "property_type", label: "Property Types" },
  { key: "occupancy_type", label: "Occupancy Types" },
  { key: "boiler_type", label: "Boiler Types" },
  { key: "fuel_type", label: "Fuel Types" },
];

export default function AdminLookupOptions() {
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("property_type");
  const { data: allOptions, isLoading } = useAllLookupOptions();
  const { toast } = useToast();
  const createMutation = useCreateLookupOption();
  const updateMutation = useUpdateLookupOption();
  const deleteMutation = useDeleteLookupOption();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  if (profile && profile.role !== "admin") {
    return <Redirect to="/" />;
  }

  const optionsForCategory = (allOptions || []).filter(
    (o) => o.category === activeCategory
  );

  const handleAdd = async () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    try {
      await createMutation.mutateAsync({
        category: addingTo!,
        value: newValue.trim().toLowerCase().replace(/\s+/g, "_"),
        label: newLabel.trim(),
        sort_order: optionsForCategory.length,
      });
      toast({ title: "Added", description: `"${newLabel.trim()}" added successfully.` });
      setNewLabel("");
      setNewValue("");
      setAddingTo(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editLabel.trim()) return;
    try {
      await updateMutation.mutateAsync({ id, label: editLabel.trim() });
      toast({ title: "Updated", description: "Option label updated." });
      setEditingId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggleActive = async (opt: LookupOption) => {
    try {
      await updateMutation.mutateAsync({ id: opt.id, is_active: !opt.is_active });
      toast({
        title: opt.is_active ? "Disabled" : "Enabled",
        description: `"${opt.label}" has been ${opt.is_active ? "disabled" : "enabled"}.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (opt: LookupOption) => {
    if (!confirm(`Delete "${opt.label}"? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(opt.id);
      toast({ title: "Deleted", description: `"${opt.label}" removed.` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const startEdit = (opt: LookupOption) => {
    setEditingId(opt.id);
    setEditLabel(opt.label);
  };

  const activeCategoryLabel = CATEGORIES.find((c) => c.key === activeCategory)?.label || "";

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Settings2 className="w-8 h-8 text-primary" /> Lookup Options
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage the dropdown options used throughout the app for property types, occupancy types, boiler types, and fuel types.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap border-b border-border/50 pb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setAddingTo(null); setEditingId(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <Card className="p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-lg">{activeCategoryLabel}</h2>
          {addingTo !== activeCategory && (
            <Button
              size="sm"
              onClick={() => { setAddingTo(activeCategory); setNewLabel(""); setNewValue(""); }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Option
            </Button>
          )}
        </div>

        {addingTo === activeCategory && (
          <div className="mb-6 p-4 border border-primary/20 rounded-xl bg-primary/5 space-y-3">
            <h3 className="font-semibold text-sm">New Option</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Display Label</Label>
                <Input
                  placeholder="e.g. Semi-Detached"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value (stored in database)</Label>
                <Input
                  placeholder="e.g. semi_detached"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <p className="text-xs text-muted-foreground">Use lowercase letters and underscores.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending || !newLabel.trim() || !newValue.trim()}>
                <Check className="w-4 h-4 mr-1" /> {createMutation.isPending ? "Adding..." : "Add"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingTo(null)}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : optionsForCategory.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Settings2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No options yet. Add your first one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {optionsForCategory.map((opt) => (
              <div
                key={opt.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  opt.is_active ? "border-border/50 bg-background" : "border-dashed border-border/30 bg-slate-50 opacity-60"
                }`}
              >
                {editingId === opt.id ? (
                  <>
                    <Input
                      className="flex-1 h-8 text-sm"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(opt.id)}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleUpdate(opt.id)} disabled={updateMutation.isPending}>
                      <Check className="w-4 h-4 text-emerald-600" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingId(null)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{opt.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{opt.value}</span>
                    </div>
                    {!opt.is_active && (
                      <span className="text-xs font-medium text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">Disabled</span>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => startEdit(opt)} title="Rename">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => handleToggleActive(opt)}
                      disabled={updateMutation.isPending}
                      title={opt.is_active ? "Disable" : "Enable"}
                    >
                      {opt.is_active ? (
                        <X className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => handleDelete(opt)}
                      disabled={deleteMutation.isPending}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
