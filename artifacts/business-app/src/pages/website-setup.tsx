/**
 * Website setup / overview page.
 * Shows if the tenant has a website, lets them create one, and shows quick stats.
 * Entry point for the website builder section.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Layout, FileText, Image, MessageSquare, Settings,
  ExternalLink, ChevronRight, Loader2, Eye, Zap, Trash2, LayoutTemplate, CheckCircle2,
} from "lucide-react";
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

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface Website {
  id: string;
  site_name: string;
  tagline: string | null;
  logo_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  theme: Record<string, string>;
  template_id: string | null;
  domains: Array<{ id: string; domain: string; is_active: boolean; is_platform_subdomain: boolean; ssl_status: string; verification_status: string }>;
}

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  category: string;
}

export default function WebsiteSetup() {
  const { hasFeature, isLoading: featuresLoading } = usePlanFeatures();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: website, isLoading: websiteLoading } = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website").catch((e) => {
      if (e.message.includes("404") || e.message.includes("No website")) return null;
      throw e;
    }),
    enabled: !featuresLoading && hasFeature("website_builder"),
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/website/templates"],
    queryFn: () => apiFetch("/api/website/templates"),
    enabled: !featuresLoading && hasFeature("website_builder"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplate || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Website created!", description: "Your website has been set up. You can now edit your pages." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const buildMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiFetch("/api/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await apiFetch("/api/website/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Your website is ready!", description: "Review each page and publish when you're happy." });
    },
    onError: (e: Error) => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch("/api/website", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      setShowDeleteConfirm(false);
      toast({ title: "Website deleted", description: "Your website and all its pages have been permanently deleted." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/website/publish", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      const hasCustomDomain = website?.domains.some((d) => !d.is_platform_subdomain && d.is_active);
      const platformSubdomain = website?.domains.find((d) => d.is_platform_subdomain);
      toast({
        title: "Website published!",
        description: hasCustomDomain
          ? "Your website is now live."
          : platformSubdomain
          ? `Your site is live at ${platformSubdomain.domain}`
          : "Your website is published. Connect a custom domain to make it findable.",
      });
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiFetch("/api/website/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Template applied", description: "Your site design has been updated." });
    },
    onError: (e: Error) => toast({ title: "Failed to apply template", description: e.message, variant: "destructive" }),
  });

  if (featuresLoading || websiteLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasFeature("website_builder")) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <UpgradePrompt
          feature="website_builder"
          title="Website Builder"
          description="Build a professional website for your business with the TradeSite website builder. Custom domains, blog, photo gallery, contact forms and more."
        />
      </div>
    );
  }

  if (!website) {
    const modernTemplate = templates?.find((t) => t.slug === "modern");
    const busy = buildMutation.isPending || createMutation.isPending;

    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Build Your Website</h1>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm">
            We'll create a complete, professional website in seconds — pre-filled with your
            business details, services, and contact information. Just review and publish.
          </p>
        </div>

        {/* Pages being created */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pages included</p>
          <div className="grid grid-cols-2 gap-1.5">
            {["Home", "Services", "How It Works", "Projects", "Reviews", "Areas We Cover", "Contact"].map((page) => (
              <div key={page} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                {page}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">You can add, remove, or reorder pages at any time.</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-2 mb-8 text-sm text-muted-foreground">
          {[
            { icon: "📞", text: "Contact form included" },
            { icon: "🔍", text: "SEO optimised" },
            { icon: "📱", text: "Mobile friendly" },
            { icon: "🌐", text: "Free web address" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <span>{icon}</span> {text}
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => buildMutation.mutate(modernTemplate?.id ?? "")}
          disabled={busy || !modernTemplate}
        >
          {buildMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building your website…</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" /> Build My Website</>
          )}
        </Button>
      </div>
    );
  }

  // Website exists — show overview
  const platformDomain = website.domains.find((d) => d.is_platform_subdomain && d.is_active);
  const activeCustomDomain = website.domains.find((d) => !d.is_platform_subdomain && d.is_active);
  const pendingDomains = website.domains.filter((d) => !d.is_platform_subdomain && !d.is_active);
  // Show custom domain URL once active, otherwise fall back to the free platform subdomain
  const liveUrl = activeCustomDomain
    ? `https://${activeCustomDomain.domain}`
    : platformDomain
    ? `https://${platformDomain.domain}`
    : undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{website.site_name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{website.tagline || "Your trade website"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/website/preview">
              <Eye className="w-4 h-4 mr-1" /> Preview
            </Link>
          </Button>
          {website.status === "draft" && (
            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
              Publish Site
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={website.status === "published" ? "default" : "secondary"}>
          {website.status === "published" ? "Published" : "Draft"}
        </Badge>
        {liveUrl && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline font-mono"
          >
            {liveUrl.replace("https://", "")}
          </a>
        )}
        {activeCustomDomain && platformDomain && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Free address also redirects here
          </Badge>
        )}
        {pendingDomains.length > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {pendingDomains.length} custom domain{pendingDomains.length > 1 ? "s" : ""} pending
          </Badge>
        )}
      </div>

      {/* Draft warning — no custom domain yet, show the free subdomain */}
      {website.status === "published" && !activeCustomDomain && platformDomain && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Globe className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
          <div>
            Your site is live at{" "}
            <a href={`https://${platformDomain.domain}`} target="_blank" rel="noopener noreferrer" className="font-mono underline">{platformDomain.domain}</a>.
            {" "}Want your own address?{" "}
            <Link href="/website/domain" className="underline hover:text-blue-900">Connect a custom domain</Link>.
          </div>
        </div>
      )}

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard href="/website/preview" icon={<Eye className="w-5 h-5" />} title="Preview" description="See how your website looks to visitors" />
        <QuickCard href="/website/pages" icon={<Layout className="w-5 h-5" />} title="Pages" description="Edit your website pages and content" />
        <QuickCard href="/website/blog" icon={<FileText className="w-5 h-5" />} title="Blog" description="Write and publish blog posts" />
        <QuickCard href="/website/domain" icon={<Globe className="w-5 h-5" />} title="Domain" description="Connect your custom domain" />
        <QuickCard href="/website/settings" icon={<Settings className="w-5 h-5" />} title="Settings" description="Branding, theme, SEO and analytics" />
        <QuickCard href="/website/settings?tab=forms" icon={<MessageSquare className="w-5 h-5" />} title="Contact Forms" description="Manage enquiry forms and submissions" />
      </div>

      {/* Template selector */}
      {templates && templates.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Design Template</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {templates.map((t) => {
              const isActive = website.template_id === t.id;
              const isApplying = applyTemplateMutation.isPending && applyTemplateMutation.variables === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => !isActive && !applyTemplateMutation.isPending && applyTemplateMutation.mutate(t.id)}
                  className={`relative rounded-xl overflow-hidden transition-all ${
                    isActive
                      ? "ring-2 ring-primary shadow-md cursor-default"
                      : "border border-border hover:border-primary/60 hover:shadow-sm cursor-pointer"
                  }`}
                >
                  {/* Thumbnail */}
                  {t.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumbnail_url} alt={t.name} className="w-full h-20 object-cover" />
                  ) : (
                    <div className={`w-full h-20 flex items-center justify-center ${
                      isActive ? "bg-primary/10" : "bg-muted"
                    }`}>
                      <LayoutTemplate className={`w-6 h-6 ${
                        isActive ? "text-primary/60" : "text-muted-foreground/30"
                      }`} />
                    </div>
                  )}

                  {/* Active banner */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-semibold py-1 text-center">
                      ✓ Active
                    </div>
                  )}

                  <div className={`px-2.5 py-2 ${
                    isActive ? "bg-primary/5 border-t-2 border-primary" : "bg-background"
                  }`}>
                    <p className={`text-xs font-semibold truncate ${
                      isActive ? "text-primary" : ""
                    }`}>{t.name}</p>
                    {!isActive && (
                      <p className="text-xs text-muted-foreground">
                        {isApplying ? "Applying…" : "Click to apply"}
                      </p>
                    )}
                  </div>

                  {isApplying && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(o) => !deleteMutation.isPending && setShowDeleteConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete website?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{website.site_name}</strong> including all pages,
              content blocks, blog posts, and connected domains. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</> : "Delete Website"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuickCard({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{title}</div>
            <div className="text-sm text-muted-foreground truncate">{description}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
