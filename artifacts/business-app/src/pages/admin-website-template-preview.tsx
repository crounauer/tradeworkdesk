import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, RefreshCw, TriangleAlert, Check, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TemplatePreviewRenderer, type TemplateBlock } from "@/components/template-preview-renderer";
import { toStorybookBlockType } from "@/twd/templates/blockTypeParity";

type PreviewData = {
  template: Record<string, unknown> & { id: string; name?: string; slug?: string; status?: string };
  theme: Record<string, unknown>;
  pages: Array<Record<string, unknown>>;
  blocks: Array<Record<string, unknown>>;
  upload: Record<string, unknown> | null;
  validation_report: {
    valid: boolean;
    templateSlug: string | null;
    templateName: string | null;
    pagesFound: string[];
    blocksFound: number;
    warnings: string[];
    errors: string[];
    unsupportedBlockTypes?: string[];
    mappedBlockTypes?: string[];
  } | null;
};

const API_BASE = `${import.meta.env.BASE_URL}api`;

function getBlockTypeStatus(blockType: string): { status: 'supported' | 'mapped' | 'unsupported'; displayName: string; icon: React.ReactNode } {
  const raw = String(blockType || "").trim();
  const resolved = toStorybookBlockType(raw);
  if (!raw) {
    return { status: 'unsupported', displayName: 'Unsupported', icon: <TriangleAlert className="h-3 w-3" /> };
  }
  if (resolved === raw) {
    return { status: 'supported', displayName: 'Supported', icon: <Check className="h-3 w-3" /> };
  }
  return { status: 'mapped', displayName: `Mapped to ${resolved}`, icon: <AlertCircle className="h-3 w-3" /> };
}

function normalizeTemplateId(location: string): string | null {
  const path = location.split("?")[0];
  const match = path.match(/^\/admin\/website-templates\/([^/]+)\/preview$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function groupBlocksByPage(blocks: Array<Record<string, unknown>>) {
  const grouped = new Map<string, TemplateBlock[]>();
  for (const block of blocks) {
    const pageId = String(block.page_id || "");
    const existing = grouped.get(pageId) || [];
    existing.push({
      id: String(block.id || `${pageId}-${existing.length}`),
      block_type: String(block.block_type || block.type || "text"),
      content: (block.content as Record<string, unknown>) || {},
      sort_order: Number(block.sort_order ?? existing.length),
    });
    grouped.set(pageId, existing);
  }
  return grouped;
}

const PREVIEW_PAGE_BLOCK_ORDER: Record<string, string[]> = {
  home: ["site.header", "hero.standard", "trust.badges", "features.list", "services.grid", "process.steps", "testimonials", "cta.banner", "site.footer"],
  services: ["site.header", "hero.standard", "services.grid", "features.list", "faq.accordion", "cta.banner", "site.footer"],
  "service-detail": ["site.header", "hero.standard", "features.list", "process.steps", "cta.banner", "site.footer"],
  emergency: ["site.header", "hero.standard", "process.steps", "cta.banner", "site.footer"],
  areas: ["site.header", "hero.standard", "areas.grid", "contact.split", "site.footer"],
  reviews: ["site.header", "hero.standard", "reviews.grid", "testimonials", "trust.badges", "cta.banner", "site.footer"],
  gallery: ["site.header", "hero.standard", "gallery.grid", "cta.banner", "site.footer"],
  "blog-index": ["site.header", "hero.standard", "blog.index", "cta.banner", "site.footer"],
  "blog-post": ["site.header", "hero.standard", "legal.content", "cta.banner", "site.footer"],
  booking: ["site.header", "hero.standard", "contact.split", "cta.banner", "site.footer"],
  contact: ["site.header", "hero.standard", "contact.split", "trust.badges", "site.footer"],
  legal: ["site.header", "hero.standard", "legal.content", "faq.accordion", "site.footer"],
  "404": ["site.header", "hero.standard", "system.notFound", "cta.banner", "site.footer"],
};

function orderBlocksForPage(pageSlug: string, blocks: TemplateBlock[]): TemplateBlock[] {
  const preferred = PREVIEW_PAGE_BLOCK_ORDER[pageSlug] || [];
  if (preferred.length === 0) {
    return [...blocks].sort((a, b) => a.sort_order - b.sort_order);
  }

  const rank = new Map<string, number>(preferred.map((type, idx) => [type, idx]));
  return [...blocks].sort((a, b) => {
    const aRank = rank.has(a.block_type) ? (rank.get(a.block_type) as number) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(b.block_type) ? (rank.get(b.block_type) as number) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.sort_order - b.sort_order;
  });
}

export default function AdminWebsiteTemplatePreviewPage() {
  const [location, setLocation] = useLocation();
  const templateId = useMemo(() => normalizeTemplateId(location), [location]);
  const queryParams = useMemo(() => new URLSearchParams(location.includes("?") ? location.split("?")[1] : ""), [location]);
  const initialPageSlug = queryParams.get("page") || "";

  const [selectedPageSlug, setSelectedPageSlug] = useState(initialPageSlug);

  useEffect(() => {
    setSelectedPageSlug(initialPageSlug);
  }, [initialPageSlug]);

  const { data, isLoading, refetch, isFetching } = useQuery<PreviewData>({
    queryKey: ["admin-website-template-preview", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/admin/website-templates/${templateId}/preview-data`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to load template preview");
      return body;
    },
  });

  const pages = data?.pages || [];
  const blocksByPage = useMemo(() => groupBlocksByPage(data?.blocks || []), [data?.blocks]);

  const selectedPage = useMemo(() => {
    if (!pages.length) return null;
    const bySlug = pages.find((page) => String(page.slug || "") === selectedPageSlug || String(page.path || "") === selectedPageSlug);
    if (bySlug) return bySlug;
    const homePage = pages.find((page) => page.page_type === "home" || page.slug === "/" || page.slug === "home");
    return homePage || pages[0] || null;
  }, [pages, selectedPageSlug]);

  useEffect(() => {
    if (!selectedPageSlug && selectedPage?.slug) {
      setSelectedPageSlug(String(selectedPage.slug));
    }
  }, [selectedPage?.slug, selectedPageSlug]);

  const selectedBlocks = useMemo(() => {
    if (!selectedPage) return [] as TemplateBlock[];
    const pageBlocks = blocksByPage.get(String(selectedPage.id || "")) || [];
    return orderBlocksForPage(String(selectedPage.slug || ""), pageBlocks);
  }, [selectedPage, blocksByPage]);

  const updatePage = (nextSlug: string) => {
    setSelectedPageSlug(nextSlug);
    const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
    if (nextSlug) params.set("page", nextSlug);
    else params.delete("page");
    const nextLocation = `${location.split("?")[0]}${params.toString() ? `?${params.toString()}` : ""}`;
    setLocation(nextLocation, { replace: true });
  };

  if (!templateId) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Invalid preview route</AlertTitle>
          <AlertDescription>The template id could not be read from the URL.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-3 sticky top-0 z-20">
        <Link href="/admin/website-templates">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold">{data?.template.name || "Template preview"}</h1>
            {data?.template.status && <Badge variant="outline" className="capitalize">{String(data.template.status).replace(/_/g, " ")}</Badge>}
            {data?.validation_report && (
              <Badge variant={data.validation_report.valid ? "default" : "destructive"}>
                {data.validation_report.valid ? "Validated" : "Has issues"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Preview imported pages and blocks before publishing the template to tenants.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching || isLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {data?.validation_report?.warnings?.length ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validation warnings</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {data.validation_report.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {data?.validation_report?.errors?.length ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Validation errors</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {data.validation_report.errors.map((error, index) => <li key={index}>{error}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Pages</CardTitle>
              {pages.length > 0 && (
                <Select value={String(selectedPage?.slug ?? "")} onValueChange={(value) => updatePage(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={String(page.id || page.slug)} value={String(page.slug || page.id)}>
                        {String(page.title || page.slug || "Page")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground">This template has no imported pages.</p>
              ) : (
                pages.map((page) => {
                  const isActive = String(page.slug || "") === String(selectedPage?.slug || "");
                  return (
                    <button
                      key={String(page.id || page.slug)}
                      type="button"
                      onClick={() => updatePage(String(page.slug || ""))}
                      className={cn("w-full rounded-xl border p-3 text-left transition-colors", isActive ? "border-primary bg-primary/5" : "hover:bg-slate-50")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{String(page.title || page.slug || "Page")}</div>
                          <div className="text-xs text-muted-foreground">{String(page.slug || page.path || "")}</div>
                        </div>
                        <Badge variant="outline" className="capitalize">{String(page.page_type || "custom").replace(/_/g, " ")}</Badge>
                      </div>
                    </button>
                  );
                })
              )}

              <Separator />
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><span className="text-foreground">Template:</span> {data?.template.slug || templateId}</div>
                <div><span className="text-foreground">Pages:</span> {pages.length}</div>
                <div><span className="text-foreground">Blocks:</span> {data?.blocks.length || 0}</div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">{selectedPage ? String(selectedPage.title || selectedPage.slug || "Page") : "Preview"}</CardTitle>
                  <p className="text-sm text-muted-foreground">{selectedPage ? String(selectedPage.path || selectedPage.slug || "") : "Select a page to preview its blocks."}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedBlocks.length} block{selectedBlocks.length === 1 ? "" : "s"}
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="render">
              <TabsList>
                <TabsTrigger value="render">Render</TabsTrigger>
                <TabsTrigger value="blocks">Blocks</TabsTrigger>
                <TabsTrigger value="theme">Theme</TabsTrigger>
              </TabsList>

              <TabsContent value="render" className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="rounded-b-lg bg-white">
                      {selectedPage ? (
                        <main>
                          {selectedBlocks.length > 0 ? (
                            <TemplatePreviewRenderer
                              blocks={selectedBlocks
                              .slice()
                              .sort((a, b) => a.sort_order - b.sort_order)
                              }
                            />
                          ) : (
                            <div className="p-10 text-center text-sm text-muted-foreground">
                              This page has no blocks.
                            </div>
                          )}
                        </main>
                      ) : (
                        <div className="p-10 text-center text-sm text-muted-foreground">Select a page to preview.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="blocks" className="space-y-4">
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    {selectedBlocks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No blocks found for this page.</p>
                    ) : (
                      selectedBlocks
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((block) => {
                          const supportInfo = getBlockTypeStatus(block.block_type);
                          const statusColor = supportInfo.status === 'supported' ? 'bg-emerald-50 border-emerald-200' : supportInfo.status === 'mapped' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                          return (
                            <div key={block.id} className={cn("rounded-lg border p-3", statusColor)}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{block.block_type}</span>
                                    <Badge variant="outline" className="text-xs gap-1">
                                      {supportInfo.icon}
                                      {supportInfo.displayName}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">Sort order: {block.sort_order}</div>
                                </div>
                              </div>
                              <pre className="mt-2 overflow-auto text-xs text-muted-foreground">{JSON.stringify(block.content || {}, null, 2)}</pre>
                            </div>
                          );
                        })
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="theme" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Theme JSON</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-auto rounded-lg bg-muted/30 p-4 text-xs leading-relaxed">{JSON.stringify(data?.theme || {}, null, 2)}</pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}