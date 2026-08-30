/**
 * Website setup / overview page.
 * Shows if the tenant has a website, lets them create one, and shows quick stats.
 * Entry point for the website builder section.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { WebsiteThemeCard } from "@/components/website-theme-card";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Layout, FileText, Image, MessageSquare, Settings,
  ExternalLink, ChevronRight, Loader2, Eye, Zap, Trash2, CheckCircle2,
  CalendarCheck, Star, ShieldPlus, MailOpen, PhoneCall, Palette,
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
  preview_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  theme: Record<string, string>;
  template_id: string | null;
  domains: Array<{ id: string; domain: string; is_active: boolean; is_platform_subdomain: boolean; ssl_status: string; verification_status: string }>;
}

interface WebsitePage {
  id: string;
  status: "draft" | "published" | string;
}

const DOMAIN_EMAIL_PARTNER_URL = (import.meta.env.VITE_DOMAIN_EMAIL_PARTNER_URL as string | undefined) || "";
const DOMAIN_EMAIL_PARTNER_LABEL = (import.meta.env.VITE_DOMAIN_EMAIL_PARTNER_LABEL as string | undefined) || "our trusted partner";

function trackDomainEmailClick(eventName: "buy_domain_email_click" | "already_have_domain_click", source: "website_setup") {
  const payload = {
    event: eventName,
    source,
    ts: Date.now(),
  };

  try {
    const dataLayer = (window as typeof window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
    if (Array.isArray(dataLayer)) {
      dataLayer.push(payload);
    }
    window.dispatchEvent(new CustomEvent("twd:analytics", { detail: payload }));
  } catch {
    // Best-effort only; never block user interaction.
  }
}

export default function WebsiteSetup() {
  const { hasFeature, isLoading: featuresLoading } = usePlanFeatures();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishOptions, setShowPublishOptions] = useState(false);

  const { data: website, isLoading: websiteLoading } = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website").catch((e) => {
      if (e.message.includes("404") || e.message.includes("No website")) return null;
      throw e;
    }),
    enabled: !featuresLoading && hasFeature("website_builder"),
  });

  const { data: pages = [] } = useQuery<WebsitePage[]>({
    queryKey: ["/api/website/pages"],
    queryFn: () => apiFetch("/api/website/pages"),
    enabled: !!website && !featuresLoading && hasFeature("website_builder"),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const buildMutation = useMutation({
    mutationFn: async () => {
      await apiFetch("/api/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_mode: "demo" }),
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
    mutationFn: async ({ publishAllPages }: { publishAllPages: boolean }) => {
      let newlyPublished = 0;

      if (publishAllPages) {
        const draftPages = pages.filter((page) => page.status === "draft");
        for (const page of draftPages) {
          await apiFetch(`/api/website/pages/${page.id}/publish`, { method: "POST" });
          newlyPublished += 1;
        }
      }

      await apiFetch("/api/website/publish", { method: "POST" });
      return { publishAllPages, newlyPublished };
    },
    onSuccess: ({ publishAllPages, newlyPublished }) => {
      setShowPublishOptions(false);
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      const hasCustomDomain = website?.domains.some((d) => !d.is_platform_subdomain && d.is_active);
      const platformSubdomain = website?.domains.find((d) => d.is_platform_subdomain);
      toast({
        title: "Site is live",
        description: publishAllPages
          ? `Published ${newlyPublished} page${newlyPublished === 1 ? "" : "s"} and made the site live.`
          : hasCustomDomain
          ? "Your website is now live with currently published pages."
          : platformSubdomain
          ? `Your site is live at ${platformSubdomain.domain} with currently published pages.`
          : "Your site is live with currently published pages. Connect a custom domain to make it findable.",
      });
    },
    onError: (e: Error) => {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    },
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
    const busy = buildMutation.isPending;

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
          onClick={() => buildMutation.mutate()}
          disabled={busy}
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
  const platformDomain = website.domains.find((d) => d.is_platform_subdomain);
  const activeCustomDomain = website.domains.find((d) => !d.is_platform_subdomain && (d.verification_status === "verified" || d.is_active));
  const pendingDomains = website.domains.filter((d) => !d.is_platform_subdomain && d.verification_status !== "verified" && !d.is_active);
  const hasPartnerLink = DOMAIN_EMAIL_PARTNER_URL.trim().length > 0;
  const publishedPagesCount = pages.filter((page) => page.status === "published").length;
  const draftPagesCount = pages.filter((page) => page.status === "draft").length;
  const totalPagesCount = publishedPagesCount + draftPagesCount;
  const hasDraftPages = draftPagesCount > 0;
  const liveUrl = activeCustomDomain?.domain
    ? `https://${activeCustomDomain.domain}?twd_edit=1`
    : platformDomain?.domain
    ? `https://${platformDomain.domain}?twd_edit=1`
    : website.preview_url
      ? `${website.preview_url}${website.preview_url.includes("?") ? "&" : "?"}twd_edit=1`
      : "/website/preview";

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
              onClick={() => setShowPublishOptions(true)}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
              Go Live
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
        <Badge variant="outline">
          Pages published: {publishedPagesCount}/{totalPagesCount}
        </Badge>
        {liveUrl && (
          <a
            href={liveUrl}
            target={liveUrl.startsWith("http") ? "_blank" : undefined}
            rel={liveUrl.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-1 text-sm text-primary underline font-mono"
          >
            {liveUrl.startsWith("http") ? liveUrl.replace("https://", "") : "Preview draft site"}
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        )}
        {pendingDomains.length > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {pendingDomains.length} custom domain{pendingDomains.length > 1 ? "s" : ""} pending
          </Badge>
        )}
      </div>

      {hasDraftPages && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>
            {website.status === "published"
              ? `Site is live, but ${draftPagesCount} page${draftPagesCount === 1 ? " is" : "s are"} still draft.`
              : `${draftPagesCount} page${draftPagesCount === 1 ? " is" : "s are"} still draft and not live yet.`}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => publishMutation.mutate({ publishAllPages: true })}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Publish remaining pages
          </Button>
        </div>
      )}

      {/* Draft warning — no custom domain yet, show the free subdomain */}
      {website.status === "published" && !activeCustomDomain && platformDomain && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Globe className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
          <div>
            Your site is live at{" "}
            <a href={liveUrl || "/website/preview"} target={liveUrl?.startsWith("http") ? "_blank" : undefined} rel={liveUrl?.startsWith("http") ? "noopener noreferrer" : undefined} className="font-mono underline">{liveUrl?.startsWith("http") ? platformDomain.domain : "Preview draft site"}</a>.
            {" "}Want your own address?{" "}
            <Link href="/website/domain" className="underline hover:text-blue-900">Connect a custom domain</Link>.
          </div>
        </div>
      )}

      {!activeCustomDomain && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Domain + Business Email</CardTitle>
            <p className="text-sm text-muted-foreground">
              Buy your domain and professional email through {DOMAIN_EMAIL_PARTNER_LABEL}, then connect the domain to your website.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              {hasPartnerLink ? (
                <Button asChild size="sm">
                  <a
                    href={DOMAIN_EMAIL_PARTNER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackDomainEmailClick("buy_domain_email_click", "website_setup")}
                  >
                    Buy domain + email
                  </a>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link href="/website/domain" onClick={() => trackDomainEmailClick("already_have_domain_click", "website_setup")}>I already have a domain</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              TradeWorkDesk supports website setup and publishing. Domain registration, mailbox billing, and mailbox support are handled by the provider.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard href="/website/pages" icon={<Layout className="w-5 h-5" />} title="Pages" description="Edit your website pages and content" />
        <QuickCard href="/website/blog" icon={<FileText className="w-5 h-5" />} title="Blog" description="Write and publish blog posts" />
        <QuickCard href="/website/gallery" icon={<Image className="w-5 h-5" />} title="Gallery" description="Manage gallery images and import from jobs" />
        <QuickCard href="/website/analytics" icon={<MessageSquare className="w-5 h-5" />} title="Analytics" description="Track leads, forms and conversion trends" />
        <QuickCard href="/website/domain" icon={<Globe className="w-5 h-5" />} title="Domain" description="Connect your domain and email setup" />
        <QuickCard href="/website" icon={<Palette className="w-5 h-5" />} title="Website Style" description="Choose colours, fonts and layout styling" />
        <QuickCard href="/website/settings" icon={<Settings className="w-5 h-5" />} title="Settings" description="Branding, SEO and analytics" />
      </div>

      <WebsiteThemeCard />

      <div>
        <h2 className="text-base font-semibold mb-3">Blocks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickCard href="/booking" icon={<CalendarCheck className="w-5 h-5" />} title="Online Booking" description="Set up appointment booking" />
          <QuickCard href="/review-requests" icon={<Star className="w-5 h-5" />} title="Review Requests" description="Request and manage reviews" />
          <QuickCard href="/maintenance" icon={<ShieldPlus className="w-5 h-5" />} title="Maintenance Plans" description="Manage plan tiers and subscriptions" />
          <QuickCard href="/campaigns" icon={<MailOpen className="w-5 h-5" />} title="Email Campaigns" description="Create and send email campaigns" />
          <QuickCard href="/missed-call" icon={<PhoneCall className="w-5 h-5" />} title="Missed Call Text-Back" description="Configure automatic missed-call replies" />
          <QuickCard href="/website/indexnow" icon={<Globe className="w-5 h-5" />} title="IndexNow" description="Submit pages to search engines" />
        </div>
      </div>



      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(o) => !deleteMutation.isPending && setShowDeleteConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete website?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{website.site_name}</strong> including all pages,
              content blocks, blog posts, and connected domains. This cannot be undone.
              <br />
              <strong>Media library note:</strong> deleting a website does not delete your media library images.
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

      {/* Go live confirmation */}
      <AlertDialog open={showPublishOptions} onOpenChange={(o) => !publishMutation.isPending && setShowPublishOptions(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Choose how to go live</AlertDialogTitle>
            <AlertDialogDescription>
              The site can go live with only currently published pages, or you can publish all draft pages first.
              You currently have {draftPagesCount} draft page{draftPagesCount === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => publishMutation.mutate({ publishAllPages: false })}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Go live with current pages
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                publishMutation.mutate({ publishAllPages: true });
              }}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Publish all pages and go live
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
