/**
 * Admin Branding — white-label configuration for the business app
 * Route: /admin/branding
 *
 * Allows admins to:
 *  - Enable white-label mode
 *  - Set brand name, primary/accent colour
 *  - Upload a logo (reuses existing company-settings logo upload)
 *  - Set a custom favicon URL
 *  - Configure email "From" name and reply-to
 */
import { useState, useRef, useEffect } from "react";
import { useCompanySettings, useUpdateCompanySettings, useUploadCompanyLogo } from "@/hooks/use-company-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Palette, Save, Upload, Trash2, Eye } from "lucide-react";

const PRESET_COLORS = [
  { label: "Indigo (default)", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Slate", value: "#475569" },
  { label: "Orange", value: "#f97316" },
];

export default function AdminBranding() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const uploadLogo = useUploadCompanyLogo();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Local form state
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [accentColor, setAccentColor] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed from loaded settings
  useEffect(() => {
    if (!settings) return;
    setWhiteLabel(settings.white_label_enabled ?? false);
    setBrandName(settings.brand_name ?? "");
    setPrimaryColor(settings.primary_color ?? "#6366f1");
    setAccentColor(settings.accent_color ?? "");
    setFaviconUrl(settings.favicon_url ?? "");
    setEmailFromName(settings.email_from_name ?? "");
    setEmailReplyTo(settings.email_reply_to ?? "");
    setLogoPreview(settings.logo_url ?? null);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        white_label_enabled: whiteLabel,
        brand_name: brandName || null,
        primary_color: primaryColor || null,
        accent_color: accentColor || null,
        favicon_url: faviconUrl || null,
        email_from_name: emailFromName || null,
        email_reply_to: emailReplyTo || null,
      });
      toast({ title: "Branding settings saved" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB.", variant: "destructive" });
      return;
    }
    setLogoPreview(URL.createObjectURL(file));
    try {
      await uploadLogo.mutateAsync(file);
      toast({ title: "Logo uploaded" });
    } catch (err) {
      setLogoPreview(settings?.logo_url ?? null);
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const res = await fetch("/api/admin/company-settings/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove logo");
      setLogoPreview(null);
      toast({ title: "Logo removed" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl p-6">
      <div className="flex items-center gap-2">
        <Palette className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">White-Label Branding</h1>
        <Badge variant={whiteLabel ? "default" : "secondary"}>
          {whiteLabel ? "Active" : "Disabled"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Replace "TradeWorkDesk" with your own brand name, colours and logo throughout the app.
      </p>

      {/* Enable toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enable White-Label Mode</CardTitle>
          <CardDescription>
            When enabled, the app shows your brand name, logo and colours instead of the TradeWorkDesk defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>White-label mode</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Applies brand name, logo, primary colour and favicon.
              </p>
            </div>
            <Switch checked={whiteLabel} onCheckedChange={setWhiteLabel} />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <CardDescription>
            Shown in the sidebar instead of the flame icon. PNG with transparent background recommended (min 300×100px).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-slate-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleLogoFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {logoPreview ? (
              <div className="flex flex-col items-center gap-3">
                <img src={logoPreview} alt="Brand logo" className="max-h-20 max-w-xs object-contain rounded" />
                <p className="text-sm text-muted-foreground">Click or drag to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-8 h-8" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs">PNG, JPG, SVG up to 5MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoFile(file);
              e.target.value = "";
            }}
          />
          {logoPreview && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
              onClick={handleRemoveLogo} disabled={uploadLogo.isPending}>
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Logo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Brand Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Brand Name</Label>
            <Input
              id="brand-name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Acme Heating"
            />
            <p className="text-xs text-muted-foreground">
              Shown in the sidebar when no logo is uploaded and white-label mode is active.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Primary Colour</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    primaryColor === preset.value ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: preset.value }}
                  onClick={() => setPrimaryColor(preset.value)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer border border-input p-0.5"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#6366f1"
                className="font-mono w-32"
                maxLength={7}
              />
              <div
                className="w-9 h-9 rounded-lg border border-input flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
                title="Preview"
              />
              <span className="text-xs text-muted-foreground">Primary colour preview</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Accent Colour (optional)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentColor || "#10b981"}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer border border-input p-0.5"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#10b981"
                className="font-mono w-32"
                maxLength={7}
              />
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAccentColor("")}>
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="favicon-url">Favicon URL (optional)</Label>
            <Input
              id="favicon-url"
              value={faviconUrl}
              onChange={(e) => setFaviconUrl(e.target.value)}
              placeholder="https://example.com/favicon.ico"
            />
            <p className="text-xs text-muted-foreground">
              Replaces the browser tab icon. Must be a direct URL to a .ico or .png file.
            </p>
            {faviconUrl && (
              <div className="flex items-center gap-2">
                <img src={faviconUrl} alt="favicon" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbound Email Branding</CardTitle>
          <CardDescription>
            Customise the sender name and reply-to address on emails sent to your customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-from-name">From Name</Label>
            <Input
              id="email-from-name"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              placeholder="e.g. Acme Heating"
            />
            <p className="text-xs text-muted-foreground">
              Shown as the sender name in the customer's inbox. Defaults to the company name.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-reply-to">Reply-To Email</Label>
            <Input
              id="email-reply-to"
              type="email"
              value={emailReplyTo}
              onChange={(e) => setEmailReplyTo(e.target.value)}
              placeholder="info@acmeheating.co.uk"
            />
            <p className="text-xs text-muted-foreground">
              Customers who reply to automated emails will be directed here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {whiteLabel && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border shadow-sm w-fit">
              {logoPreview ? (
                <img src={logoPreview} alt="Preview" className="h-7 w-auto max-w-[140px] object-contain" />
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
                  <span className="font-bold text-base">{brandName || "Your Brand Name"}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This is how your sidebar header will look. Reload the app to see colour changes take effect.
            </p>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Branding Settings
      </Button>
    </div>
  );
}
