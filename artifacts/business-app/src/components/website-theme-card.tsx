/**
 * Site-level theme colours for the website hub page.
 *
 * Keys map to the flat theme tokens read by the renderer's resolveSiteTheme(),
 * which every block inherits unless it sets its own colour.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { getAccessibleTextColor, getContrastRatio, hasAccessibleContrast, sanitizeThemeColors } from "@/lib/color-contrast";

type Theme = Record<string, string>;

const DEFAULT_THEME: Theme = {
  accent_color: "#0d9488",
  primary_color: "#1c2942",
  primary_text_color: "#ffffff",
  background_color: "#ffffff",
  muted_background: "#f8fafc",
  border_color: "#e2e8f0",
  heading_color: "#111827",
  text_color: "#111827",
  muted_text_color: "#475569",
  nav_background: "#1f2937",
  nav_text: "#ffffff",
  footer_background: "#111827",
  footer_text: "#9ca3af",
};

const COLOR_GROUPS: Array<{ label: string; description: string; keys: Array<{ key: string; label: string }> }> = [
  {
    label: "Brand",
    description: "Buttons, links, highlights and solid brand panels.",
    keys: [
      { key: "accent_color", label: "Accent" },
      { key: "primary_color", label: "Primary" },
      { key: "primary_text_color", label: "Text on Primary" },
    ],
  },
  {
    label: "Page",
    description: "Section backgrounds and dividers.",
    keys: [
      { key: "background_color", label: "Page Background" },
      { key: "muted_background", label: "Alternate Section" },
      { key: "border_color", label: "Borders" },
    ],
  },
  {
    label: "Text",
    description: "Headings, body copy and secondary text.",
    keys: [
      { key: "heading_color", label: "Headings" },
      { key: "text_color", label: "Body Text" },
      { key: "muted_text_color", label: "Muted Text" },
    ],
  },
  {
    label: "Navigation",
    description: "Site header bar.",
    keys: [
      { key: "nav_background", label: "Background" },
      { key: "nav_text", label: "Text" },
    ],
  },
  {
    label: "Footer",
    description: "Site footer bar.",
    keys: [
      { key: "footer_background", label: "Background" },
      { key: "footer_text", label: "Text" },
    ],
  },
];

// Background/foreground keys kept readable against each other.
const CONTRAST_PAIRS: Array<{ label: string; backgroundKey: string; textKey: string }> = [
  { label: "Body text on page", backgroundKey: "background_color", textKey: "text_color" },
  { label: "Muted text on page", backgroundKey: "background_color", textKey: "muted_text_color" },
  { label: "Text on primary", backgroundKey: "primary_color", textKey: "primary_text_color" },
  { label: "Navigation", backgroundKey: "nav_background", textKey: "nav_text" },
  { label: "Footer", backgroundKey: "footer_background", textKey: "footer_text" },
];

const TEMPLATE_DEFAULT = "__template__";

// Theme keys the tenant has deliberately set; the renderer applies these over
// template-seeded block styles.
const OVERRIDES_KEY = "__theme_overrides";

// Full CSS stacks so the renderer can use the value directly; must match siteFonts.ts.
const FONT_OPTIONS: Array<{ label: string; stack: string }> = [
  { label: "System", stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { label: "Inter", stack: "'Inter', system-ui, sans-serif" },
  { label: "Poppins", stack: "'Poppins', system-ui, sans-serif" },
  { label: "Montserrat", stack: "'Montserrat', system-ui, sans-serif" },
  { label: "Lato", stack: "'Lato', system-ui, sans-serif" },
  { label: "Open Sans", stack: "'Open Sans', system-ui, sans-serif" },
  { label: "Roboto", stack: "'Roboto', system-ui, sans-serif" },
  { label: "Work Sans", stack: "'Work Sans', system-ui, sans-serif" },
  { label: "Source Sans 3", stack: "'Source Sans 3', system-ui, sans-serif" },
  { label: "Oswald", stack: "'Oswald', system-ui, sans-serif" },
  { label: "Merriweather", stack: "'Merriweather', Georgia, serif" },
  { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif" },
];

const FONT_FIELDS: Array<{ key: string; label: string }> = [
  { key: "heading_font_family", label: "Headings" },
  { key: "body_font_family", label: "Body Text" },
  { key: "button_font_family", label: "Buttons" },
];

// One choice writes every radius key blocks read.
const CORNER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Sharp", value: "0px" },
  { label: "Soft", value: "8px" },
  { label: "Rounded", value: "16px" },
];
const CORNER_KEYS = ["card_radius", "image_radius", "button_radius"];

const SPACING_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Compact", value: "40px" },
  { label: "Normal", value: "64px" },
  { label: "Spacious", value: "88px" },
];

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 flex-shrink-0 cursor-pointer rounded border"
      />
      <div className="min-w-0">
        <Label>{label}</Label>
        <div className="text-xs text-muted-foreground font-mono">{value}</div>
      </div>
    </div>
  );
}

export function WebsiteThemeCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [theme, setTheme] = useState<Theme>({});
  const [overrides, setOverrides] = useState<string[]>([]);

  const { data: website } = useQuery<{ theme?: (Theme & { __theme_overrides?: string[] }) | null } | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website"),
  });

  useEffect(() => {
    if (!website) return;
    const { [OVERRIDES_KEY]: stored, ...rest } = (website.theme || {}) as Theme & { __theme_overrides?: string[] };
    setTheme(rest as Theme);
    setOverrides(Array.isArray(stored) ? stored.map(String) : []);
  }, [website]);

  const saveMutation = useMutation({
    mutationFn: (payload: { theme: Theme; overrides: string[] }) =>
      apiFetch("/api/website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: { ...payload.theme, [OVERRIDES_KEY]: payload.overrides } }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website"] });
      toast({ title: "Theme saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markOverridden = (keys: string[], on: boolean) => {
    setOverrides((current) => (on
      ? [...new Set([...current, ...keys])]
      : current.filter((key) => !keys.includes(key))));
  };

  const updateColor = (key: string, value: string) => {
    const touched = [key];
    setTheme((current) => {
      const next = { ...current, [key]: value };
      for (const pair of CONTRAST_PAIRS) {
        if (pair.backgroundKey !== key) continue;
        const background = next[pair.backgroundKey] || DEFAULT_THEME[pair.backgroundKey];
        const text = next[pair.textKey] || DEFAULT_THEME[pair.textKey];
        if (!hasAccessibleContrast(background, text)) {
          next[pair.textKey] = getAccessibleTextColor(background, text);
          touched.push(pair.textKey);
        }
      }
      return next;
    });
    markOverridden(touched, true);
  };

  const handleSave = () => {
    const next = sanitizeThemeColors(theme);
    setTheme(next);
    saveMutation.mutate({ theme: next, overrides });
  };

  const setKeys = (keys: string[], value: string | null) => {
    setTheme((current) => {
      const next = { ...current };
      for (const key of keys) {
        if (value === null) delete next[key];
        else next[key] = value;
      }
      return next;
    });
    markOverridden(keys, value !== null);
  };

  const resetToTemplate = () => {
    setOverrides([]);
    toast({ title: "Reverted to template styling", description: "Save to apply. Header and footer colours are unaffected." });
  };

  const value = (key: string) => theme[key] || DEFAULT_THEME[key];
  const accent = value("accent_color");
  const accentText = getAccessibleTextColor(accent, "#ffffff");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Theme</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Site-wide colours, fonts and shape. Anything you change here overrides the template on every block.</p>
          </div>
          <div className="flex items-center gap-2">
            {overrides.length > 0 && (
              <Button size="sm" variant="outline" onClick={resetToTemplate}>Use template styling</Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Theme
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="space-y-4">
            {COLOR_GROUPS.map((group) => (
              <div key={group.label} className="space-y-3 rounded-lg border p-4">
                <div>
                  <div className="text-sm font-semibold">{group.label}</div>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.keys.map((item) => (
                    <ColorInput
                      key={item.key}
                      label={item.label}
                      value={value(item.key)}
                      onChange={(next) => updateColor(item.key, next)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <div className="text-sm font-semibold">Typography</div>
                <p className="text-xs text-muted-foreground">Fonts load automatically on your live site.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {FONT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label>{field.label}</Label>
                    <Select
                      value={theme[field.key] || TEMPLATE_DEFAULT}
                      onValueChange={(v) => setKeys([field.key], v === TEMPLATE_DEFAULT ? null : v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TEMPLATE_DEFAULT}>Template default</SelectItem>
                        {FONT_OPTIONS.map((option) => (
                          <SelectItem key={option.stack} value={option.stack}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <div className="text-sm font-semibold">Shape &amp; Spacing</div>
                <p className="text-xs text-muted-foreground">Applied across every block. Leave on template default to keep the template's own spacing.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Corners</Label>
                  <Select
                    value={theme.card_radius || TEMPLATE_DEFAULT}
                    onValueChange={(v) => setKeys(CORNER_KEYS, v === TEMPLATE_DEFAULT ? null : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TEMPLATE_DEFAULT}>Template default</SelectItem>
                      {CORNER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Section Spacing</Label>
                  <Select
                    value={theme.padding_y || TEMPLATE_DEFAULT}
                    onValueChange={(v) => setKeys(["padding_y"], v === TEMPLATE_DEFAULT ? null : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TEMPLATE_DEFAULT}>Template default</SelectItem>
                      {SPACING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border" style={{ fontFamily: theme.body_font_family || undefined }}>
              <div className="px-4 py-3 text-sm font-semibold" style={{ backgroundColor: value("nav_background"), color: value("nav_text"), fontFamily: theme.heading_font_family || undefined }}>
                Your Business
              </div>
              <div className="space-y-3 p-4" style={{ backgroundColor: value("background_color"), color: value("text_color") }}>
                <div className="text-base font-bold" style={{ fontFamily: theme.heading_font_family || undefined }}>Heading example</div>
                <p className="text-sm" style={{ color: value("muted_text_color") }}>
                  Supporting copy shown in your muted text colour.
                </p>
                <div className="p-3" style={{ backgroundColor: value("muted_background"), border: `1px solid ${value("border_color")}`, borderRadius: theme.card_radius || "0.375rem" }}>
                  <div className="text-sm font-semibold">Card on an alternate section</div>
                </div>
                <div className="flex flex-wrap gap-2" style={{ fontFamily: theme.button_font_family || undefined }}>
                  <span className="px-3 py-2 text-sm font-bold" style={{ backgroundColor: accent, color: accentText, borderRadius: theme.button_radius || "0.375rem" }}>
                    Book a visit
                  </span>
                  <span className="px-3 py-2 text-sm font-bold" style={{ backgroundColor: value("primary_color"), color: value("primary_text_color"), borderRadius: theme.button_radius || "0.375rem" }}>
                    Get a quote
                  </span>
                </div>
              </div>
              <div className="px-4 py-3 text-xs" style={{ backgroundColor: value("footer_background"), color: value("footer_text") }}>
                © Your Business
              </div>
            </div>

            <div className="space-y-2">
              {CONTRAST_PAIRS.map((pair) => {
                const background = value(pair.backgroundKey);
                const text = value(pair.textKey);
                const ratio = getContrastRatio(background, text);
                const passes = hasAccessibleContrast(background, text);
                const recommendedText = getAccessibleTextColor(background, text);

                return (
                  <div key={pair.label} className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-xs">
                    <span className="truncate">{pair.label}</span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Badge variant={passes ? "default" : "destructive"} className={passes ? "bg-green-600" : ""}>
                        {ratio ? `${ratio.toFixed(2)}:1` : "Check"}
                      </Badge>
                      {!passes && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setTheme((t) => ({ ...t, [pair.textKey]: recommendedText }))}
                        >
                          Fix
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
