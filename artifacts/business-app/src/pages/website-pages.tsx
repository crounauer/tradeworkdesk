/**
 * Website Pages list — shows all pages on the website, lets user create/delete pages
 * and links through to the page editor.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2, Globe, Eye, ArrowLeft, Loader2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface Page {
  id: string;
  slug: string;
  page_type: string;
  title: string;
  status: "draft" | "published";
  show_in_nav: boolean;
  nav_label: string | null;
  nav_order: number;
  published_at: string | null;
}

interface Website {
  id: string;
  site_name: string;
  status: string;
}

type PageNode = Page & { children: PageNode[]; depth: number };

function normalizePagePath(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/-+/g, "-")
    .replace(/(^\/|\/$)/g, "")
    .replace(/(^-|-$)/g, "");
}

function joinPagePath(parentSlug: string, segment: string): string {
  const normalizedParent = normalizePagePath(parentSlug);
  const normalizedSegment = normalizePagePath(segment).split("/").pop() || "";
  if (!normalizedParent) return normalizedSegment;
  if (!normalizedSegment) return normalizedParent;
  return `${normalizedParent}/${normalizedSegment}`;
}

function getPageParentSlug(slug: string): string {
  const normalized = normalizePagePath(slug);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function buildPageTree(pages: Page[]): PageNode[] {
  const bySlug = new Map<string, PageNode>();
  const roots: PageNode[] = [];

  const sortedPages = [...pages].sort((a, b) => {
    const orderDiff = (a.nav_order ?? 0) - (b.nav_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.title.localeCompare(b.title);
  });

  for (const page of sortedPages) {
    bySlug.set(normalizePagePath(page.slug), { ...page, children: [], depth: 0 });
  }

  for (const page of sortedPages) {
    const node = bySlug.get(normalizePagePath(page.slug));
    if (!node) continue;

    const parentSlug = getPageParentSlug(page.slug);
    const parent = parentSlug ? bySlug.get(parentSlug) : null;
    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: PageNode[]): PageNode[] =>
    nodes
      .sort((a, b) => {
        const orderDiff = (a.nav_order ?? 0) - (b.nav_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return a.title.localeCompare(b.title);
      })
      .map((node) => ({
        ...node,
        children: sortChildren(node.children),
      }));

  return sortChildren(roots);
}

function flattenPageTree(nodes: PageNode[]): PageNode[] {
  const output: PageNode[] = [];
  const visit = (node: PageNode) => {
    output.push(node);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return output;
}

export default function WebsitePages() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingPage, setDeletingPage] = useState<Page | null>(null);
  const [newPage, setNewPage] = useState({ title: "", slugSegment: "", parentSlug: "", show_in_nav: true });

  const { data: website } = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website").catch(() => null),
  });

  const { data: pages = [], isLoading } = useQuery<Page[]>({
    queryKey: ["/api/website/pages"],
    queryFn: () => apiFetch("/api/website/pages"),
    enabled: !!website,
  });

  const pageTree = useMemo<PageNode[]>(() => buildPageTree(pages), [pages]);
  const orderedPages = useMemo<PageNode[]>(() => flattenPageTree(pageTree), [pageTree]);

  const createMutation = useMutation({
    mutationFn: (data: typeof newPage) =>
      apiFetch("/api/website/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          slug: joinPagePath(data.parentSlug, data.slugSegment),
          show_in_nav: data.show_in_nav,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      setShowCreateDialog(false);
      setNewPage({ title: "", slugSegment: "", parentSlug: "", show_in_nav: true });
      toast({ title: "Page created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: (pageId: string) =>
      apiFetch(`/api/website/pages/${pageId}/publish`, { method: "POST" }),
    onSuccess: (updatedPage: Page) => {
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      toast({ title: updatedPage.status === "published" ? "Page published" : "Page unpublished" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (pageId: string) =>
      apiFetch(`/api/website/pages/${pageId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      setDeletingPage(null);
      toast({ title: "Page deleted" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedPageIds: string[]) => {
      await Promise.all(
        orderedPageIds.map((id, index) =>
          apiFetch(`/api/website/pages/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nav_order: index + 1 }),
          })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      toast({ title: "Page order updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleTitleChange(title: string) {
    const slug = normalizePagePath(title.replace(/\s+/g, "-"));
    setNewPage((p) => ({ ...p, title, slugSegment: slug.split("/").pop() || slug }));
  }

  function movePage(pageId: string, direction: "up" | "down") {
    const index = orderedPages.findIndex((page) => page.id === pageId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedPages.length) return;

    const next = [...orderedPages];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);

    reorderMutation.mutate(next.map((page) => page.id));
  }

  const parentOptions = pages.filter((page) => page.page_type !== "home");

  if (!website) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No website found. <Link href="/website" className="underline">Create your website first.</Link></p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Pages</h1>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Page
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {orderedPages.map((page) => (
            <Card key={page.id}>
              <CardContent className="p-4 flex items-center gap-3" style={{ paddingLeft: `${16 + page.depth * 28}px` }}>
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => movePage(page.id, "up")}
                    disabled={reorderMutation.isPending}
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => movePage(page.id, "down")}
                    disabled={reorderMutation.isPending}
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{page.title}</div>
                  <div className="text-sm text-muted-foreground">/{page.slug}</div>
                </div>
                <div className="flex items-center gap-2">
                  {page.depth > 0 && (
                    <Badge variant="secondary" className="text-xs">Child</Badge>
                  )}
                  <Button
                    variant={page.status === "published" ? "default" : "secondary"}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => publishMutation.mutate(page.id)}
                    disabled={publishMutation.isPending}
                  >
                    {page.status}
                  </Button>
                  {page.page_type !== "custom" && (
                    <Badge variant="outline" className="text-xs">{page.page_type}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {page.status === "draft" && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => publishMutation.mutate(page.id)}
                      disabled={publishMutation.isPending}
                    >
                      <Globe className="w-3.5 h-3.5 mr-1" /> Publish
                    </Button>
                  )}
                  <Link href={`/website/preview?page=${page.page_type === "home" ? "/" : page.slug}`}>
                    <Button variant="outline" size="icon" title="Preview"><Eye className="w-4 h-4" /></Button>
                  </Link>
                  <Link href={`/website/pages/${page.id}`}>
                    <Button variant="outline" size="icon"><Edit className="w-4 h-4" /></Button>
                  </Link>
                  {page.page_type !== "home" && (
                    <Button
                      variant="outline" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingPage(page)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {orderedPages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No pages yet. Create your first page to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Create page dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Page Title</Label>
              <Input
                placeholder="e.g. About Us"
                value={newPage.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Parent Page</Label>
              <Select value={newPage.parentSlug || "none"} onValueChange={(value) => setNewPage((p) => ({ ...p, parentSlug: value === "none" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {parentOptions.map((page) => (
                    <SelectItem key={page.id} value={page.slug.replace(/^\//, "")}>
                      /{page.slug.replace(/^\//, "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>URL Path Segment</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">/{newPage.parentSlug ? `${newPage.parentSlug}/` : ""}</span>
                <Input
                  placeholder="oil"
                  value={newPage.slugSegment}
                  onChange={(e) => setNewPage((p) => ({ ...p, slugSegment: normalizePagePath(e.target.value).split("/").pop() || "" }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Full path preview: /{joinPagePath(newPage.parentSlug, newPage.slugSegment) || "page-url"}</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => createMutation.mutate(newPage)}
              disabled={!newPage.title || !newPage.slugSegment || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingPage} onOpenChange={(o) => !o && setDeletingPage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deletingPage?.title}&rdquo; and all its content. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingPage && deleteMutation.mutate(deletingPage.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
