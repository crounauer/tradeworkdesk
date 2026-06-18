/**
 * Blog Post Editor — edit blog post content with optional AI assistance.
 * Route: /website/blog/:id
 */
import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Globe, Loader2, Sparkles, ChevronDown, ChevronUp,
  AlertTriangle, CreditCard, Wand2, FileText, RefreshCw, ZapOff, Image, List, HelpCircle, GitCompare, BarChart2, Lightbulb, CheckSquare,
} from "lucide-react";

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
  content: string | string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  status: "draft" | "published";
  published_at: string | null;
  ai_generated: boolean;
}

interface AiCredits {
  id: string;
  feature_keys: string[];
  credits_remaining: number;
  usage_bundle_price: number | null;
  usage_bundle_size: number | null;
  usage_unit_label: string | null;
}

type AiOperation = "generate" | "improve" | "excerpt" | "meta_description";

interface ContentOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  appliesTo: AiOperation[];
}

const CONTENT_OPTIONS: ContentOption[] = [
  { id: "faq",         label: "FAQ section",       description: "Common questions and answers",        icon: <HelpCircle className="w-3.5 h-3.5 text-blue-500" />,    appliesTo: ["generate", "improve"] },
  { id: "lists",       label: "Bullet lists",      description: "Key points as scannable lists",       icon: <List className="w-3.5 h-3.5 text-slate-500" />,        appliesTo: ["generate", "improve"] },
  { id: "images",      label: "Image suggestions", description: "Placeholder cues for relevant images", icon: <Image className="w-3.5 h-3.5 text-purple-500" />,      appliesTo: ["generate", "improve"] },
  { id: "comparisons", label: "Comparison table",  description: "Side-by-side options or products",    icon: <GitCompare className="w-3.5 h-3.5 text-emerald-500" />, appliesTo: ["generate", "improve"] },
  { id: "stats",       label: "Stats & facts",     description: "Relevant data points and statistics",  icon: <BarChart2 className="w-3.5 h-3.5 text-amber-500" />,   appliesTo: ["generate", "improve"] },
  { id: "tips",        label: "Tips / advice",     description: "Practical tips numbered or bulleted",  icon: <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />,  appliesTo: ["generate", "improve"] },
  { id: "cta",         label: "Call to action",    description: "Encourage enquiry or booking",        icon: <CheckSquare className="w-3.5 h-3.5 text-rose-500" />,  appliesTo: ["generate", "improve"] },
];

function getBodyText(content: string | string[] | Record<string, unknown>[] | null): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === "string") return b;
        const block = b as Record<string, unknown>;
        return block.text ?? block.body ?? block.content ?? "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

export default function WebsiteBlogEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showSeo, setShowSeo] = useState(false);

  // AI state
  const [showAi, setShowAi] = useState(false);
  const [aiRunning, setAiRunning] = useState<AiOperation | null>(null);
  const [aiCredits, setAiCredits] = useState<number | null>(null);
  const [addonActive, setAddonActive] = useState<boolean | null>(null);
  const [contentOptions, setContentOptions] = useState<Set<string>>(new Set(["cta"]));

  // Load post
  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: ["/api/website/blog", params.id],
    queryFn: () => apiFetch(`/api/website/blog/${params.id}`),
    enabled: !!params.id,
  });

  // Load AI credits
  const { data: creditsData } = useQuery<AiCredits[]>({
    queryKey: ["billing-credits"],
    queryFn: async () => {
      const res = await fetch("/api/billing/credits");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (!creditsData) return;
    const aiRow = creditsData.find(c => c.feature_keys.includes("ai_blog_writing"));
    setAiCredits(aiRow?.credits_remaining ?? null);
    // Fetch addon active status
    fetch("/api/billing/addons").then(r => r.ok ? r.json() : []).then((addons: Array<{ feature_keys: string[]; subscribed: boolean }>) => {
      const addon = addons.find(a => a.feature_keys.includes("ai_blog_writing"));
      setAddonActive(addon?.subscribed ?? false);
    }).catch(() => {});
  }, [creditsData]);

  useEffect(() => {
    if (!post) return;
    setTitle(post.title ?? "");
    setSlug(post.slug ?? "");
    setBodyText(getBodyText(post.content as string | string[] | Record<string, unknown>[] | null));
    setExcerpt(post.excerpt ?? "");
    setMetaTitle(post.meta_title ?? "");
    setMetaDescription(post.meta_description ?? "");
    setDirty(false);
  }, [post]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/website/blog/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          content: bodyText,
          excerpt: excerpt.trim() || null,
          meta_title: metaTitle.trim() || null,
          meta_description: metaDescription.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/blog"] });
      qc.invalidateQueries({ queryKey: ["/api/website/blog", params.id] });
      setDirty(false);
      toast({ title: "Post saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiFetch(`/api/website/blog/${params.id}/publish`, { method: "POST" }),
    onSuccess: async () => {
      // Save first to ensure latest content is published
      if (dirty) await saveMutation.mutateAsync();
      qc.invalidateQueries({ queryKey: ["/api/website/blog"] });
      qc.invalidateQueries({ queryKey: ["/api/website/blog", params.id] });
      toast({ title: "Post published" });
    },
  });

  async function runAi(operation: AiOperation) {
    if (!title.trim()) {
      toast({ title: "Enter a title first", description: "The AI needs a title to generate content.", variant: "destructive" });
      return;
    }
    if ((operation !== "generate") && !bodyText.trim()) {
      toast({ title: "Add some content first", description: "This operation requires existing content.", variant: "destructive" });
      return;
    }
    setAiRunning(operation);
    try {
      const res = await fetch("/api/website/blog/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          title: title.trim(),
          existingContent: bodyText.trim() || undefined,
          contentOptions: Array.from(contentOptions),
        }),
      });

      const data = await res.json() as {
        content?: string;
        credits_remaining?: number;
        credits_used?: number;
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        if (data.code === "addon_not_active") {
          setAddonActive(false);
          toast({ title: "AI Writing not enabled", description: data.error, variant: "destructive" });
        } else if (data.code === "no_credits") {
          setAiCredits(0);
          toast({ title: "No credits remaining", description: data.error, variant: "destructive" });
        } else {
          toast({ title: "AI Error", description: data.error, variant: "destructive" });
        }
        return;
      }

      if (data.credits_remaining != null) setAiCredits(data.credits_remaining);
      qc.invalidateQueries({ queryKey: ["billing-credits"] });

      if (operation === "generate" || operation === "improve") {
        setBodyText(data.content ?? "");
      } else if (operation === "excerpt") {
        setExcerpt(data.content ?? "");
      } else if (operation === "meta_description") {
        setMetaDescription(data.content ?? "");
        setShowSeo(true);
      }
      setDirty(true);
      toast({
        title: "AI content generated",
        description: `Used ${data.credits_used ?? 1} credit${(data.credits_used ?? 1) === 1 ? "" : "s"} · ${(data.credits_remaining ?? 0).toLocaleString()} remaining`,
      });
    } catch (err) {
      toast({ title: "AI Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAiRunning(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Post not found.</p>
        <Button variant="ghost" size="sm" asChild className="mt-2">
          <Link href="/website/blog"><ArrowLeft className="w-4 h-4 mr-1" /> Back to blog</Link>
        </Button>
      </div>
    );
  }

  const creditsInPounds = aiCredits != null ? `£${(aiCredits / 100).toFixed(2)}` : null;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href="/website/blog">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold leading-tight">{post.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-xs">{post.status}</Badge>
              {post.ai_generated && <Badge variant="outline" className="text-xs">AI</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || saveMutation.isPending}
            >
              <Globe className="w-4 h-4 mr-1.5" />
              Publish
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={e => { setTitle(e.target.value); setDirty(true); }}
                  placeholder="Enter post title…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL Slug</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-sm shrink-0">/blog/</span>
                  <Input
                    value={slug}
                    onChange={e => { setSlug(e.target.value); setDirty(true); }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea
                  ref={contentRef}
                  value={bodyText}
                  onChange={e => { setBodyText(e.target.value); setDirty(true); }}
                  placeholder="Write your blog post content here…"
                  rows={18}
                  className="font-mono text-sm resize-y"
                />
                <p className="text-xs text-muted-foreground">Plain text or markdown. {bodyText.length > 0 && `${bodyText.split(/\s+/).filter(Boolean).length} words`}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Excerpt</Label>
                <Textarea
                  value={excerpt}
                  onChange={e => { setExcerpt(e.target.value); setDirty(true); }}
                  placeholder="Short summary shown on the blog index…"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* SEO section (collapsible) */}
          <Card>
            <CardHeader
              className="pb-3 cursor-pointer select-none"
              onClick={() => setShowSeo(v => !v)}
            >
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> SEO settings</span>
                {showSeo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
            {showSeo && (
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Meta Title <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input
                    value={metaTitle}
                    onChange={e => { setMetaTitle(e.target.value); setDirty(true); }}
                    placeholder={title}
                    maxLength={70}
                  />
                  <p className="text-xs text-muted-foreground">{metaTitle.length}/70 characters</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Meta Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Textarea
                    value={metaDescription}
                    onChange={e => { setMetaDescription(e.target.value); setDirty(true); }}
                    placeholder="Shown in Google search results…"
                    rows={2}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">{metaDescription.length}/160 characters</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* AI Assist sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                AI Writing Assistant
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-6 w-6"
                  onClick={() => setShowAi(v => !v)}
                >
                  {showAi ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              </CardTitle>
            </CardHeader>

            {/* Addon not active */}
            {addonActive === false && (
              <CardContent className="pt-0 space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
                  <ZapOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-medium">AI Writing not enabled</p>
                    <p className="text-xs mt-0.5">Go to Billing and enable the AI Blog Writing add-on, then purchase a credit bundle.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href="/billing"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Go to Billing</Link>
                </Button>
              </CardContent>
            )}

            {/* No credits */}
            {addonActive === true && aiCredits !== null && aiCredits <= 0 && (
              <CardContent className="pt-0 space-y-3">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <p className="font-medium">No credits remaining</p>
                    <p className="text-xs mt-0.5">Purchase a £25 credit bundle on the Billing page to continue using AI writing.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href="/billing"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Buy Credits (£25)</Link>
                </Button>
              </CardContent>
            )}

            {/* AI available */}
            {(addonActive === null || addonActive === true) && (aiCredits === null || aiCredits > 0) && (
              <CardContent className="pt-0 space-y-3">
                {creditsInPounds && (
                  <div className="rounded-md bg-slate-50 border px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">AI credits remaining</span>
                    <span className="text-sm font-semibold text-slate-700">{creditsInPounds}</span>
                  </div>
                )}

                {/* Content options */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Include in post:</p>
                  <div className="grid grid-cols-1 gap-1">
                    {CONTENT_OPTIONS.map(opt => (
                      <label key={opt.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={contentOptions.has(opt.id)}
                          onChange={e => setContentOptions(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(opt.id); else next.delete(opt.id);
                            return next;
                          })}
                        />
                        <span className="flex items-center gap-1.5 flex-1 min-w-0">
                          {opt.icon}
                          <span className="text-xs font-medium">{opt.label}</span>
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:block truncate">{opt.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => runAi("generate")}
                    disabled={aiRunning !== null}
                  >
                    {aiRunning === "generate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-violet-500" />}
                    Generate full post from title
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => runAi("improve")}
                    disabled={aiRunning !== null || !bodyText.trim()}
                  >
                    {aiRunning === "improve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-blue-500" />}
                    Improve existing content
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => runAi("excerpt")}
                    disabled={aiRunning !== null || !bodyText.trim()}
                  >
                    {aiRunning === "excerpt" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-emerald-500" />}
                    Generate excerpt
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => runAi("meta_description")}
                    disabled={aiRunning !== null || !bodyText.trim()}
                  >
                    {aiRunning === "meta_description" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                    Generate meta description
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">A typical blog post costs around <span className="font-medium text-slate-600">1–10 credits (1–10p)</span>. Credits = £0.01 each, charged at AI cost + markup.</p>

                <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" asChild>
                  <Link href="/billing">Buy more credits →</Link>
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
