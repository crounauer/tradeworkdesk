import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Archive,
  BadgeCheck,
  Eye,
  Loader2,
  PackageOpen,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type TemplateStatus = "uploaded" | "validated" | "draft" | "published" | "archived" | "failed";

type TemplateSummary = {
  id: string;
  name: string;
  slug: string;
  status?: TemplateStatus | string | null;
  is_active?: boolean | null;
  published_at?: string | null;
  page_count: number;
  block_count: number;
  uploaded_at?: string | null;
  created_at?: string | null;
  description?: string | null;
};

type ValidationReport = {
  valid: boolean;
  templateSlug: string | null;
  templateName: string | null;
  pagesFound: string[];
  blocksFound: number;
  warnings: string[];
  errors: string[];
  unsupportedBlockTypes?: string[];
  mappedBlockTypes?: string[];
};

type TemplateDetail = {
  template: {
    id: string;
    name?: string;
    slug?: string;
    status?: string;
    template_json?: Record<string, unknown>;
    theme_json?: Record<string, unknown>;
    cms_mapping_json?: Record<string, unknown>;
    created_at?: string | null;
    updated_at?: string | null;
  };
  pages: Array<Record<string, unknown>>;
  blocks: Array<Record<string, unknown>>;
  upload: Record<string, unknown> | null;
  versions: Array<Record<string, unknown>>;
  validation_report: ValidationReport | null;
};

type UploadResult = {
  success: boolean;
  template_id?: string;
  upload_id?: string;
  validation: ValidationReport;
  error?: string;
};

const API_BASE = `${import.meta.env.BASE_URL}api`;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(status: TemplateStatus) {
  return status.replace(/_/g, " ");
}

function normalizeTemplateStatus(template: Pick<TemplateSummary, "status" | "is_active" | "published_at">): TemplateStatus {
  const rawStatus = String(template.status || "").toLowerCase();

  // Support both legacy and current backend status values.
  if (rawStatus === "published" || rawStatus === "live" || template.is_active || template.published_at) {
    return "published";
  }

  if (rawStatus === "validated") return "validated";

  if (rawStatus === "uploaded" || rawStatus === "draft" || rawStatus === "archived" || rawStatus === "failed") {
    return rawStatus;
  }

  return "draft";
}

function statusVariant(status: TemplateStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "published") return "default";
  if (status === "validated" || status === "draft") return "secondary";
  if (status === "archived") return "outline";
  if (status === "failed") return "destructive";
  return "secondary";
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function UploadProgress({ value }: { value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Upload progress</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function TemplateDetailsDialog({
  open,
  onOpenChange,
  templateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<TemplateDetail>({
    queryKey: ["admin-website-template", templateId],
    enabled: open && !!templateId,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/admin/website-templates/${templateId}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to load template details");
      return body;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/admin/website-templates/${templateId}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to publish template");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-templates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-website-template", templateId] });
      toast({ title: "Template published" });
    },
    onError: (error: Error) => {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/admin/website-templates/${templateId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to archive template");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-templates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-website-template", templateId] });
      toast({ title: "Template archived" });
    },
    onError: (error: Error) => {
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    },
  });

  const templateJson = data?.template.template_json || {};
  const themeJson = data?.template.theme_json || {};
  const cmsMappingJson = data?.template.cms_mapping_json || {};

  const blocksByPage = useMemo(() => {
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    (data?.blocks || []).forEach((block) => {
      const pageId = String(block.page_id || "");
      const list = grouped.get(pageId) || [];
      list.push(block);
      grouped.set(pageId, list);
    });
    return grouped;
  }, [data?.blocks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden p-0">
        <div className="flex h-[92vh] flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-3">
              <PackageOpen className="h-5 w-5 text-primary" />
              <span>{data?.template.name || "Template details"}</span>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading details…
            </div>
          ) : isError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Failed to load template details</AlertTitle>
                <AlertDescription className="space-y-3">
                  <div>{(error as Error | undefined)?.message || "Unable to load template details."}</div>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : !data ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              No template details found.
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-6 p-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Slug</CardDescription>
                      <CardTitle className="text-base">{data.template.slug || "—"}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Pages</CardDescription>
                      <CardTitle className="text-base">{data.pages.length}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Blocks</CardDescription>
                      <CardTitle className="text-base">{data.blocks.length}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Updated</CardDescription>
                      <CardTitle className="text-base">{formatDate(data.template.updated_at || data.template.created_at)}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="pages">Pages & Blocks</TabsTrigger>
                    <TabsTrigger value="validation">Validation</TabsTrigger>
                    <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div><span className="text-muted-foreground">Name:</span> {data.template.name || "—"}</div>
                          <div><span className="text-muted-foreground">Slug:</span> {data.template.slug || "—"}</div>
                          <div><span className="text-muted-foreground">Status:</span> {normalizeTemplateStatus(data.template as Pick<TemplateSummary, "status" | "is_active" | "published_at">)}</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Theme basics</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="overflow-auto rounded-lg bg-muted/30 p-4 text-xs leading-relaxed">{prettyJson(themeJson)}</pre>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">CMS mapping</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="overflow-auto rounded-lg bg-muted/30 p-4 text-xs leading-relaxed">{prettyJson(cmsMappingJson)}</pre>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="pages" className="space-y-4">
                    {data.pages.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No pages stored.</div>
                    ) : (
                      data.pages.map((page) => {
                        const pageId = String(page.id || page.page_id || page.slug || "");
                        const blocks = blocksByPage.get(pageId) || [];
                        return (
                          <Card key={pageId}>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center justify-between gap-3">
                                <span>{String(page.title || page.slug || "Page")}</span>
                                <span className="text-xs text-muted-foreground">{String(page.slug || pageId)}</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
                                <div><span className="text-foreground">Path:</span> {String(page.path || "—")}</div>
                                <div><span className="text-foreground">Type:</span> {String(page.page_type || "custom")}</div>
                                <div><span className="text-foreground">Order:</span> {String(page.sort_order ?? 0)}</div>
                              </div>
                              <Separator />
                              {blocks.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No blocks stored for this page.</div>
                              ) : (
                                <div className="space-y-2">
                                  {blocks.map((block) => (
                                    <div key={String(block.id)} className="rounded-lg border bg-muted/20 p-3">
                                      <div className="flex items-center justify-between gap-3 text-sm font-medium">
                                        <span>{String(block.block_type || block.type || "block")}</span>
                                        <span className="text-xs text-muted-foreground">#{String(block.sort_order ?? 0)}</span>
                                      </div>
                                      <pre className="mt-2 overflow-auto text-xs text-muted-foreground">{prettyJson({ content: block.content || {}, settings: block.settings || {} })}</pre>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </TabsContent>

                  <TabsContent value="validation" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Validation report</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {data.validation_report ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={data.validation_report.valid ? "default" : "destructive"}>
                                {data.validation_report.valid ? "Valid" : "Invalid"}
                              </Badge>
                              <Badge variant="outline">{data.validation_report.pagesFound.length} pages</Badge>
                              <Badge variant="outline">{data.validation_report.blocksFound} blocks</Badge>
                            </div>

                            {data.validation_report.warnings.length > 0 && (
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Warnings</AlertTitle>
                                <AlertDescription>
                                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                                    {data.validation_report.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            )}

                            {data.validation_report.errors.length > 0 && (
                              <Alert variant="destructive">
                                <TriangleAlert className="h-4 w-4" />
                                <AlertTitle>Errors</AlertTitle>
                                <AlertDescription>
                                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                                    {data.validation_report.errors.map((error, index) => <li key={index}>{error}</li>)}
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">No validation report available.</div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="raw" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">template.json</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="overflow-auto rounded-lg bg-muted/30 p-4 text-xs leading-relaxed">{prettyJson(templateJson)}</pre>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">theme.json</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="overflow-auto rounded-lg bg-muted/30 p-4 text-xs leading-relaxed">{prettyJson(themeJson)}</pre>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {normalizeTemplateStatus(data.template as Pick<TemplateSummary, "status" | "is_active" | "published_at">) !== "published" && (
                    <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                      {publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                      Publish
                    </Button>
                  )}
                  {normalizeTemplateStatus(data.template as Pick<TemplateSummary, "status" | "is_active" | "published_at">) === "published" && (
                    <Button variant="outline" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
                      {archiveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminWebsiteTemplatesPage() {
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TemplateStatus>>({});

  const templatesQuery = useQuery<TemplateSummary[]>({
    queryKey: ["admin-website-templates"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/admin/website-templates`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to load website templates");
      return body;
    },
  });

  const selectedTemplate = templatesQuery.data?.find((template) => template.id === selectedTemplateId) || null;

  const getTemplateStatus = (template: TemplateSummary): TemplateStatus => {
    return statusOverrides[template.id] || normalizeTemplateStatus(template);
  };

  const openDetails = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setDetailsOpen(true);
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const sessionResult = session ? { data: { session } } : await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        throw new Error("Your session is not ready yet. Please refresh and try again.");
      }

      const res = await fetch(`${API_BASE}/admin/website-templates/upload`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = body.error || body.message || `Upload failed (${res.status})`;
        throw new Error(message);
      }
      setUploadProgress(100);
      return body as UploadResult;
    },
    onMutate: () => {
      setUploading(true);
      setUploadProgress(0);
      setUploadResult(null);
    },
    onSuccess: (result) => {
      setUploadResult(result);
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ["admin-website-templates"] });
      if (result.template_id) openDetails(result.template_id);
      toast({
        title: result.success ? "Template uploaded" : "Upload completed with issues",
        description: result.success ? "Template imported successfully." : result.error || "Validation reported issues.",
      });
    },
    onError: (error: Error) => {
      const failure: UploadResult = {
        success: false,
        validation: { valid: false, templateSlug: null, templateName: null, pagesFound: [], blocksFound: 0, warnings: [], errors: [error.message] },
        error: error.message,
      };
      setUploadResult(failure);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`${API_BASE}/admin/website-templates/${templateId}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to publish template");
      return body;
    },
    onSuccess: (_data, templateId) => {
      setStatusOverrides((prev) => ({ ...prev, [templateId]: "published" }));
      queryClient.invalidateQueries({ queryKey: ["admin-website-templates"] });
      toast({ title: "Template published" });
    },
    onError: (error: Error) => {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`${API_BASE}/admin/website-templates/${templateId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to archive template");
      return body;
    },
    onSuccess: (_data, templateId) => {
      setStatusOverrides((prev) => ({ ...prev, [templateId]: "archived" }));
      queryClient.invalidateQueries({ queryKey: ["admin-website-templates"] });
      toast({ title: "Template archived" });
    },
    onError: (error: Error) => {
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`${API_BASE}/admin/website-templates/${templateId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to delete template");
      return { templateId };
    },
    onSuccess: ({ templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-website-templates"] });
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[templateId];
        return next;
      });
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        setDetailsOpen(false);
      }
      toast({ title: "Template deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <PackageOpen className="h-3.5 w-3.5" /> Superadmin
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Website Templates</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Upload, validate, publish, and archive global template packages from a single admin surface.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => templatesQuery.refetch()} disabled={templatesQuery.isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", templatesQuery.isFetching && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload ZIP
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!file.name.toLowerCase().endsWith(".zip")) {
                toast({ title: "Invalid file", description: "Please select a ZIP file.", variant: "destructive" });
                return;
              }
              uploadMutation.mutate(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {(uploading || uploadProgress > 0) && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <UploadProgress value={uploadProgress} />
          </CardContent>
        </Card>
      )}

      {uploadResult && (
        <Card className={uploadResult.success ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant={uploadResult.validation.valid ? "default" : "destructive"}>
                {uploadResult.validation.valid ? "Validated" : "Invalid"}
              </Badge>
              {uploadResult.validation.templateSlug && <Badge variant="outline">{uploadResult.validation.templateSlug}</Badge>}
              <Badge variant="outline">{uploadResult.validation.pagesFound.length} pages</Badge>
              <Badge variant="outline">{uploadResult.validation.blocksFound} blocks</Badge>
            </div>
            {uploadResult.validation.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {uploadResult.validation.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {uploadResult.validation.errors.length > 0 && (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Errors</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {uploadResult.validation.errors.map((error, index) => <li key={index}>{error}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {uploadResult.validation.unsupportedBlockTypes && uploadResult.validation.unsupportedBlockTypes.length > 0 && (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Unsupported block types found</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {uploadResult.validation.unsupportedBlockTypes.map((type, index) => <li key={index}>{type}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {uploadResult.validation.mappedBlockTypes && uploadResult.validation.mappedBlockTypes.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Block types mapped to renderers</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {uploadResult.validation.mappedBlockTypes.map((type, index) => <li key={index}>{type}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Templates</CardTitle>
            <CardDescription>Template status, counts, and quick actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templatesQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading templates...
              </div>
            ) : templatesQuery.isError ? (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Failed to load templates</AlertTitle>
                <AlertDescription className="space-y-3">
                  <div>{(templatesQuery.error as Error | undefined)?.message || "Unable to load website templates."}</div>
                  <Button variant="outline" size="sm" onClick={() => templatesQuery.refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : templatesQuery.data?.length ? (
              templatesQuery.data.map((template) => (
                (() => {
                  const templateStatus = getTemplateStatus(template);

                  return (
                <div key={template.id} className={cn("rounded-xl border p-4 shadow-sm", selectedTemplate?.id === template.id && "border-primary bg-primary/5")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{template.name}</h3>
                        <Badge variant={statusVariant(templateStatus)}>{statusLabel(templateStatus)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{template.slug}</div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{template.page_count} pages</span>
                        <span>{template.block_count} blocks</span>
                        <span>{formatDate(template.uploaded_at || template.created_at)}</span>
                      </div>
                      {template.description && <p className="max-w-3xl text-sm text-muted-foreground">{template.description}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => openDetails(template.id)}>
                        <Eye className="mr-2 h-4 w-4" /> View details
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/admin/website-templates/${template.id}/preview`}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Preview
                        </Link>
                      </Button>
                      {(() => {
                        return (templateStatus === "validated" || templateStatus === "draft") && (
                        <Button onClick={() => publishMutation.mutate(template.id)} disabled={publishMutation.isPending}>
                          {publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                          Publish
                        </Button>
                        );
                      })()}
                      {templateStatus === "published" && (
                        <Button variant="outline" onClick={() => archiveMutation.mutate(template.id)} disabled={archiveMutation.isPending}>
                          {archiveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                          Archive
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const confirmed = window.confirm(`Delete template \"${template.name}\"? This cannot be undone.`);
                          if (!confirmed) return;
                          deleteMutation.mutate(template.id);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
                  );
                })()
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No templates uploaded yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Template Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selectedTemplate ? (
              <>
                <div className="space-y-1">
                  <div className="font-medium">{selectedTemplate.name}</div>
                  <div className="break-all text-muted-foreground">{selectedTemplate.slug}</div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="mt-1 font-medium capitalize">{getTemplateStatus(selectedTemplate).replace(/_/g, " ")}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Pages</div>
                    <div className="mt-1 font-medium">{selectedTemplate.page_count}</div>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => openDetails(selectedTemplate.id)}>
                  Open details
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/admin/website-templates/${selectedTemplate.id}/preview`}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Open preview
                  </Link>
                </Button>
              </>
            ) : (
              <div className="text-muted-foreground">Select a template to inspect metadata, pages, blocks, and validation output.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <TemplateDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} templateId={selectedTemplateId} />
    </div>
  );
}
