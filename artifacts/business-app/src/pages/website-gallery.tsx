import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Image as ImageIcon, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ImagePickerField } from "@/components/image-picker-field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  alt_text: string | null;
  category: string | null;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

interface ImportableJobImage {
  id: string;
  file_name: string;
  signed_url: string;
  created_at: string;
  description: string | null;
  job_id: string;
  job_ref: string | null;
  job_description: string | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function WebsiteGalleryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);

  const { data: items = [], isLoading } = useQuery<GalleryItem[]>({
    queryKey: ["/api/website/gallery-items"],
    queryFn: () => apiFetch("/api/website/gallery-items"),
  });

  const { data: importable = [], isLoading: importLoading } = useQuery<ImportableJobImage[]>({
    queryKey: ["/api/website/gallery-items/importable-job-images"],
    queryFn: () => apiFetch("/api/website/gallery-items/importable-job-images"),
    enabled: importOpen,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiFetch("/api/website/gallery-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/gallery-items"] });
      toast({ title: "Gallery item added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => apiFetch(`/api/website/gallery-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/gallery-items"] });
      toast({ title: "Gallery item saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/website/gallery-items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/gallery-items"] });
      toast({ title: "Gallery item deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: () => apiFetch("/api/website/gallery-items/import-from-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachment_ids: selectedImportIds }),
    }),
    onSuccess: (res: { imported: number }) => {
      setImportOpen(false);
      setSelectedImportIds([]);
      qc.invalidateQueries({ queryKey: ["/api/website/gallery-items"] });
      toast({ title: "Images imported", description: `${res.imported} image${res.imported === 1 ? "" : "s"} added to gallery.` });
    },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const purgeMutation = useMutation({
    mutationFn: () => apiFetch("/api/website/media/purge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "PURGE_MEDIA" }),
    }),
    onSuccess: (res: { purged: number }) => {
      setPurgeOpen(false);
      qc.invalidateQueries({ queryKey: ["/api/website/gallery-items"] });
      qc.invalidateQueries({ queryKey: ["/api/website/media"] });
      toast({ title: "Media purged", description: `${res.purged} file${res.purged === 1 ? "" : "s"} permanently deleted.` });
    },
    onError: (e: Error) => toast({ title: "Purge failed", description: e.message, variant: "destructive" }),
  });

  const nextSortOrder = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.max(...items.map((item) => Number(item.sort_order || 0))) + 1;
  }, [items]);

  const [draft, setDraft] = useState({ image_url: "", caption: "", alt_text: "", category: "", is_visible: true });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Website Gallery</h1>
            <p className="text-sm text-muted-foreground">Manage gallery items, import job images, and control visibility.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />Import from Jobs</Button>
          <Button variant="destructive" onClick={() => setPurgeOpen(true)}>Permanently Purge Media</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add New Gallery Item</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ImagePickerField
            label="Image"
            value={draft.image_url}
            onChange={(url) => setDraft((d) => ({ ...d, image_url: url }))}
            hint="Recommended: 1600 x 1066 px (3:2) or 1200 x 900 px (4:3)."
            fieldName="gallery_item"
          />
          <Input value={draft.caption} onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))} placeholder="Caption (optional)" />
          <Input value={draft.alt_text} onChange={(e) => setDraft((d) => ({ ...d, alt_text: e.target.value }))} placeholder="Alt text (recommended)" />
          <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Category (optional)" />
          <div className="flex items-center justify-between">
            <Label className="text-sm">Visible on website</Label>
            <Switch checked={draft.is_visible} onCheckedChange={(v) => setDraft((d) => ({ ...d, is_visible: v }))} />
          </div>
          <Button
            onClick={() => createMutation.mutate({ ...draft, sort_order: nextSortOrder })}
            disabled={createMutation.isPending || !draft.image_url}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add to Gallery
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Gallery Items</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No gallery items yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <GalleryItemEditor
                  key={item.id}
                  item={item}
                  onSave={(payload) => updateMutation.mutate({ id: item.id, payload })}
                  onDelete={() => deleteMutation.mutate(item.id)}
                  saving={updateMutation.isPending}
                  deleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Import Images from Jobs</AlertDialogTitle>
            <AlertDialogDescription>
              Choose job images to copy into your website media library and add to gallery. Originals remain on the job records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {importLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : importable.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No importable job images found.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {importable.map((img) => {
                  const checked = selectedImportIds.includes(img.id);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setSelectedImportIds((prev) => checked ? prev.filter((id) => id !== img.id) : [...prev, img.id])}
                      className={`border rounded-md overflow-hidden text-left ${checked ? "ring-2 ring-primary border-primary" : "border-border"}`}
                    >
                      <img src={img.signed_url} alt={img.file_name} className="w-full aspect-video object-cover" />
                      <div className="p-2 text-xs">
                        <p className="font-medium truncate">{img.job_ref || "Job"}</p>
                        <p className="text-muted-foreground truncate">{img.file_name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); importMutation.mutate(); }}
              disabled={selectedImportIds.length === 0 || importMutation.isPending}
            >
              {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Import Selected ({selectedImportIds.length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={purgeOpen} onOpenChange={(o) => !purgeMutation.isPending && setPurgeOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently purge media library?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all website media files and gallery items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); purgeMutation.mutate(); }}
              disabled={purgeMutation.isPending}
            >
              {purgeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Purge Media Library
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GalleryItemEditor({
  item,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  item: GalleryItem;
  onSave: (payload: Record<string, unknown>) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [draft, setDraft] = useState(item);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <ImagePickerField
          label="Image"
          value={draft.image_url}
          onChange={(url) => setDraft((d) => ({ ...d, image_url: url }))}
          hint="Recommended: 1600 x 1066 px (3:2) or 1200 x 900 px (4:3)."
          fieldName={`gallery_${item.id}`}
        />
        <Input value={draft.caption || ""} onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))} placeholder="Caption" />
        <Input value={draft.alt_text || ""} onChange={(e) => setDraft((d) => ({ ...d, alt_text: e.target.value }))} placeholder="Alt text" />
        <Input value={draft.category || ""} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Category" />
        <div className="flex items-center justify-between">
          <Label className="text-sm">Visible on website</Label>
          <Switch checked={Boolean(draft.is_visible)} onCheckedChange={(v) => setDraft((d) => ({ ...d, is_visible: v }))} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onSave({
            image_url: draft.image_url,
            caption: draft.caption || null,
            alt_text: draft.alt_text || null,
            category: draft.category || null,
            sort_order: Number(draft.sort_order || 0),
            is_visible: Boolean(draft.is_visible),
          })} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
