/**
 * ImagePickerField — reusable image input for the website block editor.
 *
 * Renders:
 *  - A thumbnail preview of the current URL (if set)
 *  - An "Upload" button (file input → POST /api/website/media/upload)
 *  - A "Library" button (opens a dialog with all previously uploaded images)
 *  - A clear (×) button when a value is set
 *  - Optional `hint` text showing the recommended image size
 */
"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, ImageIcon, X, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MediaItem {
  id: string;
  file_name: string;
  public_url: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  alt_text: string | null;
  created_at: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** e.g. "Recommended: 1200 × 630 px" */
  hint?: string;
  /** e.g. "hero_image" — used for alt text default */
  fieldName?: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export function ImagePickerField({ label, value, onChange, hint, fieldName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch library images
  const { data: mediaItems = [], isLoading: libraryLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/website/media"],
    queryFn: () => apiFetch("/api/website/media"),
    enabled: libraryOpen,
    staleTime: 30_000,
  });

  // Delete media
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/website/media/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/website/media"] }),
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (fieldName) formData.append("alt_text", fieldName.replace(/_/g, " "));

      const res = await fetch("/api/website/media/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      const media: MediaItem = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/website/media"] });
      onChange(media.public_url);
      toast({ title: "Image uploaded and optimised" });
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fieldName, onChange, qc, toast]);

  const handleSelectFromLibrary = useCallback(() => {
    const item = mediaItems.find((m) => m.id === selectedId);
    if (item) {
      onChange(item.public_url);
      setLibraryOpen(false);
      setSelectedId(null);
    }
  }, [mediaItems, selectedId, onChange]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>

      {/* Current image preview */}
      {value && (
        <div className="relative rounded-md overflow-hidden border bg-muted/30 flex items-center gap-3 p-2">
          <img
            src={value}
            alt=""
            className="h-14 w-20 object-cover rounded flex-shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <p className="text-xs text-muted-foreground break-all line-clamp-2 flex-1 min-w-0">{value}</p>
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* URL input (manual paste) */}
      {!value && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or use Upload / Library"
          className="text-xs"
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading
            ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Uploading…</>
            : <><Upload className="w-3 h-3 mr-1.5" />Upload</>
          }
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setLibraryOpen(true)}
        >
          <ImageIcon className="w-3 h-3 mr-1.5" />Library
        </Button>
      </div>

      {/* Size hint */}
      {hint && (
        <p className="text-xs text-muted-foreground/70 italic">{hint}</p>
      )}

      {/* Library dialog */}
      <Dialog open={libraryOpen} onOpenChange={(o) => { setLibraryOpen(o); if (!o) setSelectedId(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Image Library</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {libraryLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : mediaItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No images uploaded yet</p>
                <p className="text-sm mt-1">Use the Upload button to add your first image.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
                {mediaItems.map((item) => (
                  <div
                    key={item.id}
                    className={`group relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                      selectedId === item.id
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  >
                    <img
                      src={item.public_url}
                      alt={item.alt_text || item.file_name}
                      className="w-full aspect-video object-cover bg-muted"
                    />
                    {selectedId === item.id && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                    {/* Delete button */}
                    <button
                      type="button"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-white rounded-full p-0.5"
                      title="Delete image"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this image from your library?")) {
                          deleteMutation.mutate(item.id);
                          if (value === item.public_url) onChange("");
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {/* Dimensions tooltip */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {item.width && item.height ? `${item.width}×${item.height}` : item.file_name}
                      {item.file_size ? ` · ${formatBytes(item.file_size)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="library-upload-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/website/media/upload", { method: "POST", body: formData });
                    if (!res.ok) throw new Error("Upload failed");
                    qc.invalidateQueries({ queryKey: ["/api/website/media"] });
                    toast({ title: "Image uploaded" });
                  } catch (err: unknown) {
                    toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              <label htmlFor="library-upload-input">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <span className="cursor-pointer">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                    Upload new image
                  </span>
                </Button>
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setLibraryOpen(false); setSelectedId(null); }}>
                Cancel
              </Button>
              <Button size="sm" disabled={!selectedId} onClick={handleSelectFromLibrary}>
                Use this image
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
