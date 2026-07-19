import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MessageSquare, Loader2, Pin, Lock, Flag } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface Thread {
  id: string;
  category_id: string;
  title: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface Post {
  id: string;
  author_id: string;
  author?: {
    id: string;
    full_name: string | null;
    role: string | null;
  } | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
}

interface ThreadDetail {
  thread: Thread;
  posts: Post[];
}

interface CommunityReport {
  id: string;
  post_id: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed" | "actioned";
  created_at: string;
  post?: { body: string; thread_id: string; author_id: string };
}

type ModerationFilter = "open" | "reviewed" | "dismissed" | "actioned" | "all";

function roleBadgeLabel(role: string | null | undefined): string | null {
  if (role === "super_admin") return "Developer";
  if (role === "admin") return "Admin";
  if (role === "office_staff") return "Office Staff";
  if (role === "technician") return "Technician";
  return null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  return res.json() as Promise<T>;
}

export default function CommunityPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const canManage = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [targetPostId, setTargetPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [moderationFilter, setModerationFilter] = useState<ModerationFilter>("open");
  const [hasAutoChosenModerationFilter, setHasAutoChosenModerationFilter] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadBody, setNewThreadBody] = useState("");
  const [newReply, setNewReply] = useState("");

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["community-categories"],
    queryFn: () => apiFetch<Category[]>("/community/categories"),
  });

  const { data: threads = [], isLoading: threadsLoading } = useQuery<Thread[]>({
    queryKey: ["community-threads", selectedCategoryId],
    queryFn: () => {
      const qs = selectedCategoryId === "all" ? "" : `?category_id=${selectedCategoryId}`;
      return apiFetch<Thread[]>(`/community/threads${qs}`);
    },
  });

  const effectiveThreadId = selectedThreadId || threads[0]?.id || null;

  const { data: threadDetail, isLoading: threadDetailLoading } = useQuery<ThreadDetail | null>({
    queryKey: ["community-thread", effectiveThreadId],
    queryFn: () => {
      if (!effectiveThreadId) return Promise.resolve(null);
      return apiFetch<ThreadDetail>(`/community/threads/${effectiveThreadId}`);
    },
    enabled: !!effectiveThreadId,
  });

  const createCategoryMutation = useMutation({
    mutationFn: () => apiFetch<Category>("/community/categories", {
      method: "POST",
      body: JSON.stringify({
        name: newCategoryName,
        description: newCategoryDesc || undefined,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-categories"] });
      setNewCategoryName("");
      setNewCategoryDesc("");
      toast({ title: "Category created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createThreadMutation = useMutation({
    mutationFn: () => {
      const categoryId = selectedCategoryId === "all" ? categories[0]?.id : selectedCategoryId;
      if (!categoryId) throw new Error("Create/select a category first");
      return apiFetch<{ thread: Thread }>("/community/threads", {
        method: "POST",
        body: JSON.stringify({
          category_id: categoryId,
          title: newThreadTitle,
          body: newThreadBody,
        }),
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["community-threads"] });
      setSelectedThreadId(result.thread.id);
      setNewThreadTitle("");
      setNewThreadBody("");
      toast({ title: "Thread created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createReplyMutation = useMutation({
    mutationFn: () => {
      if (!effectiveThreadId) throw new Error("No thread selected");
      return apiFetch<Post>(`/community/threads/${effectiveThreadId}/posts`, {
        method: "POST",
        body: JSON.stringify({ body: newReply }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-thread", effectiveThreadId] });
      qc.invalidateQueries({ queryKey: ["community-threads"] });
      setNewReply("");
      toast({ title: "Reply posted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateThreadMutation = useMutation({
    mutationFn: (payload: Partial<Pick<Thread, "is_locked" | "is_pinned">>) => {
      if (!effectiveThreadId) throw new Error("No thread selected");
      return apiFetch<Thread>(`/community/threads/${effectiveThreadId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-threads"] });
      qc.invalidateQueries({ queryKey: ["community-thread", effectiveThreadId] });
      toast({ title: "Thread updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reportPostMutation = useMutation({
    mutationFn: ({ postId, reason }: { postId: string; reason: string }) => apiFetch(`/community/posts/${postId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
    onSuccess: () => toast({ title: "Post reported" }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<CommunityReport[]>({
    queryKey: ["community-reports", moderationFilter],
    queryFn: () => apiFetch<CommunityReport[]>(`/community/reports?status=${moderationFilter}`),
    enabled: canManage,
  });

  const { data: allReports = [], isFetched: allReportsFetched } = useQuery<CommunityReport[]>({
    queryKey: ["community-reports", "all"],
    queryFn: () => apiFetch<CommunityReport[]>("/community/reports?status=all"),
    enabled: canManage,
  });

  const reportCounts = useMemo(() => {
    const counts: Record<ModerationFilter, number> = {
      open: 0,
      reviewed: 0,
      dismissed: 0,
      actioned: 0,
      all: allReports.length,
    };

    for (const report of allReports) {
      if (report.status in counts) {
        counts[report.status as Exclude<ModerationFilter, "all">] += 1;
      }
    }

    return counts;
  }, [allReports]);

  const resolveReportMutation = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: CommunityReport["status"] }) =>
      apiFetch(`/community/reports/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-reports"] });
      toast({ title: "Report updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleModerationFilterChange = (value: ModerationFilter) => {
    setHasAutoChosenModerationFilter(true);
    setModerationFilter(value);
  };

  useEffect(() => {
    if (!canManage || !allReportsFetched || hasAutoChosenModerationFilter) return;
    setModerationFilter(reportCounts.open > 0 ? "open" : "all");
    setHasAutoChosenModerationFilter(true);
  }, [canManage, allReportsFetched, hasAutoChosenModerationFilter, reportCounts.open]);

  useEffect(() => {
    if (!targetPostId || !threadDetail) return;
    const targetExists = threadDetail.posts.some((post) => post.id === targetPostId);
    if (!targetExists) return;

    let timeout: number | undefined;
    const el = document.getElementById(`community-post-${targetPostId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedPostId(targetPostId);
      setTargetPostId(null);
      timeout = window.setTimeout(() => setHighlightedPostId((curr) => (curr === targetPostId ? null : curr)), 3500);
    }

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [targetPostId, threadDetail]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6" />Community</h1>
        <p className="text-muted-foreground mt-1">Tenant-only discussion board for tips, questions, and updates.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Categories</h2>
            {categoriesLoading ? (
              <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading categories...</div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId("all")}
                  className={`w-full text-left rounded border p-2.5 ${selectedCategoryId === "all" ? "border-primary" : ""}`}
                >
                  <p className="font-medium text-sm">All Categories</p>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full text-left rounded border p-2.5 ${selectedCategoryId === cat.id ? "border-primary" : ""}`}
                  >
                    <p className="font-medium text-sm">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {canManage && (
            <>
              <Card className="p-4 space-y-3">
                <h2 className="font-semibold">Create Category</h2>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Safety Alerts" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Input value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} placeholder="Important notices for the team" />
                </div>
                <Button onClick={() => createCategoryMutation.mutate()} disabled={createCategoryMutation.isPending || !newCategoryName.trim()}>
                  {createCategoryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Category
                </Button>
              </Card>

              <Card className="p-4 space-y-3">
                <h2 className="font-semibold">Start Thread</h2>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} placeholder="Recommended suppliers for Worcester parts" />
                </div>
                <div className="space-y-1.5">
                  <Label>Opening post</Label>
                  <Textarea value={newThreadBody} onChange={(e) => setNewThreadBody(e.target.value)} rows={4} placeholder="Share context, question, and what you already tried." />
                </div>
                <Button onClick={() => createThreadMutation.mutate()} disabled={createThreadMutation.isPending || !newThreadTitle.trim() || !newThreadBody.trim()}>
                  {createThreadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Thread
                </Button>
              </Card>
            </>
          )}
        </div>

        <Card className="p-4 space-y-4 min-h-[520px]">
          <h2 className="font-semibold">Threads</h2>

          {threadsLoading ? (
            <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading threads...</div>
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No threads yet for this category.</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-left rounded border p-3 hover:bg-accent ${effectiveThreadId === thread.id ? "border-primary" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {thread.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-600" />}
                    {thread.is_locked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                    <p className="font-medium text-sm truncate">{thread.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Updated {new Date(thread.updated_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            {!effectiveThreadId ? (
              <p className="text-sm text-muted-foreground">Select a thread to read and reply.</p>
            ) : threadDetailLoading || !threadDetail ? (
              <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading thread...</div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">{threadDetail.thread.title}</h3>
                  {threadDetail.thread.is_pinned && <Badge className="bg-amber-100 text-amber-700">Pinned</Badge>}
                  {threadDetail.thread.is_locked && <Badge className="bg-slate-100 text-slate-700">Locked</Badge>}
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateThreadMutation.isPending}
                        onClick={() => updateThreadMutation.mutate({ is_pinned: !threadDetail.thread.is_pinned })}
                      >
                        {threadDetail.thread.is_pinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateThreadMutation.isPending}
                        onClick={() => updateThreadMutation.mutate({ is_locked: !threadDetail.thread.is_locked })}
                      >
                        {threadDetail.thread.is_locked ? "Unlock" : "Lock"}
                      </Button>
                    </>
                  )}
                </div>

                <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
                  {threadDetail.posts.map((post) => (
                    <div
                      key={post.id}
                      id={`community-post-${post.id}`}
                      className={`rounded border p-3 transition-colors ${highlightedPostId === post.id ? "border-amber-400 bg-amber-50" : ""}`}
                    >
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {post.author?.full_name?.trim() || "Community Member"}
                        </span>
                        {roleBadgeLabel(post.author?.role) && (
                          <Badge
                            className={post.author?.role === "super_admin" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}
                          >
                            {roleBadgeLabel(post.author?.role)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{post.body}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(post.created_at).toLocaleString()}</span>
                        {!post.is_deleted && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                            onClick={() => reportPostMutation.mutate({ postId: post.id, reason: "inappropriate" })}
                          >
                            <Flag className="w-3 h-3" /> Report
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Reply</Label>
                  <Textarea
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    rows={3}
                    placeholder={threadDetail.thread.is_locked ? "This thread is locked" : "Share your advice or answer..."}
                    disabled={threadDetail.thread.is_locked}
                  />
                  <Button
                    onClick={() => createReplyMutation.mutate()}
                    disabled={threadDetail.thread.is_locked || createReplyMutation.isPending || !newReply.trim()}
                  >
                    {createReplyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Post Reply
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {canManage && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">Moderation Queue</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                ["open", "Open"],
                ["reviewed", "Reviewed"],
                ["dismissed", "Dismissed"],
                ["actioned", "Actioned"],
                ["all", "All"],
              ] as Array<[ModerationFilter, string]>).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={moderationFilter === value ? "default" : "outline"}
                  onClick={() => handleModerationFilterChange(value)}
                >
                  {label} ({reportCounts[value] ?? 0})
                </Button>
              ))}
            </div>
          </div>
          {reportsLoading ? (
            <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading reports...</div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports for this filter.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-amber-100 text-amber-700">{report.reason}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{report.post?.body || "Post unavailable"}</p>
                  <div className="flex items-center gap-2">
                    {report.post?.thread_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedThreadId(report.post!.thread_id);
                          setTargetPostId(report.post_id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Open Reported Post
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveReportMutation.mutate({ reportId: report.id, status: "reviewed" })}
                      disabled={resolveReportMutation.isPending}
                    >
                      Mark Reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveReportMutation.mutate({ reportId: report.id, status: "dismissed" })}
                      disabled={resolveReportMutation.isPending}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => resolveReportMutation.mutate({ reportId: report.id, status: "actioned" })}
                      disabled={resolveReportMutation.isPending}
                    >
                      Mark Actioned
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
