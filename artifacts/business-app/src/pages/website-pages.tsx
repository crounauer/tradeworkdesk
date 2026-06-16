/**
 * Website Pages list — shows all pages on the website, lets user create/delete pages
 * and links through to the page editor.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2, Globe, Eye, ArrowLeft, Loader2, GripVertical } from "lucide-react";

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

export default function WebsitePages() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingPage, setDeletingPage] = useState<Page | null>(null);
  const [newPage, setNewPage] = useState({ title: "", slug: "", show_in_nav: true });

  const { data: website } = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website").catch(() => null),
  });

  const { data: pages = [], isLoading } = useQuery<Page[]>({
    queryKey: ["/api/website/pages"],
    queryFn: () => apiFetch("/api/website/pages"),
    enabled: !!website,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newPage) =>
      apiFetch("/api/website/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      setShowCreateDialog(false);
      setNewPage({ title: "", slug: "", show_in_nav: true });
      toast({ title: "Page created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: (pageId: string) =>
      apiFetch(`/api/website/pages/${pageId}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      toast({ title: "Page published" });
    },
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

  function handleTitleChange(title: string) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setNewPage((p) => ({ ...p, title, slug }));
  }

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
          {pages.map((page) => (
            <Card key={page.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{page.title}</div>
                  <div className="text-sm text-muted-foreground">/{page.slug}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={page.status === "published" ? "default" : "secondary"}>
                    {page.status}
                  </Badge>
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
          {pages.length === 0 && (
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
              <Label>URL Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">/</span>
                <Input
                  placeholder="about-us"
                  value={newPage.slug}
                  onChange={(e) => setNewPage((p) => ({ ...p, slug: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => createMutation.mutate(newPage)}
              disabled={!newPage.title || !newPage.slug || createMutation.isPending}
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
