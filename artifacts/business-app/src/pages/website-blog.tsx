/**
 * Website Blog management — list, create, edit, publish posts
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Globe, ArrowLeft, Loader2, Sparkles, ExternalLink } from "lucide-react";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  ai_generated: boolean;
}

interface WebsiteDomain {
  domain: string;
  is_platform_subdomain: boolean;
  status: string;
}

export default function WebsiteBlog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", excerpt: "" });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/website/blog"],
    queryFn: () => apiFetch("/api/website/blog"),
  });

  const { data: domains = [] } = useQuery<WebsiteDomain[]>({
    queryKey: ["/api/website/domains"],
    queryFn: () => apiFetch("/api/website/domains"),
  });

  const liveDomain = domains.find((d) => d.status === "active" && !d.is_platform_subdomain)?.domain
    ?? domains.find((d) => d.is_platform_subdomain)?.domain
    ?? null;

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch("/api/website/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data: { id: string }) => {
      qc.invalidateQueries({ queryKey: ["/api/website/blog"] });
      setShowCreate(false);
      setForm({ title: "", slug: "", excerpt: "" });
      navigate(`/website/blog/${data.id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/website/blog/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/blog"] });
      toast({ title: "Post published" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/website/blog/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/blog"] });
      toast({ title: "Post deleted" });
    },
  });

  function handleTitleChange(title: string) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, title, slug }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Blog</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Post
        </Button>
      </div>      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{post.title}</div>
                  <div className="text-sm text-muted-foreground">/blog/{post.slug}</div>
                  {post.excerpt && (
                    <div className="text-sm text-muted-foreground mt-0.5 truncate">{post.excerpt}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {post.ai_generated && <Badge variant="outline" className="text-xs flex items-center gap-1"><Sparkles className="w-3 h-3" />AI</Badge>}
                  <Badge variant={post.status === "published" ? "default" : "secondary"}>
                    {post.status}
                  </Badge>
                  {post.published_at && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {new Date(post.published_at).toLocaleDateString("en-GB")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {post.status === "published" && liveDomain && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={`https://${liveDomain}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  <Link href={`/website/blog/${post.id}`}>
                    <Button variant="outline" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  {post.status === "draft" && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => publishMutation.mutate(post.id)}
                      disabled={publishMutation.isPending}
                    >
                      <Globe className="w-3.5 h-3.5 mr-1" /> Publish
                    </Button>
                  )}
                  <Button
                    variant="outline" size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${post.title}"?`)) deleteMutation.mutate(post.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {posts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No blog posts yet. Write your first post to improve your SEO.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Blog Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                placeholder="e.g. 5 Signs Your Boiler Needs Servicing"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>URL Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">/blog/</span>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Excerpt <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="A short summary shown in the blog index…"
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title || !form.slug || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
