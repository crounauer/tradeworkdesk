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
  ExternalLink, ChevronRight, Loader2, Eye,
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

  const publishMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/website/publish", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Website published!", description: "Your website is now live." });
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
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Create Your Website</h1>
          <p className="text-muted-foreground">
            Choose a template and get your professional trade website up in minutes.
          </p>
        </div>

        {templates && templates.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Choose a template</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Default template" />
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
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          size="lg"
          className="w-full"
        >
          {createMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
          ) : (
            <><Globe className="w-4 h-4 mr-2" /> Create My Website</>
          )}
        </Button>
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

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard href="/website/preview" icon={<Eye className="w-5 h-5" />} title="Preview" description="See how your website looks to visitors" />
        <QuickCard href="/website/pages" icon={<Layout className="w-5 h-5" />} title="Pages" description="Edit your website pages and content" />
        <QuickCard href="/website/blog" icon={<FileText className="w-5 h-5" />} title="Blog" description="Write and publish blog posts" />
        <QuickCard href="/website/domain" icon={<Globe className="w-5 h-5" />} title="Domain" description="Connect your custom domain" />
        <QuickCard href="/website/settings" icon={<Settings className="w-5 h-5" />} title="Settings" description="Branding, theme, SEO and analytics" />
        <QuickCard href="/website/forms" icon={<MessageSquare className="w-5 h-5" />} title="Contact Forms" description="Manage enquiry forms and submissions" />
      </div>
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
