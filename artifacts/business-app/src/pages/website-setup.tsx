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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Layout, FileText, Image, MessageSquare, Settings,
  ExternalLink, ChevronRight, Loader2, Eye, Zap, Pencil, Trash2,
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
  domains: Array<{ id: string; domain: string; is_active: boolean; ssl_status: string; verification_status: string }>;
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

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const quickstartMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/website/quickstart", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Website ready!", description: "Your site has been built and pre-filled with your business details. Review each page and tweak the text as needed." });
    },
    onError: (e: Error) => {
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
      const hasDomain = queryClient.getQueryData<WebsiteData>(["website"])?.domains?.some((d) => d.is_active);
      toast({
        title: "Website published!",
        description: hasDomain
          ? "Your website is now live."
          : "Your website is published but won't be publicly visible until you connect a custom domain.",
      });
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
    const busy = quickstartMutation.isPending || createMutation.isPending;
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Create Your Website</h1>
          <p className="text-muted-foreground">
            Choose how you'd like to get started.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Quick Start — recommended */}
          <Card className="border-2 border-primary/40 relative">
            <div className="absolute -top-3 left-4">
              <Badge className="bg-primary text-primary-foreground text-xs px-2">Recommended</Badge>
            </div>
            <CardContent className="p-6 flex flex-col h-full">
              <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4">
                <Zap className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Quick Start</h2>
              <p className="text-sm text-muted-foreground flex-1 mb-6">
                We'll build a complete website for you in seconds — pre-filled with your
                business name, services, contact details, and a professional layout across
                4 pages (Home, Services, About, Contact). Just update the text and photos.
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => quickstartMutation.mutate()}
                disabled={busy}
              >
                {quickstartMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building your site…</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" /> Build My Website Now</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Start from scratch */}
          <Card>
            <CardContent className="p-6 flex flex-col h-full">
              <div className="p-3 bg-muted rounded-xl w-fit mb-4">
                <Pencil className="w-7 h-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Start from Scratch</h2>
              <p className="text-sm text-muted-foreground flex-1 mb-4">
                Create a blank website and build each page yourself. Useful if you want
                full control from the start.
              </p>

              {templates && templates.length > 0 && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Template (optional)</label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Default (blank)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => createMutation.mutate()}
                disabled={busy}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                ) : (
                  <><Globe className="w-4 h-4 mr-2" /> Create Blank Website</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Website exists — show overview
  const activeDomain = website.domains.find((d) => d.is_active);
  const pendingDomains = website.domains.filter((d) => !d.is_active);
  const previewUrl = activeDomain
    ? `https://${activeDomain.domain}`
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
      <div className="flex items-center gap-2">
        <Badge variant={website.status === "published" ? "default" : "secondary"}>
          {website.status === "published" ? "Live" : "Draft"}
        </Badge>
        {activeDomain && (
          <span className="text-sm text-muted-foreground">{activeDomain.domain}</span>
        )}
        {pendingDomains.length > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {pendingDomains.length} domain{pendingDomains.length > 1 ? "s" : ""} pending
          </Badge>
        )}
      </div>

      {/* No domain warning */}
      {website.status === "published" && !activeDomain && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Globe className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <div>
            <span className="font-medium">Not publicly visible.</span>{" "}
            Your website is published but visitors can't find it yet — you need to{" "}
            <Link href="/website/domain" className="underline hover:text-amber-900">connect a custom domain</Link>{" "}first.
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
        <QuickCard href="/website/forms" icon={<MessageSquare className="w-5 h-5" />} title="Contact Forms" description="Manage enquiry forms and submissions" />
      </div>

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
