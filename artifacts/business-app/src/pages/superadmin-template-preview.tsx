import { useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TemplatePreviewRenderer, type TemplateBlock } from "@/components/template-preview-renderer";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type TemplatePage = {
  id: string;
  slug: string;
  title: string;
  path: string;
  page_type: string;
  sort_order: number;
  seo?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  blocks: TemplateBlock[];
};

type PageDetailResponse = {
  success: true;
  data: TemplatePage;
} | {
  success: false;
  error: string;
};

type AllPagesResponse = {
  success: true;
  data: Array<{
    id: string;
    slug: string;
    title: string;
    sort_order: number;
  }>;
} | {
  success: false;
  error: string;
};

type TemplateStatusResponse = {
  success: true;
  data: {
    template: {
      slug: string;
      name: string;
      status: string;
    };
  };
} | {
  success: false;
  error: string;
};

export default function SuperadminTemplatePreviewPage() {
  const [, params] = useRoute("/superadmin/templates/:slug/preview/:pageSlug");
  const [, navigate] = useLocation();

  const slug = params?.slug as string;
  const pageSlug = params?.pageSlug as string;

  // Fetch all pages for navigation
  const { data: allPages = [] } = useQuery({
    queryKey: ["superadmin-template-all-pages", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}`, {
        credentials: "include",
      });
      const body = (await res.json()) as any;
      if (!res.ok) throw new Error(body.error || "Failed to fetch pages");
      
      // Extract pages from the response - they're nested in the template detail response
      return body.data?.pages || [];
    },
    enabled: !!slug,
  });

  // Fetch template status
  const { data: templateData } = useQuery({
    queryKey: ["superadmin-template-status", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}`, {
        credentials: "include",
      });
      const body = (await res.json()) as any;
      if (!res.ok) throw new Error(body.error || "Failed to fetch template");
      return body.data?.template;
    },
    enabled: !!slug,
  });

  // Fetch current page details
  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ["superadmin-template-page", slug, pageSlug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}/pages/${pageSlug}`, {
        credentials: "include",
      });
      const body = (await res.json()) as PageDetailResponse;
      if (!res.ok) {
        const error = !body.success && "error" in body ? body.error : "Failed to fetch page";
        throw new Error(error);
      }
      return body.success && "data" in body ? body.data : undefined;
    },
    enabled: !!slug && !!pageSlug,
  });

  // Find current and adjacent pages for navigation
  const pageNavigation = useMemo(() => {
    if (!allPages || allPages.length === 0) return { current: null, prev: null, next: null };

    const currentIndex = allPages.findIndex((p: any) => p.slug === pageSlug);
    if (currentIndex === -1) return { current: null, prev: null, next: null };

    return {
      current: allPages[currentIndex],
      prev: currentIndex > 0 ? allPages[currentIndex - 1] : null,
      next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null,
    };
  }, [allPages, pageSlug]);

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        <Button variant="outline" onClick={() => navigate(`/superadmin/templates/${slug}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Template
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Page not found</AlertTitle>
          <AlertDescription>The page "{pageSlug}" could not be loaded.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusVariant = templateData?.status?.toLowerCase() === "live" ? "default" : "secondary";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Controls */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/superadmin/templates/${slug}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {templateData && (
                <>
                  <span className="text-sm text-muted-foreground">{templateData.name}</span>
                  <Badge variant={statusVariant as any}>
                    {templateData.status}
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Page Navigation */}
          {allPages.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Page:</span>

              {pageNavigation.prev && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/superadmin/templates/${slug}/preview/${pageNavigation.prev.slug}`
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {pageNavigation.prev.title}
                </Button>
              )}

              <Card className="inline-block">
                <CardContent className="px-3 py-1 text-sm font-medium">
                  {pageNavigation.current?.title}
                </CardContent>
              </Card>

              {pageNavigation.next && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/superadmin/templates/${slug}/preview/${pageNavigation.next.slug}`
                    )
                  }
                >
                  {pageNavigation.next.title}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {/* Page List */}
              {allPages.length > 3 && (
                <div className="text-xs text-muted-foreground ml-auto">
                  Page {pageNavigation.current?.sort_order ? pageNavigation.current.sort_order + 1 : '?'} of {allPages.length}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Page Metadata */}
      <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 text-sm">
        <div className="max-w-7xl mx-auto space-y-2">
          <div className="flex items-center gap-4 flex-wrap text-slate-600">
            <div>
              <span className="font-medium text-slate-900">{page.title}</span>
            </div>
            <span className="text-slate-400">•</span>
            <div>
              <span className="font-mono">{page.slug}</span>
            </div>
            {page.page_type && (
              <>
                <span className="text-slate-400">•</span>
                <div>Type: {page.page_type}</div>
              </>
            )}
            <div className="ml-auto">
              <span className="text-xs bg-slate-200 px-2 py-1 rounded">
                {page.blocks?.length || 0} block(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 bg-white">
        {page.blocks && page.blocks.length > 0 ? (
          <TemplatePreviewRenderer blocks={page.blocks} />
        ) : (
          <div className="px-6 py-20 text-center bg-slate-50">
            <p className="text-muted-foreground">This page has no blocks</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs text-muted-foreground">
            Template: <span className="font-mono">{slug}</span> •{" "}
            Page: <span className="font-mono">{pageSlug}</span> •{" "}
            Template Status: <Badge variant={statusVariant as any} className="inline-block ml-1">
              {templateData?.status || "unknown"}
            </Badge>
          </p>
        </div>
      </div>
    </div>
  );
}
