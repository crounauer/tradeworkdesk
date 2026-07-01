/**
 * Website Settings page — branding, theme colours, SEO defaults, social links, analytics
 */
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Inbox, Eye, EyeOff, Trash2 } from "lucide-react";

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

interface WebsiteForm {
  id: string;
  name: string;
  form_type: string;
  fields?: Array<{ name?: string; label?: string; type?: string; required?: boolean; options?: string[] }>;
  notify_email: string | null;
  auto_create_enquiry: boolean;
  is_active: boolean;
  created_at: string;
}

interface WebsiteTestimonial {
  id: string;
  author_name: string;
  location: string | null;
  rating: number | null;
  body: string;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
}

export default function WebsiteSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const defaultTab = new URLSearchParams(search).get("tab") || "branding";

  const { data: website, isLoading } = useQuery<Website | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website").catch(() => null),
  });

  const { data: forms = [] } = useQuery<WebsiteForm[]>({
    queryKey: ["/api/website/forms"],
    queryFn: () => apiFetch("/api/website/forms").catch(() => []),
    enabled: !!website,
  });

  const { data: testimonials = [] } = useQuery<WebsiteTestimonial[]>({
    queryKey: ["/api/website/testimonials"],
    queryFn: () => apiFetch("/api/website/testimonials?status=all").catch(() => []),
    enabled: !!website,
  });

  const updateTestimonialMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiFetch(`/api/website/testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/testimonials"] });
      toast({ title: "Testimonial updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTestimonialMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/website/testimonials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/testimonials"] });
      toast({ title: "Testimonial deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleEnquiryMutation = useMutation({
    mutationFn: ({ formId, value }: { formId: string; value: boolean }) =>
      apiFetch(`/api/website/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_create_enquiry: value }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/forms"] });
      toast({ title: "Form settings updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateNotifyEmailMutation = useMutation({
    mutationFn: ({ formId, notify_email }: { formId: string; notify_email: string }) =>
      apiFetch(`/api/website/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_email: notify_email || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/forms"] });
      toast({ title: "Notification email saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [notifyEmailDraft, setNotifyEmailDraft] = useState<Record<string, string>>({});
  const [serviceOptionsDraft, setServiceOptionsDraft] = useState<Record<string, string>>({});

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
    setServiceOptionsDraft((current) => {
      const next = { ...current };
      for (const wf of forms) {
        const serviceField = Array.isArray(wf.fields)
          ? wf.fields.find((field) => field?.name === "service" && field?.type === "select")
          : undefined;
        const options = Array.isArray(serviceField?.options) ? serviceField!.options : [];
        if (next[wf.id] === undefined) {
          next[wf.id] = options.join("\n");
        }
      }
      return next;
    });
  }, [forms]);

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

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="contact-form-services">Contact Form Services</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4 pt-4">
          {field("site_name", "Site Name", "text", "Plumbing & Heating Co.")}
          {field("tagline", "Tagline", "text", "Your local heating experts")}
          <div className="space-y-1">
            <Label>Logo URL</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={form.logo_url}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
            />
            {form.logo_url && (
              <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded break-all">{form.logo_url}</div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Favicon URL</Label>
            <Input
              type="url"
              placeholder="https://.../favicon.ico"
              value={form.favicon_url}
              onChange={(e) => setForm((f) => ({ ...f, favicon_url: e.target.value }))}
            />
            {form.favicon_url && (
              <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded break-all">{form.favicon_url}</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">Set default SEO information for your website pages. These appear in search results and social media previews.</p>
          <div className="space-y-1">
            <Label>Default Page Title</Label>
            <Input
              type="text"
              placeholder="Gas & Heating Services | Plumbing Co."
              value={form.default_meta_title}
              onChange={(e) => setForm((f) => ({ ...f, default_meta_title: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Shown in browser tabs and search results (50-60 characters recommended)</p>
          </div>
          <div className="space-y-1">
            <Label>Default Meta Description</Label>
            <Textarea
              placeholder="We provide expert gas, heating and plumbing services…"
              value={form.default_meta_description}
              onChange={(e) => setForm((f) => ({ ...f, default_meta_description: e.target.value }))}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Shown under the page title in search results (120-160 characters recommended)</p>
          </div>
        </TabsContent>

        <TabsContent value="social" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">Add links to your social media profiles so visitors can find and follow you.</p>
          {(["facebook", "instagram", "twitter", "linkedin", "youtube"] as const).map((platform) => (
            <div key={platform} className="space-y-1">
              <Label className="capitalize">{platform}</Label>
              <Input
                placeholder={`https://${platform}.com/your-page`}
                value={form.social_links[platform] || ""}
                onChange={(e) => setForm((f) => ({ ...f, social_links: { ...f.social_links, [platform]: e.target.value } }))}
              />
              {form.social_links[platform] && (
                <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded break-all">{form.social_links[platform]}</div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">Add your tracking codes to monitor website visitor behaviour and SEO performance.</p>
          <div className="space-y-1">
            <Label>Google Analytics ID</Label>
            <Input
              type="text"
              placeholder="G-XXXXXXXXXX (e.g. G-ABC123XYZ)"
              value={form.google_analytics_id}
              onChange={(e) => setForm((f) => ({ ...f, google_analytics_id: e.target.value }))}
            />
            {form.google_analytics_id && (
              <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">{form.google_analytics_id}</div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Google Search Console Verification</Label>
            <Input
              type="text"
              placeholder="google-site-verification=XXXXXXXXXX"
              value={form.google_search_console_verification}
              onChange={(e) => setForm((f) => ({ ...f, google_search_console_verification: e.target.value }))}
            />
            {form.google_search_console_verification && (
              <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">{form.google_search_console_verification}</div>
            )}
          </div>
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

        <TabsContent value="forms" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            When a visitor submits a contact form on your website, you can automatically create an
            enquiry in your job management inbox — no manual copying required.
          </p>
          {forms.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No forms found. Build your website to create a contact form.</p>
          ) : (
            <div className="space-y-3">
              {forms.map((wf) => (
                <Card key={wf.id}>
                  <CardContent className="py-4 px-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Inbox className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{wf.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{wf.form_type.replace(/_/g, " ")} form</p>
                        </div>
                        {wf.auto_create_enquiry && (
                          <Badge variant="default" className="text-xs bg-green-600">Auto-enquiry on</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`form-${wf.id}`} className="text-sm text-muted-foreground">
                          Auto-create enquiry
                        </Label>
                        <Switch
                          id={`form-${wf.id}`}
                          checked={wf.auto_create_enquiry}
                          onCheckedChange={(v) => toggleEnquiryMutation.mutate({ formId: wf.id, value: v })}
                          disabled={toggleEnquiryMutation.isPending}
                        />
                      </div>
                    </div>

                    {/* Notification email */}
                    <div className="space-y-1.5">
                      <Label className="text-sm">Notification email</Label>
                      <p className="text-xs text-muted-foreground">
                        Where to send an email alert when this form is submitted. Leave blank to use your company contact email.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="e.g. office@yourcompany.co.uk"
                          value={notifyEmailDraft[wf.id] ?? (wf.notify_email || "")}
                          onChange={(e) => setNotifyEmailDraft((d) => ({ ...d, [wf.id]: e.target.value }))}
                          className="max-w-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateNotifyEmailMutation.isPending}
                          onClick={() =>
                            updateNotifyEmailMutation.mutate({
                              formId: wf.id,
                              notify_email: notifyEmailDraft[wf.id] ?? (wf.notify_email || ""),
                            })
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <strong>How it works:</strong> When a visitor fills in your website contact form, their
            name, phone, email, and message are automatically added as a new enquiry in your{" "}
            <Link href="/enquiries" className="underline font-medium">Enquiries</Link> inbox. You can
            then convert it to a job with one click.
          </div>
        </TabsContent>

        <TabsContent value="contact-form-services" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Configure the website contact form "Service required" dropdown options.
            This is separate from your job sheet service catalogue.
          </p>

          {forms.filter((wf) => wf.form_type === "contact").length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No contact form found yet. Build or publish your website to create one.</p>
          ) : (
            <div className="space-y-3">
              {forms
                .filter((wf) => wf.form_type === "contact")
                .map((wf) => (
                  <Card key={wf.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{wf.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Service dropdown options</Label>
                        <p className="text-xs text-muted-foreground">
                          Enter one option per line. These values appear in the public contact form dropdown.
                        </p>
                        <Textarea
                          rows={6}
                          placeholder={"One option per line\nBoiler servicing\nEmergency repair\nHeat pump installation"}
                          value={serviceOptionsDraft[wf.id] ?? ""}
                          onChange={(e) => setServiceOptionsDraft((d) => ({ ...d, [wf.id]: e.target.value }))}
                          className="max-w-xl"
                        />
                      </div>

                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateNotifyEmailMutation.isPending}
                          onClick={() => {
                            const parsedOptions = (serviceOptionsDraft[wf.id] || "")
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean);

                            const baseFields = Array.isArray(wf.fields)
                              ? wf.fields.filter((field) => !(field?.name === "service" && field?.type === "select"))
                              : [];

                            const nextFields = parsedOptions.length > 0
                              ? [
                                  ...baseFields,
                                  { name: "service", label: "Service required", type: "select", required: true, options: parsedOptions },
                                ]
                              : baseFields;

                            apiFetch(`/api/website/forms/${wf.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ fields: nextFields }),
                            })
                              .then(() => {
                                qc.invalidateQueries({ queryKey: ["/api/website/forms"] });
                                toast({ title: "Service dropdown options saved" });
                              })
                              .catch((e: Error) => {
                                toast({ title: "Error", description: e.message, variant: "destructive" });
                              });
                          }}
                        >
                          Save service options
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="testimonials" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Review testimonials collected from feedback journeys before publishing on your website.
            Draft testimonials are hidden until approved.
          </p>

          {testimonials.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No testimonials yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.id}>
                  <CardContent className="py-4 px-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{testimonial.author_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {testimonial.location ? `${testimonial.location} · ` : ""}
                          {testimonial.rating ? `${testimonial.rating}/5` : "No rating"}
                          {" · "}
                          {testimonial.is_visible ? "Published" : "Draft"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {testimonial.is_visible ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateTestimonialMutation.isPending}
                            onClick={() => updateTestimonialMutation.mutate({ id: testimonial.id, payload: { is_visible: false } })}
                          >
                            <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={updateTestimonialMutation.isPending}
                            onClick={() => updateTestimonialMutation.mutate({ id: testimonial.id, payload: { is_visible: true } })}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Publish
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteTestimonialMutation.isPending}
                          onClick={() => deleteTestimonialMutation.mutate(testimonial.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{testimonial.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

