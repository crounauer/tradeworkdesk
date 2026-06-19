import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Copy, ImageIcon, FolderOpen } from "lucide-react";

const TEMPLATE_FALLBACKS = [
  { slug: "classic",      name: "Classic" },
  { slug: "modern",       name: "Modern" },
  { slug: "bold",         name: "Bold" },
  { slug: "professional", name: "Professional" },
  { slug: "minimal",      name: "Minimal" },
];

interface WebsiteTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
}

interface Asset {
  name: string;
  url: string;
  size?: number;
  created_at?: string;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TemplateAssets({ templateId }: { templateId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: [`/api/platform/template-assets/${templateId}`],
    queryFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/platform/template-assets/${templateId}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) =>
      fetch(
        `${import.meta.env.BASE_URL}api/platform/template-assets/${templateId}/${encodeURIComponent(filename)}`,
        { method: "DELETE", credentials: "include" }
      ).then((r) => { if (!r.ok) throw new Error("Delete failed"); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/platform/template-assets/${templateId}`] });
      toast({ title: "Deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/platform/template-assets/${templateId}`,
          { method: "POST", body: formData, credentials: "include" }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }
      }
      qc.invalidateQueries({ queryKey: [`/api/platform/template-assets/${templateId}`] });
      toast({ title: `${files.length} file${files.length > 1 ? "s" : ""} uploaded` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assets.length} asset{assets.length !== 1 ? "s" : ""}
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Upload Assets</>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : assets.length === 0 ? (
        <div
          className="border-2 border-dashed rounded-lg p-10 text-center text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No assets yet — click to upload</p>
          <p className="text-xs mt-1">JPG, PNG, WebP, SVG, GIF up to 10MB</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {assets.map((asset) => (
            <div key={asset.name} className="group relative border rounded-lg overflow-hidden bg-muted/30">
              {asset.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="w-full h-28 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-28 flex items-center justify-center bg-muted">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-medium truncate" title={asset.name}>{asset.name}</p>
                {asset.size && <p className="text-xs text-muted-foreground">{formatBytes(asset.size)}</p>}
              </div>
              <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                <button
                  className="bg-white/90 rounded p-1 shadow hover:bg-white"
                  onClick={() => copyUrl(asset.url)}
                  title="Copy URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  className="bg-white/90 rounded p-1 shadow hover:bg-destructive hover:text-white"
                  onClick={() => deleteMutation.mutate(asset.name)}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlatformTemplates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTemplate, setActiveTemplate] = useState(TEMPLATE_FALLBACKS[0].slug);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<WebsiteTemplate[]>({
    queryKey: ["/api/platform/website-templates"],
    queryFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/platform/website-templates`, {
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to load templates");
        return r.json();
      }),
  });

  const templateItems = templates.length
    ? templates
    : TEMPLATE_FALLBACKS.map((t, idx) => ({
        id: t.slug,
        slug: t.slug,
        name: t.name,
        is_active: true,
        sort_order: idx,
      }));

  useEffect(() => {
    if (!templateItems.length) return;
    const selectedStillExists = templateItems.some((t) => t.slug === activeTemplate);
    if (!selectedStillExists) {
      setActiveTemplate(templateItems[0].slug);
    }
  }, [templateItems, activeTemplate]);

  const toggleTemplateMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/website-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update template" }));
        throw new Error(err.error || "Failed to update template");
      }
      return res.json();
    },
    onSuccess: (updated: WebsiteTemplate) => {
      qc.invalidateQueries({ queryKey: ["/api/platform/website-templates"] });
      toast({ title: updated.is_active ? "Template set live" : "Template taken offline" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const selectedTemplate = templateItems.find((t) => t.slug === activeTemplate);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Website Templates</h1>
        <p className="text-muted-foreground mt-1">
          Upload Figma design assets for each template and control when each template is live.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Live Controls</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading templates...
            </div>
          ) : (
            <div className="space-y-2">
              {templateItems.map((template) => (
                <div key={template.slug} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Live" : "Offline"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={template.is_active ? "outline" : "default"}
                      disabled={!templates.length || toggleTemplateMutation.isPending}
                      onClick={() => toggleTemplateMutation.mutate({ id: template.id, is_active: !template.is_active })}
                    >
                      {template.is_active ? "Take Offline" : "Make Live"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {templateItems.map((t) => (
          <Button
            key={t.slug}
            variant={activeTemplate === t.slug ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTemplate(t.slug)}
          >
            {t.name}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize flex items-center gap-2">
            {activeTemplate} Template Assets
            {selectedTemplate && (
              <Badge variant={selectedTemplate.is_active ? "default" : "secondary"}>
                {selectedTemplate.is_active ? "Live" : "Offline"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateAssets key={activeTemplate} templateId={activeTemplate} />
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Using assets in template code</p>
          <code className="text-xs bg-background border rounded px-2 py-1 block">
            {`// Reference uploaded assets by their public URL (copy with the copy button above)`}<br />
            {`// Or use the Supabase Storage path: website-template-assets/${activeTemplate}/filename.jpg`}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
