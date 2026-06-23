import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Archive, AlertCircle, ChevronRight, File, FolderOpen, Eye, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WebsiteTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
}

interface TemplateFile {
  name: string;
  type: "file" | "directory";
  path: string;
  size?: number;
  modified?: string;
  children?: TemplateFile[];
}

interface TemplateFilesResponse {
  templateId: string;
  templateName: string;
  files: TemplateFile[];
}

interface BuildStatus {
  status: 'idle' | 'building' | 'success' | 'failed';
  error?: string;
  completedAt?: string;
}

const templateLiveSettingKey = (slug: string) => `website_template_live_${slug}`;

function FileTreeItem({ file, level = 0 }: { file: TemplateFile; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = file.type === "directory" && file.children && file.children.length > 0;

  return (
    <div>
      <div className={`flex items-center gap-1 py-1 px-2 ml-${level * 2} hover:bg-muted/50 rounded`}
        style={{ marginLeft: `${level * 0.75}rem` }}>
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0 h-5 w-5 flex items-center justify-center"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        {!hasChildren && file.type === "directory" && <div className="w-5" />}
        {!hasChildren && file.type === "file" && <File className="w-4 h-4 text-muted-foreground" />}
        {hasChildren && <FolderOpen className="w-4 h-4 text-blue-500" />}
        <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
        {file.size && <span className="text-xs text-muted-foreground ml-auto">{formatBytes(file.size)}</span>}
      </div>
      {expanded && hasChildren && (
        <div>
          {file.children!.map((child) => (
            <FileTreeItem key={child.path} file={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TemplateZipUpload({ onUploadSuccess }: { onUploadSuccess: () => void }) {
  const { toast } = useToast();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");

  const deriveTemplateName = (fileName: string): string =>
    fileName
      .replace(/\.zip$/i, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const deriveDisplayName = (slug: string): string =>
    slug
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const uploadZipMutation = useMutation({
    mutationFn: async (file: File) => {
      const templateName = deriveTemplateName(file.name);
      if (!templateName) {
        throw new Error("Unable to derive a template name from the zip file");
      }

      const formData = new FormData();
      formData.append("zip", file);
      formData.append("name", templateName.trim());
      formData.append("displayName", deriveDisplayName(templateName));
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      formData.append("version", "1.0.0");

      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/templates/upload`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Failed to upload template");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template uploaded!", description: "Your template has been successfully uploaded." });
      setDescription("");
      if (zipInputRef.current) zipInputRef.current.value = "";
      onUploadSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      toast({ title: "Invalid file", description: "Please select a .zip file", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      await uploadZipMutation.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="w-5 h-5" /> Upload Template Package
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Upload a zip file containing your complete template. The zip must have a folder matching the template name.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="e.g., Clean, modern design with dark mode"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
            />
          </div>

          <div>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={handleZipSelect}
              disabled={uploading}
            />
            <Button
              onClick={() => zipInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading Template…</>
              ) : (
                <><Archive className="w-4 h-4 mr-2" /> Select ZIP File</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Maximum 50MB</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateFiles({ templateId }: { templateId: string }) {
  const { data: response, isLoading, error } = useQuery<TemplateFilesResponse>({
    queryKey: [`/api/templates/${templateId}/files`],
    queryFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/templates/${templateId}/files`).then((r) => {
        if (!r.ok) throw new Error("Failed to load template files");
        return r.json();
      }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !response?.files) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No template files found or error loading files.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-2 text-sm font-medium flex items-center gap-2">
        <Archive className="w-4 h-4" />
        Extracted Template Files
      </div>
      <div className="max-h-96 overflow-y-auto divide-y">
        {response.files.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">No files extracted</div>
        ) : (
          <div className="p-2">
            {response.files.map((file) => (
              <FileTreeItem key={file.path} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateBuildStatus({ templateSlug }: { templateSlug: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: buildStatus, refetch } = useQuery<BuildStatus>({
    queryKey: [`/api/admin/template-builds/${templateSlug}/status`],
    queryFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/admin/template-builds/${templateSlug}/status`, {
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to load build status");
        return r.json();
      }),
    refetchInterval: (query) => query.state.data?.status === 'building' ? 2000 : false,
  });

  const triggerBuild = useMutation({
    mutationFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/admin/template-builds/${templateSlug}`, {
        method: "POST",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Build started", description: "Template is being built…" });
      qc.invalidateQueries({ queryKey: [`/api/admin/template-builds/${templateSlug}/status`] });
      // poll until done
      const poll = setInterval(() => {
        refetch().then((r) => {
          if (r.data?.status !== 'building') clearInterval(poll);
        });
      }, 2000);
    },
    onError: () => {
      toast({ title: "Failed to start build", variant: "destructive" });
    },
  });

  const previewUrl = `${import.meta.env.BASE_URL}api/preview/templates/${templateSlug}/`;

  if (!buildStatus || buildStatus.status === 'idle') {
    return (
      <Button size="sm" variant="outline" onClick={() => triggerBuild.mutate()} disabled={triggerBuild.isPending}>
        {triggerBuild.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
        Build Preview
      </Button>
    );
  }

  if (buildStatus.status === 'building') {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        Building preview…
      </div>
    );
  }

  if (buildStatus.status === 'success') {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="default" onClick={() => window.open(previewUrl, '_blank')}>
          <Eye className="w-4 h-4 mr-1" />
          Preview
        </Button>
        <Button size="sm" variant="outline" onClick={() => triggerBuild.mutate()} disabled={triggerBuild.isPending}>
          Rebuild
        </Button>
      </div>
    );
  }

  if (buildStatus.status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          Build failed
        </span>
        <Button size="sm" variant="outline" onClick={() => triggerBuild.mutate()} disabled={triggerBuild.isPending}>
          Retry
        </Button>
      </div>
    );
  }

  return null;
}

export default function PlatformTemplates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTemplate, setActiveTemplate] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<WebsiteTemplate | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<WebsiteTemplate[]>({
    queryKey: ["/api/platform/website-templates"],
    queryFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/platform/website-templates`, {
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to load templates");
        return r.json();
      }),
    retry: false,
  });

  const { data: defaultTemplateSlug, isLoading: defaultTemplateLoading } = useQuery<string | null>({
    queryKey: ["/api/platform/settings/default_signup_template_slug"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/settings/default_signup_template_slug`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data?.value === "string" && data.value.trim().length > 0 ? data.value : null;
    },
  });

  const templateItems = templates;

  useEffect(() => {
    if (!templateItems.length) return;
    const selectedStillExists = templateItems.some((t) => t.slug === activeTemplate);
    if (!selectedStillExists) {
      setActiveTemplate(templateItems[0].slug);
    }
  }, [templateItems, activeTemplate]);

  const toggleTemplateMutation = useMutation({
    mutationFn: async ({ id, slug, is_active }: { id: string; slug: string; is_active: boolean }) => {
      // If the website-templates API route is unavailable, use platform settings fallback.
      if (!templates.length) {
        const res = await fetch(`${import.meta.env.BASE_URL}api/platform/settings/${templateLiveSettingKey(slug)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value: is_active ? "true" : "false" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to update template" }));
          throw new Error(err.error || "Failed to update template");
        }
        return { id, slug, is_active } as WebsiteTemplate;
      }

      const endpoints = [
        { url: `${import.meta.env.BASE_URL}api/platform/website-templates/${id}/status`, method: "POST" },
        { url: `${import.meta.env.BASE_URL}api/platform/website-templates/${id}`, method: "POST" },
        { url: `${import.meta.env.BASE_URL}api/platform/website-templates/${id}`, method: "PATCH" },
        { url: `${import.meta.env.BASE_URL}api/platform/website-templates/${id}/status`, method: "PATCH" },
      ] as const;

      let lastError = "Failed to update template";
      for (const ep of endpoints) {
        const res = await fetch(ep.url, {
          method: ep.method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_active }),
        });

        if (res.ok) return res.json();
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        lastError = err.error || `HTTP ${res.status}`;
      }

      throw new Error(lastError);
    },
    onSuccess: (updated: WebsiteTemplate) => {
      qc.invalidateQueries({ queryKey: ["/api/platform/website-templates"] });
      qc.invalidateQueries({ queryKey: ["/api/platform/settings/template-live-fallback"] });
      toast({ title: updated.is_active ? "Template set live" : "Template taken offline" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultTemplateMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/settings/default_signup_template_slug`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: slug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save default template" }));
        throw new Error(err.error || "Failed to save default template");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform/settings/default_signup_template_slug"] });
      toast({ title: "Default template updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/templates/${templateId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete template" }));
        throw new Error(err.error || "Failed to delete template");
      }
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ["/api/platform/website-templates"] });
      if (templateToDelete?.slug === activeTemplate) {
        const remaining = templateItems.filter((t) => t.id !== deletedId);
        if (remaining.length > 0) {
          setActiveTemplate(remaining[0].slug);
        }
      }
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      toast({ title: "Template deleted", description: "The template has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Website Templates</h1>
        <p className="text-muted-foreground mt-1">
          Upload Figma design assets for each template and control when each template is live.
        </p>
      </div>

      <TemplateZipUpload onUploadSuccess={() => qc.invalidateQueries({ queryKey: ["/api/platform/website-templates"] })} />

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
              {templateItems.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No uploaded templates found.
                </div>
              ) : templateItems.map((template) => (
                <div key={template.slug} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {template.name}
                        {defaultTemplateSlug === template.slug && <Badge variant="outline">Default for New Signups</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Live" : "Offline"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!template.is_active || setDefaultTemplateMutation.isPending || defaultTemplateLoading}
                        onClick={() => setDefaultTemplateMutation.mutate(template.slug)}
                      >
                        Set Default
                      </Button>
                      <Button
                        size="sm"
                        variant={template.is_active ? "outline" : "default"}
                        disabled={toggleTemplateMutation.isPending}
                        onClick={() => toggleTemplateMutation.mutate({ id: template.id, slug: template.slug, is_active: !template.is_active })}
                      >
                        {template.is_active ? "Take Offline" : "Make Live"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleteTemplateMutation.isPending}
                        onClick={() => {
                          setTemplateToDelete(template);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <TemplateBuildStatus templateSlug={template.slug} />
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

      {templateItems.length > 0 && activeTemplate && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-2">
                {activeTemplate} Template Folder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateFiles key={activeTemplate} templateId={activeTemplate} />
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
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{templateToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => templateToDelete && deleteTemplateMutation.mutate(templateToDelete.id)}
              disabled={deleteTemplateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
