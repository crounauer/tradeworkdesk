import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Send,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
  Share2,
  RefreshCw,
} from "lucide-react";

const PLATFORMS = [
  { value: "x", label: "X (Twitter)", color: "bg-black text-white" },
  { value: "facebook", label: "Facebook", color: "bg-blue-600 text-white" },
  { value: "instagram", label: "Instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500 text-white" },
];

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  scheduled: { label: "Scheduled", variant: "default", icon: Calendar },
  posted: { label: "Posted", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  dismissed: { label: "Dismissed", variant: "outline", icon: XCircle },
};

function getPlatformBadge(platform: string) {
  const p = PLATFORMS.find((pl) => pl.value === platform);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p?.color || "bg-gray-200"}`}>
      {p?.label || platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <Badge variant="outline">{status}</Badge>;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

async function apiFetch(path: string, options?: RequestInit) {
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
  return res.json();
}

interface CreatePostDialogProps {
  onCreated: () => void;
  initialContent?: string;
  initialPlatform?: string;
  initialScheduled?: boolean;
  triggerButton?: React.ReactNode;
}

function CreatePostDialog({ onCreated, initialContent, initialPlatform, initialScheduled, triggerButton }: CreatePostDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(initialPlatform ? [initialPlatform] : ["x"]),
  );
  const [content, setContent] = useState(initialContent || "");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isScheduled, setIsScheduled] = useState(initialScheduled || false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const scheduledFor = isScheduled && scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : undefined;

      const platforms = Array.from(selectedPlatforms);
      const results = [];
      for (const platform of platforms) {
        const result = await apiFetch("/admin/social/post", {
          method: "POST",
          body: JSON.stringify({ platform, content, imageUrl: imageUrl || undefined, linkUrl: linkUrl || undefined, scheduledFor }),
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      const count = selectedPlatforms.size;
      toast({ title: isScheduled ? `${count} post(s) scheduled` : `${count} post(s) published` });
      setOpen(false);
      resetForm();
      onCreated();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedPlatforms(new Set(initialPlatform ? [initialPlatform] : ["x"]));
    setContent(initialContent || "");
    setImageUrl("");
    setLinkUrl("");
    setIsScheduled(initialScheduled || false);
    setScheduledDate("");
    setScheduledTime("");
    setImagePrompt("");
  };

  const togglePlatform = (value: string) => {
    const next = new Set(selectedPlatforms);
    if (next.has(value)) {
      if (next.size > 1) next.delete(value);
    } else {
      next.add(value);
    }
    setSelectedPlatforms(next);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt) return;
    setGeneratingImage(true);
    try {
      const result = await apiFetch("/admin/social/generate-image", {
        method: "POST",
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      setImageUrl(result.url);
      toast({ title: "Image generated" });
    } catch (err) {
      toast({ title: "Image generation failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Social Media Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    selectedPlatforms.has(p.value)
                      ? `${p.color} border-transparent`
                      : "bg-muted text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post content..."
              rows={4}
            />
            {selectedPlatforms.has("x") && (
              <p className={`text-xs mt-1 ${content.length > 280 ? "text-red-500" : "text-muted-foreground"}`}>
                {content.length}/280 characters (X limit)
              </p>
            )}
          </div>

          <div>
            <Label>Image URL (optional)</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image to generate..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateImage}
                disabled={generatingImage || !imagePrompt}
              >
                {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label>Link URL (optional)</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
            <Label>Schedule for later</Label>
          </div>

          {isScheduled && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-32"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !content || selectedPlatforms.size === 0}
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isScheduled ? (
              <><Calendar className="w-4 h-4 mr-2" /> Schedule ({selectedPlatforms.size})</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Publish ({selectedPlatforms.size})</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectAccountDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("x");
  const [profileName, setProfileName] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [instagramBusinessId, setInstagramBusinessId] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiFetch("/admin/social/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform,
          profileName,
          credentials,
          pageId: pageId || undefined,
          pageName: pageName || undefined,
          instagramBusinessId: instagramBusinessId || undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Account connected" });
      setOpen(false);
      resetForm();
      onCreated();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setPlatform("x");
    setProfileName("");
    setPageId("");
    setPageName("");
    setInstagramBusinessId("");
    setCredentials({});
  };

  const credentialFields: Record<string, { key: string; label: string }[]> = {
    x: [
      { key: "appKey", label: "App Key" },
      { key: "appSecret", label: "App Secret" },
      { key: "accessToken", label: "Access Token" },
      { key: "accessSecret", label: "Access Secret" },
    ],
    facebook: [{ key: "accessToken", label: "Page Access Token" }],
    instagram: [{ key: "accessToken", label: "Page Access Token" }],
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Connect Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Social Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); setCredentials({}); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Profile Name</Label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="@username or page name"
            />
          </div>

          {(platform === "facebook" || platform === "instagram") && (
            <>
              <div>
                <Label>Page ID</Label>
                <Input
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="Facebook Page ID"
                />
              </div>
              <div>
                <Label>Page Name</Label>
                <Input
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder="Page display name"
                />
              </div>
            </>
          )}

          {platform === "instagram" && (
            <div>
              <Label>Instagram Business ID</Label>
              <Input
                value={instagramBusinessId}
                onChange={(e) => setInstagramBusinessId(e.target.value)}
                placeholder="Instagram Business Account ID"
              />
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Credentials</Label>
            {(credentialFields[platform] || []).map((field) => (
              <div key={field.key}>
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <Input
                  type="password"
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.label}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !profileName || Object.values(credentials).some((v) => !v)}
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["social-posts", statusFilter, platformFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (platformFilter !== "all") params.set("platform", platformFilter);
      return apiFetch(`/admin/social/posts?${params.toString()}`);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/social/posts/${id}/dismiss`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-posts"] }),
  });

  const posts = data?.posts || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CreatePostDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["social-posts"] })} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No posts yet</p>
            <p className="text-sm mt-1">Create your first social media post to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post: Record<string, string>) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getPlatformBadge(post.platform)}
                      <StatusBadge status={post.status} />
                      {post.scheduled_for && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(post.scheduled_for).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">{post.content}</p>
                    {post.error && (
                      <p className="text-xs text-red-500 mt-1">Error: {post.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.post_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={post.post_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    {(post.status === "failed" || post.status === "scheduled") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dismissMutation.mutate(post.id)}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionsTab() {
  const queryClient = useQueryClient();
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [bulkInterval, setBulkInterval] = useState("60");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const { toast } = useToast();

  const { data: suggestions, isLoading, refetch } = useQuery({
    queryKey: ["social-suggestions"],
    queryFn: () => apiFetch("/admin/social/suggestions"),
    enabled: false,
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const selected = (suggestions || []).filter((_: unknown, i: number) => selectedSuggestions.has(i));
      return apiFetch("/admin/social/bulk-schedule", {
        method: "POST",
        body: JSON.stringify({
          posts: selected.map((s: Record<string, string>) => ({
            platform: s.platform,
            content: s.content,
            entityType: s.entityType,
            entityId: s.entityId,
          })),
          intervalMinutes: parseInt(bulkInterval, 10),
        }),
      });
    },
    onSuccess: (data: { scheduled: number }) => {
      toast({ title: `${data.scheduled} posts scheduled` });
      setSelectedSuggestions(new Set());
      setShowBulkDialog(false);
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createFromSuggestion = useMutation({
    mutationFn: async (suggestion: Record<string, string>) => {
      return apiFetch("/admin/social/post", {
        method: "POST",
        body: JSON.stringify({
          platform: suggestion.platform,
          content: suggestion.content,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Post created" });
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Suggestions
          </Button>
          {suggestions && suggestions.length > 0 && (
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>

        {selectedSuggestions.size > 0 && (
          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Bulk Schedule ({selectedSuggestions.size})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Schedule Posts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Schedule {selectedSuggestions.size} posts with a fixed interval between them.
                </p>
                <div>
                  <Label>Interval (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bulkInterval}
                    onChange={(e) => setBulkInterval(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending}
                >
                  {bulkMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Schedule All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !suggestions ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Generate AI suggestions</p>
            <p className="text-sm mt-1">Click the button above to generate post ideas for your social media channels.</p>
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="font-medium">No suggestions generated</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.map((suggestion: Record<string, string>, index: number) => (
            <Card key={index} className={selectedSuggestions.has(index) ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getPlatformBadge(suggestion.platform)}
                    <Badge variant="outline" className="text-xs">{suggestion.entityType}</Badge>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(index)}
                    onChange={(e) => {
                      const next = new Set(selectedSuggestions);
                      e.target.checked ? next.add(index) : next.delete(index);
                      setSelectedSuggestions(next);
                    }}
                    className="w-4 h-4"
                  />
                </div>
                <p className="text-sm mb-3 whitespace-pre-line">{suggestion.content}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createFromSuggestion.mutate(suggestion)}
                    disabled={createFromSuggestion.isPending}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Post Now
                  </Button>
                  <CreatePostDialog
                    onCreated={() => queryClient.invalidateQueries({ queryKey: ["social-posts"] })}
                    initialContent={suggestion.content}
                    initialPlatform={suggestion.platform}
                    initialScheduled={true}
                    triggerButton={
                      <Button size="sm" variant="outline">
                        <Calendar className="w-3 h-3 mr-1" />
                        Schedule
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["social-accounts"],
    queryFn: () => apiFetch("/admin/social/accounts"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      apiFetch(`/admin/social/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-accounts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/social/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Account removed" });
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ConnectAccountDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["social-accounts"] })} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No accounts connected</p>
            <p className="text-sm mt-1">Connect your social media accounts to start posting.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account: Record<string, string | boolean>) => (
            <Card key={account.id as string}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getPlatformBadge(account.platform as string)}
                    <div>
                      <p className="font-medium text-sm">{account.profile_name as string}</p>
                      {account.page_name && (
                        <p className="text-xs text-muted-foreground">{account.page_name as string}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Active</Label>
                      <Switch
                        checked={account.is_active as boolean}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: account.id as string, field: "isActive", value: v })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Auto-post</Label>
                      <Switch
                        checked={account.auto_post as boolean}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: account.id as string, field: "autoPost", value: v })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(account.id as string)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSocial() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground mt-1">Manage and schedule your social media posts</p>
        </div>
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <PostsTab />
        </TabsContent>

        <TabsContent value="suggestions">
          <SuggestionsTab />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
