import { useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, Lock, LockOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type TemplateDetail = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: string;
  category?: string;
  version?: number;
  page_count?: number;
  created_at?: string;
  updated_at?: string;
};

type TemplateBlock = {
  id: string;
  type: string;
  label: string;
  template_id: string;
  sort_order: number;
};

type TemplatePage = {
  id: string;
  slug: string;
  title: string;
  template_id: string;
  description?: string;
  sort_order: number;
  blocks?: TemplateBlock[];
};

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status?.toLowerCase()) {
    case "live":
    case "published":
      return "default";
    case "draft":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(date?: string) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
}

export default function SuperadminTemplateDetailPage() {
  const [, params] = useRoute("/superadmin/templates/:slug");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const slug = params?.slug as string;

  // Fetch template detail
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["superadmin-template", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to fetch template");
      return body.data as TemplateDetail;
    },
    enabled: !!slug,
  });

  // Fetch template pages with blocks
  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["superadmin-template-pages", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}?includePages=true`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to fetch pages");
      return body.data?.pages || [];
    },
    enabled: !!slug,
  });

  // Publish template
  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to publish");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Published",
        description: `Template "${slug}" is now live`,
      });
      queryClient.invalidateQueries({ queryKey: ["superadmin-template", slug] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to publish",
        variant: "destructive",
      });
    },
  });

  // Unpublish template
  const unpublishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}/unpublish`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to unpublish");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Unpublished",
        description: `Template "${slug}" is now draft`,
      });
      queryClient.invalidateQueries({ queryKey: ["superadmin-template", slug] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unpublish",
        variant: "destructive",
      });
    },
  });

  if (templateLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate("/superadmin/templates")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Template not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/superadmin/templates")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{template.name}</h1>
            <Badge variant={statusBadgeVariant(template.status)}>
              {template.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Slug: <span className="font-mono text-sm">{template.slug}</span>
          </p>
        </div>
      </div>

      <Separator />

      {/* Template Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Template Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{template.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Slug</p>
              <p className="font-mono text-sm">{template.slug}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={statusBadgeVariant(template.status)} className="w-fit">
                {template.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{template.category || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Version</p>
              <p className="font-medium">{template.version || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pages</p>
              <p className="font-medium">{template.page_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm">{formatDate(template.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Updated</p>
              <p className="text-sm">{formatDate(template.updated_at)}</p>
            </div>
          </div>

          {template.description && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="mt-1">{template.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 pt-4 border-t flex gap-2">
            {template.status?.toLowerCase() === "live" ? (
              <Button
                variant="outline"
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
              >
                {unpublishMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Lock className="h-4 w-4 mr-2" />
                Unpublish
              </Button>
            ) : (
              <Button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <LockOpen className="h-4 w-4 mr-2" />
                Publish
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pages Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>Template pages and their blocks</CardDescription>
        </CardHeader>
        <CardContent>
          {pagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pages in this template</p>
          ) : (
            <div className="space-y-4">
              {(pages as TemplatePage[]).map((page) => (
                <div key={page.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{page.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        slug: <span className="font-mono">{page.slug}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/superadmin/templates/${slug}/preview/${page.slug}`}>
                        <Button variant="ghost" size="sm" title="Preview page">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Badge variant="outline">Page {page.sort_order + 1}</Badge>
                    </div>
                  </div>

                  {page.description && (
                    <p className="text-sm text-muted-foreground">{page.description}</p>
                  )}

                  {/* Blocks Table */}
                  {page.blocks && page.blocks.length > 0 ? (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium mb-2">{page.blocks.length} block(s)</p>
                      <div className="text-sm space-y-1">
                        {page.blocks.map((block) => (
                          <div key={block.id} className="flex items-center gap-2 text-xs">
                            <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                              {block.type}
                            </span>
                            <span className="text-muted-foreground">{block.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No blocks</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
