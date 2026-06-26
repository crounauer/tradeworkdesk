import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Loader2,
  Palette,
  Sparkles,
  SquareCheckBig,
  Layers3,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type Website = {
  id: string;
  site_name: string;
  template_id: string | null;
};

type WebsitePage = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

type Template = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  category: string | null;
  theme_json?: Record<string, unknown>;
};

class ApiRequestError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(
      (body as { error?: string }).error || `HTTP ${res.status}`,
      res.status,
      (body as { code?: string }).code,
    );
  }
  return body as T;
}

function TemplateTile({ template, active }: { template: Template; active: boolean }) {
  const previewHref = template.preview_url || `${API_BASE}/preview/templates/${template.slug}/`;

  return (
    <Card className={active ? "border-primary shadow-md" : ""}>
      <div className="aspect-[16/10] bg-muted overflow-hidden rounded-t-lg border-b">
        {template.thumbnail_url ? (
          <img src={template.thumbnail_url} alt={template.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-500">
            <Layers3 className="h-10 w-10" />
          </div>
        )}
      </div>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{template.name}</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground truncate">{template.slug}</div>
          </div>
          {active && <Badge variant="default">Current</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {template.category && <Badge variant="outline">{template.category}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {template.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3">{template.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No description provided.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={previewHref} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Preview
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WebsiteTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);

  const websiteQuery = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch<Website>(`${API_BASE}/website`).catch((error: Error) => {
      if (error.message.includes("404") || error.message.includes("No website")) return null;
      throw error;
    }),
  });

  const pagesQuery = useQuery<WebsitePage[]>({
    queryKey: ["/api/website/pages"],
    queryFn: () => apiFetch<WebsitePage[]>(`${API_BASE}/website/pages`).catch((error: Error) => {
      if (error.message.includes("404") || error.message.includes("Website not found")) return [];
      throw error;
    }),
  });

  const { data: templates = [], isLoading, isError: templatesError, error: templatesErrorDetail, refetch: refetchTemplates } = useQuery<Template[]>({
    queryKey: ["/api/website/templates"],
    queryFn: () => apiFetch<Template[]>(`${API_BASE}/website/templates`),
  });

  const website = websiteQuery.data ?? null;
  const pages = pagesQuery.data ?? [];

  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId) || null, [templates, selectedTemplateId]);
  const hasExistingPages = pages.length > 0;

  const applyMutation = useMutation({
    mutationFn: async ({ templateId, confirm }: { templateId: string; confirm: boolean }) => {
      return apiFetch<{ success: boolean; pages_created?: number; blocks_created?: number; website_id?: string }>(`${API_BASE}/website/templates/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmReplace: confirm }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/website"] });
      queryClient.invalidateQueries({ queryKey: ["/api/website/pages"] });
      setStatusMessage({ kind: "success", message: "Template applied successfully. Your website pages and theme have been updated." });
      toast({ title: "Template applied", description: "Your website has been updated from the selected template." });
    },
    onError: (error: Error) => {
      if (error instanceof ApiRequestError && error.code === "TENANT_PAGES_EXIST") {
        setReplaceDialogOpen(true);
      }
      setStatusMessage({ kind: "error", message: error.message });
      toast({ title: "Template apply failed", description: error.message, variant: "destructive" });
    },
  });

  const canApply = !!selectedTemplate;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-start gap-3">
        <Link href="/website">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Website Template
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Choose a template</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Pick from the published global website templates and apply one to your site.
            </p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <Alert variant={statusMessage.kind === "error" ? "destructive" : "default"}>
          <BadgeCheck className="h-4 w-4" />
          <AlertTitle>{statusMessage.kind === "error" ? "Apply failed" : "Template applied"}</AlertTitle>
          <AlertDescription>{statusMessage.message}</AlertDescription>
        </Alert>
      )}

      {(websiteQuery.isError || pagesQuery.isError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to fully load current website context</AlertTitle>
          <AlertDescription>
            {(websiteQuery.error as Error | undefined)?.message || (pagesQuery.error as Error | undefined)?.message || "Failed to load website details."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
              </CardContent>
            </Card>
          ) : templatesError ? (
            <Card>
              <CardContent className="space-y-3 py-10 text-center">
                <div className="text-sm text-muted-foreground">{(templatesErrorDetail as Error | undefined)?.message || "Failed to load published templates."}</div>
                <Button variant="outline" onClick={() => refetchTemplates()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No published templates are available yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <div key={template.id} onClick={() => setSelectedTemplateId(template.id)} className="cursor-pointer">
                  <TemplateTile template={template} active={template.id === selectedTemplateId} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <SquareCheckBig className="h-5 w-5" /> Apply template
              </CardTitle>
              <CardDescription>Review the selected template and confirm replacement if your site already has pages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="font-medium">Current website</div>
                <div className="mt-1 text-muted-foreground">{website?.site_name || "No website yet"}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {pages.length} page{pages.length === 1 ? "" : "s"} found
                </div>
              </div>

              {hasExistingPages && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Existing pages detected</AlertTitle>
                  <AlertDescription>
                    Applying a template will show a confirmation dialog and archive current pages first.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium">Selected template</div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="font-medium">{selectedTemplate?.name || "Choose a template"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{selectedTemplate?.description || "Select a published template from the list."}</div>
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!selectedTemplate || applyMutation.isPending || !canApply}
                onClick={() => {
                  if (!selectedTemplate) return;
                  if (hasExistingPages) {
                    setReplaceDialogOpen(true);
                    return;
                  }
                  applyMutation.mutate({ templateId: selectedTemplate.id, confirm: false });
                }}
              >
                {applyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                Use this template
              </Button>

              {selectedTemplate && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedTemplate.preview_url || `${API_BASE}/preview/templates/${selectedTemplate.slug}/`} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Preview template
                    </a>
                  </Button>
                  {selectedTemplate.category && <Badge variant="outline">{selectedTemplate.category}</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Palette className="h-5 w-5" /> Template styles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>Published templates are global, read-only designs. Applying one copies pages, blocks, and theme values into your tenant site.</div>
              <div>Preview links open the published template preview in a new tab when available.</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing website pages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive your current pages and clone pages from {selectedTemplate?.name || "the selected template"}. This action should be confirmed before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={applyMutation.isPending || !selectedTemplate}
              onClick={(event) => {
                event.preventDefault();
                if (!selectedTemplate) return;
                applyMutation.mutate(
                  { templateId: selectedTemplate.id, confirm: true },
                  {
                    onSuccess: () => setReplaceDialogOpen(false),
                  },
                );
              }}
            >
              {applyMutation.isPending ? "Applying..." : "Archive and apply template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
