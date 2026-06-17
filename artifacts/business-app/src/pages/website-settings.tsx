/**
 * Website Settings page — branding, theme colours, SEO defaults, social links, analytics
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, CheckCircle2, LayoutTemplate } from "lucide-react";

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
  favicon_url: string | null;
  theme: Record<string, string>;
  template_id: string | null;
  default_meta_title: string | null;
  default_meta_description: string | null;
  google_analytics_id: string | null;
  google_search_console_verification: string | null;
  social_links: Record<string, string> | null;
}

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  category: string | null;
}

export default function WebsiteSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: website, isLoading } = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website").catch(() => null),
  });

  const [form, setForm] = useState({
    site_name: "",
    tagline: "",
    logo_url: "",
    favicon_url: "",
    default_meta_title: "",
    default_meta_description: "",
    google_analytics_id: "",
    google_search_console_verification: "",
    social_links: { facebook: "", instagram: "", twitter: "", linkedin: "", youtube: "" } as Record<string, string>,
    theme: { nav_background: "#1f2937", nav_text: "#ffffff", footer_background: "#111827", footer_text: "#9ca3af" } as Record<string, string>,
  });

  useEffect(() => {
    if (website) {
      setForm({
        site_name: website.site_name || "",
        tagline: website.tagline || "",
        logo_url: website.logo_url || "",
        favicon_url: website.favicon_url || "",
        default_meta_title: website.default_meta_title || "",
        default_meta_description: website.default_meta_description || "",
        google_analytics_id: website.google_analytics_id || "",
        google_search_console_verification: website.google_search_console_verification || "",
        social_links: { facebook: "", instagram: "", twitter: "", linkedin: "", youtube: "", ...(website.social_links || {}) },
        theme: { nav_background: "#1f2937", nav_text: "#ffffff", footer_background: "#111827", footer_text: "#9ca3af", ...(website.theme || {}) },
      });
    }
  }, [website]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const cleanedSocial = Object.fromEntries(Object.entries(data.social_links).filter(([, v]) => v));
      return apiFetch("/api/website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, social_links: cleanedSocial }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!website) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No website found. <Link href="/website" className="underline">Create your website first.</Link></p>
      </div>
    );
  }

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Website Settings</h1>
        </div>
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4 pt-4">
          {field("site_name", "Site Name", "text", "Plumbing & Heating Co.")}
          {field("tagline", "Tagline", "text", "Your local heating experts")}
          {field("logo_url", "Logo URL", "url", "https://...")}
          {field("favicon_url", "Favicon URL", "url", "https://.../favicon.ico")}
        </TabsContent>

        <TabsContent value="seo" className="space-y-4 pt-4">
          {field("default_meta_title", "Default Page Title", "text", "Gas & Heating Services | Plumbing Co.")}
          <div className="space-y-1">
            <Label>Default Meta Description</Label>
            <Textarea
              placeholder="We provide expert gas, heating and plumbing services…"
              value={form.default_meta_description}
              onChange={(e) => setForm((f) => ({ ...f, default_meta_description: e.target.value }))}
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="social" className="space-y-4 pt-4">
          {(["facebook", "instagram", "twitter", "linkedin", "youtube"] as const).map((platform) => (
            <div key={platform} className="space-y-1">
              <Label className="capitalize">{platform}</Label>
              <Input
                placeholder={`https://${platform}.com/your-page`}
                value={form.social_links[platform] || ""}
                onChange={(e) => setForm((f) => ({ ...f, social_links: { ...f.social_links, [platform]: e.target.value } }))}
              />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 pt-4">
          {field("google_analytics_id", "Google Analytics ID", "text", "G-XXXXXXXXXX")}
          {field("google_search_console_verification", "Google Search Console Verification", "text", "google-site-verification=...")}
        </TabsContent>

        <TabsContent value="theme" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">Customise the colours of your site navigation and footer.</p>
          {(["nav_background", "nav_text", "footer_background", "footer_text"] as const).map((key) => {
            const labels: Record<string, string> = {
              nav_background: "Navigation Background",
              nav_text: "Navigation Text",
              footer_background: "Footer Background",
              footer_text: "Footer Text",
            };
            return (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.theme[key] || "#000000"}
                  onChange={(e) => setForm((f) => ({ ...f, theme: { ...f.theme, [key]: e.target.value } }))}
                  className="h-10 w-12 cursor-pointer rounded border"
                />
                <div>
                  <Label>{labels[key]}</Label>
                  <div className="text-xs text-muted-foreground font-mono">{form.theme[key]}</div>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="template" className="pt-4">
          <TemplatePicker websiteId={website.id} currentTemplateId={website.template_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplatePicker({ websiteId, currentTemplateId }: { websiteId: string; currentTemplateId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/website/templates"],
    queryFn: () => apiFetch("/api/website/templates"),
  });

  const applyMutation = useMutation({
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

  void websiteId;

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  if (templates.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <LayoutTemplate className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No templates available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose a design for your website. Switching templates changes your site's layout and colours.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => {
          const isActive = currentTemplateId === t.id;
          const isApplying = applyMutation.isPending && applyMutation.variables === t.id;
          return (
            <div
              key={t.id}
              onClick={() => !isActive && !applyMutation.isPending && applyMutation.mutate(t.id)}
              className={`relative rounded-xl overflow-hidden transition-all ${
                isActive
                  ? "ring-2 ring-primary shadow-lg cursor-default"
                  : "border border-border hover:border-primary/60 hover:shadow-md cursor-pointer"
              }`}
            >
              {/* Thumbnail */}
              {t.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.thumbnail_url} alt={t.name} className="w-full h-36 object-cover" />
              ) : (
                <div className={`w-full h-36 flex items-center justify-center ${
                  isActive ? "bg-primary/10" : "bg-muted"
                }`}>
                  <LayoutTemplate className={`w-8 h-8 ${
                    isActive ? "text-primary/60" : "text-muted-foreground/30"
                  }`} />
                </div>
              )}

              {/* Active banner across bottom of thumbnail */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-semibold py-1.5 text-center tracking-wide">
                  ✓ Currently Active
                </div>
              )}

              {/* Info */}
              <div className={`p-3 ${
                isActive ? "bg-primary/5 border-t-2 border-primary" : "bg-background"
              }`}>
                <p className={`font-semibold text-sm ${
                  isActive ? "text-primary" : ""
                }`}>{t.name}</p>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>
                )}
                {!isActive && (
                  <p className="text-xs text-primary font-medium mt-2">
                    {isApplying ? "Applying…" : "Click to apply →"}
                  </p>
                )}
              </div>

              {/* Applying spinner overlay */}
              {isApplying && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
