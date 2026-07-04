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
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Layout, FileText, Image, MessageSquare, Settings,
  ExternalLink, ChevronRight, Loader2, Eye, Zap, Trash2, CheckCircle2,
  CalendarCheck, Star, ShieldPlus, MailOpen, PhoneCall, LayoutTemplate,
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

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  screenshot_urls?: string[];
  category: string;
  content_modes?: Array<"demo" | "empty" | "ai">;
}

type ContentMode = "demo" | "empty" | "ai";

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

function TemplatePreview({ template }: { template: Template }) {
  const screenshots = (template.screenshot_urls || []).filter(Boolean).slice(0, 4);
  const primaryImage = template.preview_url || template.thumbnail_url || screenshots[0] || null;
  const extraImages = screenshots.filter((url) => url !== primaryImage).slice(0, 3);

  return (
    <div className="space-y-2">
      {primaryImage ? (
        <div className="w-full h-48 bg-muted overflow-hidden rounded-t-lg">
          <img
            src={primaryImage}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground rounded-t-lg">
          <Layout className="w-8 h-8" />
        </div>
      )}

      {extraImages.length > 0 && (
        <div className="grid grid-cols-3 gap-1 px-3 pb-3">
          {extraImages.map((url, index) => (
            <div key={`${template.id}-${index}`} className="aspect-[4/3] rounded-md overflow-hidden bg-muted border">
              <img src={url} alt={`${template.name} screenshot ${index + 2}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WebsiteSetup() {
  const { hasFeature, isLoading: featuresLoading } = usePlanFeatures();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishOptions, setShowPublishOptions] = useState(false);
  const [showTemplateSelection, setShowTemplateSelection] = useState(false);
  const [showChangeTemplate, setShowChangeTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedContentMode, setSelectedContentMode] = useState<ContentMode>("demo");

  const { data: website, isLoading: websiteLoading } = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website").catch((e) => {
      if (e.message.includes("404") || e.message.includes("No website")) return null;
      throw e;
    }),
    enabled: !featuresLoading && hasFeature("website_builder"),
  });

  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<Template[]>({
    queryKey: ["/api/website/templates"],
    queryFn: () => apiFetch("/api/website/templates"),
    enabled: !featuresLoading && hasFeature("website_builder"),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: pages = [] } = useQuery<WebsitePage[]>({
    queryKey: ["/api/website/pages"],
    queryFn: () => apiFetch("/api/website/pages"),
    enabled: !!website && !featuresLoading && hasFeature("website_builder"),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const selectedTemplate = templates?.find((template) => template.id === selectedTemplateId) || null;
  const availableContentModes: ContentMode[] = selectedTemplate?.content_modes?.length
    ? selectedTemplate.content_modes
    : ["demo"];

  useEffect(() => {
    if (!availableContentModes.includes(selectedContentMode)) {
      setSelectedContentMode(availableContentModes[0]);
    }
  }, [availableContentModes, selectedContentMode]);

  const buildMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) {
        throw new Error("Please choose a template first");
      }
      await apiFetch("/api/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplateId, content_mode: selectedContentMode }),
      });
    },
    onSuccess: () => {
      setShowTemplateSelection(false);
      setSelectedTemplateId(null);
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

  const changeTemplateMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiFetch(`/api/website/templates/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmReplace: pages.length > 0,
          contentMode: selectedContentMode,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      qc.invalidateQueries({ queryKey: ["/api/website/pages"] });
      setShowChangeTemplate(false);
      setSelectedTemplateId(null);
      toast({ title: "Template updated", description: "Your website template has been changed." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
          onClick={async () => {
            const latest = await refetchTemplates();
            const latestTemplates = latest.data || templates || [];
            if (latestTemplates.length === 0) {
              toast({
                title: "No templates available",
                description: "Activate or upload a template in Platform Templates first.",
                variant: "destructive",
              });
              return;
            }
            setSelectedContentMode("demo");
            setShowTemplateSelection(true);
          }}
          disabled={busy || templatesLoading}
        >
          {buildMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building your website…</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" /> Build My Website</>
          )}
        </Button>

        {!templatesLoading && (!templates || templates.length === 0) && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            No templates are available yet. Activate or upload a template in Platform Templates first.
          </p>
        )}

        {/* Template Selection Modal */}
        {showTemplateSelection && templates && templates.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Select a Template</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">Choose a template to start building your website</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Template Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                        selectedTemplateId === template.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        const modes = template.content_modes?.length ? template.content_modes : (["demo"] as ContentMode[]);
                        setSelectedContentMode((modes[0] || "demo") as ContentMode);
                      }}
                    >
                      <TemplatePreview template={template} />

                      {/* Template Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm">{template.name}</h3>
                          {selectedTemplateId === template.id && (
                            <Badge variant="default" className="shrink-0">Selected</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                        )}
                        {template.category && (
                          <Badge variant="outline" className="mt-2 text-xs">{template.category}</Badge>
                        )}
                        {template.content_modes?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {template.content_modes.map((mode) => (
                              <Badge key={`${template.id}-${mode}`} variant="outline" className="uppercase text-[10px] tracking-wide">
                                {mode}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  <div className="text-sm font-medium">Content mode</div>
                  <div className="grid grid-cols-3 gap-2">
                    {availableContentModes.map((mode) => (
                      <Button
                        key={`build-mode-${mode}`}
                        type="button"
                        size="sm"
                        variant={selectedContentMode === mode ? "default" : "outline"}
                        onClick={() => setSelectedContentMode(mode)}
                        className="uppercase text-xs"
                      >
                        {mode}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Demo keeps sample content, Empty clears editable text, and AI scaffold inserts generation placeholders.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTemplateSelection(false);
                      setSelectedTemplateId(null);
                    }}
                    disabled={buildMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => buildMutation.mutate()}
                    disabled={!selectedTemplateId || buildMutation.isPending}
                  >
                    {buildMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building…</>
                    ) : (
                      "Build My Website"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
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

      {/* Current Template Card */}
      {website.template_id && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">Template</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {templates?.find((t) => t.id === website.template_id)?.name || "Unknown template"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTemplateId(website.template_id);
                  const currentTemplate = templates?.find((template) => template.id === website.template_id);
                  const currentModes = currentTemplate?.content_modes?.length ? currentTemplate.content_modes : (["demo"] as ContentMode[]);
                  setSelectedContentMode((currentModes[0] || "demo") as ContentMode);
                  setShowChangeTemplate(true);
                }}
              >
                Change Template
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

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

      {/* Change Template Modal */}
      {showChangeTemplate && templates && templates.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Change Template</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">Select a different template for your website</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedTemplateId === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <TemplatePreview template={template} />

                    {/* Template Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm">{template.name}</h3>
                        {selectedTemplateId === template.id && (
                          <Badge variant="default" className="shrink-0">Selected</Badge>
                        )}
                        {website.template_id === template.id && (
                          <Badge variant="secondary" className="shrink-0">Current</Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      )}
                      {template.category && (
                        <Badge variant="outline" className="mt-2 text-xs">{template.category}</Badge>
                      )}
                      {template.content_modes?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {template.content_modes.map((mode) => (
                            <Badge key={`${template.id}-change-${mode}`} variant="outline" className="uppercase text-[10px] tracking-wide">
                              {mode}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowChangeTemplate(false);
                    setSelectedTemplateId(website.template_id);
                  }}
                  disabled={changeTemplateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedTemplateId && selectedTemplateId !== website.template_id) {
                      changeTemplateMutation.mutate(selectedTemplateId);
                    }
                  }}
                  disabled={
                    !selectedTemplateId ||
                    selectedTemplateId === website.template_id ||
                    changeTemplateMutation.isPending
                  }
                >
                  {changeTemplateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Changing…</>
                  ) : (
                    "Change Template"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard href="/website/pages" icon={<Layout className="w-5 h-5" />} title="Pages" description="Edit your website pages and content" />
        <QuickCard href="/website/blog" icon={<FileText className="w-5 h-5" />} title="Blog" description="Write and publish blog posts" />
        <QuickCard href="/website/gallery" icon={<Image className="w-5 h-5" />} title="Gallery" description="Manage gallery images and import from jobs" />
        <QuickCard href="/website/analytics" icon={<MessageSquare className="w-5 h-5" />} title="Analytics" description="Track leads, forms and conversion trends" />
        <QuickCard href="/website/domain" icon={<Globe className="w-5 h-5" />} title="Domain" description="Connect your domain and email setup" />
        <QuickCard href="/website/templates" icon={<LayoutTemplate className="w-5 h-5" />} title="Website Template" description="Choose a published global template" />
        <QuickCard href="/website/settings" icon={<Settings className="w-5 h-5" />} title="Settings" description="Branding, theme, SEO and analytics" />
      </div>

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
