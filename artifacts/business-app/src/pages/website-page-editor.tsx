/**
 * Website Page Editor — block-based editor for a single CMS page.
 *
 * Layout:
 *   Left panel: Block palette (add new blocks)
 *   Centre:     Block list with inline editing
 *   Right panel: Page metadata (title, slug, SEO, status)
 *
 * Saving: all blocks are sent atomically via
 *   PUT /api/website/pages/:id/blocks
 * Page meta is saved via
 *   PATCH /api/website/pages/:id
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Eye, EyeOff, Globe, Save, Loader2, ChevronRight,
  Type, Image, Layout, MessageSquare, Star, Grid3X3,
  Phone, Award, Minus, Undo2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BlockType =
  | "hero"
  | "text"
  | "image"
  | "cta"
  | "services"
  | "contact_form"
  | "testimonials"
  | "gallery"
  | "accreditations"
  | "spacer";

interface Block {
  id: string;
  block_type: BlockType;
  content: Record<string, unknown>;
  sort_order: number;
  is_visible: boolean;
}

interface Page {
  id: string;
  website_id: string;
  slug: string;
  page_type: string;
  title: string;
  status: "draft" | "published" | "archived";
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  no_index: boolean;
  show_in_nav: boolean;
  nav_label: string | null;
  nav_order: number;
  blocks: Block[];
}

// ---------------------------------------------------------------------------
// Block palette config
// ---------------------------------------------------------------------------

const BLOCK_PALETTE: { type: BlockType; label: string; icon: React.ComponentType<{ className?: string }>; description: string; defaultContent: Record<string, unknown> }[] = [
  {
    type: "hero",
    label: "Hero Banner",
    icon: Layout,
    description: "Full-width hero section with heading, subheading and CTA button",
    defaultContent: {
      heading: "Your Heading Here",
      subheading: "A short description of your services or offer.",
      cta_text: "Get a Free Quote",
      cta_url: "/contact",
      background_color: "#1e40af",
      text_color: "#ffffff",
      align: "center",
    },
  },
  {
    type: "text",
    label: "Text Block",
    icon: Type,
    description: "Heading and rich text paragraph",
    defaultContent: {
      heading: "",
      body: "Add your content here.",
      align: "left",
    },
  },
  {
    type: "services",
    label: "Services Grid",
    icon: Grid3X3,
    description: "Grid of service cards with icon, title and description",
    defaultContent: {
      heading: "Our Services",
      items: [
        { title: "Boiler Servicing", description: "Annual service to keep your boiler running safely and efficiently.", icon: "🔥" },
        { title: "Boiler Repair", description: "Fast response to breakdowns — most repairs completed same day.", icon: "🔧" },
        { title: "Installation", description: "New boiler supply and installation with full commissioning.", icon: "⚙️" },
      ],
    },
  },
  {
    type: "cta",
    label: "Call to Action",
    icon: Phone,
    description: "Prominent CTA strip with heading and button",
    defaultContent: {
      heading: "Ready to book?",
      subheading: "Call us today or fill in our online form.",
      button_text: "Get a Free Quote",
      button_url: "/contact",
      background_color: "#f97316",
      text_color: "#ffffff",
    },
  },
  {
    type: "testimonials",
    label: "Testimonials",
    icon: Star,
    description: "Customer reviews and testimonials",
    defaultContent: {
      heading: "What Our Customers Say",
      show_rating: true,
    },
  },
  {
    type: "contact_form",
    label: "Contact Form",
    icon: MessageSquare,
    description: "Enquiry or quote request form",
    defaultContent: {
      heading: "Get in Touch",
      subheading: "Fill in the form below and we'll get back to you shortly.",
      form_type: "contact",
    },
  },
  {
    type: "gallery",
    label: "Photo Gallery",
    icon: Image,
    description: "Before/after photos and case studies",
    defaultContent: {
      heading: "Our Recent Work",
      columns: 3,
    },
  },
  {
    type: "accreditations",
    label: "Trust Badges",
    icon: Award,
    description: "Gas Safe, OFTEC and other accreditation logos",
    defaultContent: {
      heading: "Certified & Accredited",
      items: [
        { name: "Gas Safe Registered", logo_url: "" },
        { name: "OFTEC Registered", logo_url: "" },
      ],
    },
  },
  {
    type: "image",
    label: "Image",
    icon: Image,
    description: "Single image with optional caption",
    defaultContent: {
      image_url: "",
      alt_text: "",
      caption: "",
      width: "full",
    },
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: Minus,
    description: "Vertical spacing between sections",
    defaultContent: { height: "md" },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function generateId() {
  return `local_${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Block field editors
// ---------------------------------------------------------------------------

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (content: Record<string, unknown>) => void }) {
  const c = block.content;

  const set = (key: string, value: unknown) => onChange({ ...c, [key]: value });

  switch (block.block_type) {
    case "hero":
      return (
        <div className="space-y-3">
          <FieldRow label="Heading"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} /></FieldRow>
          <FieldRow label="Subheading"><Textarea value={String(c.subheading ?? "")} onChange={(e) => set("subheading", e.target.value)} rows={2} /></FieldRow>
          <FieldRow label="Button Text"><Input value={String(c.cta_text ?? "")} onChange={(e) => set("cta_text", e.target.value)} /></FieldRow>
          <FieldRow label="Button URL"><Input value={String(c.cta_url ?? "")} onChange={(e) => set("cta_url", e.target.value)} placeholder="/contact" /></FieldRow>
          <FieldRow label="Background Image URL"><Input value={String(c.background_image_url ?? "")} onChange={(e) => set("background_image_url", e.target.value)} placeholder="https://..." /></FieldRow>
          <div className="flex gap-3">
            <FieldRow label="Background Colour">
              <div className="flex items-center gap-2">
                <input type="color" value={String(c.background_color ?? "#1e40af")} onChange={(e) => set("background_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                <Input value={String(c.background_color ?? "")} onChange={(e) => set("background_color", e.target.value)} className="flex-1" />
              </div>
            </FieldRow>
            <FieldRow label="Text Colour">
              <div className="flex items-center gap-2">
                <input type="color" value={String(c.text_color ?? "#ffffff")} onChange={(e) => set("text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                <Input value={String(c.text_color ?? "")} onChange={(e) => set("text_color", e.target.value)} className="flex-1" />
              </div>
            </FieldRow>
          </div>
          <FieldRow label="Alignment">
            <Select value={String(c.align ?? "center")} onValueChange={(v) => set("align", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      );

    case "text":
      return (
        <div className="space-y-3">
          <FieldRow label="Heading (optional)"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} placeholder="Section heading..." /></FieldRow>
          <FieldRow label="Content">
            <Textarea value={String(c.body ?? "")} onChange={(e) => set("body", e.target.value)} rows={6} placeholder="Enter your content here..." />
          </FieldRow>
          <FieldRow label="Alignment">
            <Select value={String(c.align ?? "left")} onValueChange={(v) => set("align", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      );

    case "cta":
      return (
        <div className="space-y-3">
          <FieldRow label="Heading"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} /></FieldRow>
          <FieldRow label="Subheading"><Input value={String(c.subheading ?? "")} onChange={(e) => set("subheading", e.target.value)} /></FieldRow>
          <FieldRow label="Button Text"><Input value={String(c.button_text ?? "")} onChange={(e) => set("button_text", e.target.value)} /></FieldRow>
          <FieldRow label="Button URL"><Input value={String(c.button_url ?? "")} onChange={(e) => set("button_url", e.target.value)} placeholder="/contact" /></FieldRow>
          <div className="flex gap-3">
            <FieldRow label="Background">
              <div className="flex items-center gap-2">
                <input type="color" value={String(c.background_color ?? "#f97316")} onChange={(e) => set("background_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                <Input value={String(c.background_color ?? "")} onChange={(e) => set("background_color", e.target.value)} className="flex-1" />
              </div>
            </FieldRow>
            <FieldRow label="Text">
              <div className="flex items-center gap-2">
                <input type="color" value={String(c.text_color ?? "#ffffff")} onChange={(e) => set("text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                <Input value={String(c.text_color ?? "")} onChange={(e) => set("text_color", e.target.value)} className="flex-1" />
              </div>
            </FieldRow>
          </div>
        </div>
      );

    case "services": {
      const items = Array.isArray(c.items) ? c.items as Array<{ title: string; description: string; icon: string }> : [];
      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} /></FieldRow>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Service Items</Label>
            {items.map((item, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={item.icon} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], icon: e.target.value }; set("items", n); }} placeholder="🔥" className="w-16 text-center" />
                  <Input value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; set("items", n); }} placeholder="Service name" className="flex-1" />
                  <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => set("items", items.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Textarea value={item.description} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; set("items", n); }} placeholder="Short description..." rows={2} />
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => set("items", [...items, { title: "", description: "", icon: "⚙️" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Service
            </Button>
          </div>
        </div>
      );
    }

    case "testimonials":
      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} /></FieldRow>
          <p className="text-xs text-muted-foreground">Testimonials are pulled from your website testimonials database. Add them via the Testimonials section.</p>
        </div>
      );

    case "contact_form":
      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} /></FieldRow>
          <FieldRow label="Subheading"><Input value={String(c.subheading ?? "")} onChange={(e) => set("subheading", e.target.value)} /></FieldRow>
          <FieldRow label="Form Type">
            <Select value={String(c.form_type ?? "contact")} onValueChange={(v) => set("form_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contact">Contact / General Enquiry</SelectItem>
                <SelectItem value="quote">Quote Request</SelectItem>
                <SelectItem value="callback">Request a Callback</SelectItem>
                <SelectItem value="emergency">Emergency Callout</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      );

    case "gallery":
      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} /></FieldRow>
          <FieldRow label="Columns">
            <Select value={String(c.columns ?? "3")} onValueChange={(v) => set("columns", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 columns</SelectItem>
                <SelectItem value="3">3 columns</SelectItem>
                <SelectItem value="4">4 columns</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <p className="text-xs text-muted-foreground">Gallery images are pulled from your website gallery. Add them via the Gallery section.</p>
        </div>
      );

    case "accreditations": {
      const accs = Array.isArray(c.items) ? c.items as Array<{ name: string; logo_url: string }> : [];
      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading"><Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} /></FieldRow>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Accreditations</Label>
            {accs.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={item.name} onChange={(e) => { const n = [...accs]; n[i] = { ...n[i], name: e.target.value }; set("items", n); }} placeholder="Gas Safe Registered" className="flex-1" />
                <Input value={item.logo_url} onChange={(e) => { const n = [...accs]; n[i] = { ...n[i], logo_url: e.target.value }; set("items", n); }} placeholder="Logo URL" className="flex-1" />
                <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0" onClick={() => set("items", accs.filter((_, j) => j !== i))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set("items", [...accs, { name: "", logo_url: "" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Accreditation
            </Button>
          </div>
        </div>
      );
    }

    case "image":
      return (
        <div className="space-y-3">
          <FieldRow label="Image URL"><Input value={String(c.image_url ?? "")} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." /></FieldRow>
          <FieldRow label="Alt Text"><Input value={String(c.alt_text ?? "")} onChange={(e) => set("alt_text", e.target.value)} placeholder="Describe the image for accessibility" /></FieldRow>
          <FieldRow label="Caption (optional)"><Input value={String(c.caption ?? "")} onChange={(e) => set("caption", e.target.value)} /></FieldRow>
          <FieldRow label="Width">
            <Select value={String(c.width ?? "full")} onValueChange={(v) => set("width", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full width</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      );

    case "spacer":
      return (
        <FieldRow label="Height">
          <Select value={String(c.height ?? "md")} onValueChange={(v) => set("height", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small (1rem)</SelectItem>
              <SelectItem value="md">Medium (2rem)</SelectItem>
              <SelectItem value="lg">Large (4rem)</SelectItem>
              <SelectItem value="xl">Extra Large (6rem)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      );

    default:
      return <p className="text-xs text-muted-foreground">No editor for this block type.</p>;
  }
}

// ---------------------------------------------------------------------------
// Block card
// ---------------------------------------------------------------------------

function BlockCard({
  block,
  index,
  total,
  onMove,
  onToggleVisible,
  onDelete,
  onContentChange,
}: {
  block: Block;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onContentChange: (id: string, content: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const palette = BLOCK_PALETTE.find((p) => p.type === block.block_type);
  const Icon = palette?.icon ?? Layout;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={block.is_visible ? "" : "opacity-50"}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none py-3 px-4">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{palette?.label ?? block.block_type}</span>
                {block.content.heading && (
                  <span className="text-muted-foreground text-xs ml-2 truncate">— {String(block.content.heading)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={index === 0}
                  onClick={() => onMove(index, index - 1)}
                  title="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={index === total - 1}
                  onClick={() => onMove(index, index + 1)}
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => onToggleVisible(block.id)}
                  title={block.is_visible ? "Hide block" : "Show block"}
                >
                  {block.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete(block.id)}
                  title="Delete block"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 border-t">
            <div className="pt-3">
              <BlockEditor
                block={block}
                onChange={(content) => onContentChange(block.id, content)}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main page editor component
// ---------------------------------------------------------------------------

export default function WebsitePageEditor() {
  const { pageId } = useParams<{ pageId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [metaForm, setMetaForm] = useState({
    title: "",
    meta_title: "",
    meta_description: "",
    no_index: false,
    show_in_nav: true,
    nav_label: "",
  });

  // ── Fetch page + blocks
  const { data: page, isLoading } = useQuery<Page>({
    queryKey: [`/api/website/pages/${pageId}`],
    queryFn: () => apiFetch(`/api/website/pages/${pageId}`),
    enabled: !!pageId,
  });

  // Populate local state when page loads
  useEffect(() => {
    if (page) {
      setBlocks(
        [...(page.blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      );
      setMetaForm({
        title: page.title,
        meta_title: page.meta_title ?? "",
        meta_description: page.meta_description ?? "",
        no_index: page.no_index,
        show_in_nav: page.show_in_nav,
        nav_label: page.nav_label ?? "",
      });
      setIsDirty(false);
    }
  }, [page]);

  // ── Save blocks
  const saveBlocksMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/website/pages/${pageId}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: blocks.map((b, i) => ({
            block_type: b.block_type,
            content: b.content,
            sort_order: i,
            is_visible: b.is_visible,
          })),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/website/pages/${pageId}`] });
      setIsDirty(false);
      toast({ title: "Page saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  // ── Save page meta
  const saveMetaMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/website/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: metaForm.title,
          meta_title: metaForm.meta_title || null,
          meta_description: metaForm.meta_description || null,
          no_index: metaForm.no_index,
          show_in_nav: metaForm.show_in_nav,
          nav_label: metaForm.nav_label || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/website/pages/${pageId}`] });
      toast({ title: "Page settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Publish page
  const publishMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/website/pages/${pageId}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/website/pages/${pageId}`] });
      toast({ title: "Page published" });
    },
    onError: (e: Error) => toast({ title: "Publish failed", description: e.message, variant: "destructive" }),
  });

  // ── Block operations
  const addBlock = useCallback((type: BlockType) => {
    const palette = BLOCK_PALETTE.find((p) => p.type === type)!;
    const newBlock: Block = {
      id: generateId(),
      block_type: type,
      content: { ...palette.defaultContent },
      sort_order: blocks.length,
      is_visible: true,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setIsDirty(true);
  }, [blocks.length]);

  const moveBlock = useCallback((from: number, to: number) => {
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    setIsDirty(true);
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, is_visible: !b.is_visible } : b));
    setIsDirty(true);
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setDeletingBlockId(null);
    setIsDirty(true);
  }, []);

  const updateBlockContent = useCallback((id: string, content: Record<string, unknown>) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, content } : b));
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    saveBlocksMutation.mutate();
    if (
      page && (
        metaForm.title !== page.title ||
        metaForm.meta_title !== (page.meta_title ?? "") ||
        metaForm.meta_description !== (page.meta_description ?? "") ||
        metaForm.no_index !== page.no_index ||
        metaForm.show_in_nav !== page.show_in_nav ||
        metaForm.nav_label !== (page.nav_label ?? "")
      )
    ) {
      saveMetaMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Page not found.</p>
        <Link href="/website/pages"><Button variant="link" className="px-0 mt-2">← Back to pages</Button></Link>
      </div>
    );
  }

  const isSaving = saveBlocksMutation.isPending || saveMetaMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/website/pages">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{page.title}</h1>
            <p className="text-xs text-muted-foreground">/{page.slug}</p>
          </div>
          <Badge variant={page.status === "published" ? "default" : "secondary"} className="flex-shrink-0">
            {page.status}
          </Badge>
          {isDirty && <Badge variant="outline" className="flex-shrink-0 text-amber-600 border-amber-300">Unsaved changes</Badge>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDirty && (
            <Button variant="ghost" size="sm" onClick={() => { setBlocks([...(page.blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order)); setIsDirty(false); }}>
              <Undo2 className="w-3.5 h-3.5 mr-1" /> Discard
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || !isDirty} size="sm">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save
          </Button>
          {page.status === "draft" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || isDirty}
              title={isDirty ? "Save first before publishing" : undefined}
            >
              <Globe className="w-3.5 h-3.5 mr-1.5" /> Publish
            </Button>
          )}
        </div>
      </div>

      {/* ── 3-column layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: Block palette ──────────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 border-r bg-muted/30 overflow-y-auto p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground px-1 pb-1">Add Block</p>
          {BLOCK_PALETTE.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => addBlock(item.type)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                title={item.description}
              >
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                <Plus className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
              </button>
            );
          })}
        </aside>

        {/* ── Centre: Block list ───────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 space-y-2">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
              <Layout className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No blocks yet</p>
              <p className="text-sm mt-1">Choose a block from the left panel to start building this page.</p>
            </div>
          ) : (
            blocks.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                index={index}
                total={blocks.length}
                onMove={moveBlock}
                onToggleVisible={toggleVisible}
                onDelete={(id) => setDeletingBlockId(id)}
                onContentChange={updateBlockContent}
              />
            ))
          )}
        </main>

        {/* ── Right: Page settings ─────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 border-l overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-3">Page Settings</h2>
              <div className="space-y-3">
                <FieldRow label="Page Title">
                  <Input value={metaForm.title} onChange={(e) => setMetaForm((f) => ({ ...f, title: e.target.value }))} />
                </FieldRow>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Show in navigation</Label>
                  <Switch checked={metaForm.show_in_nav} onCheckedChange={(v) => setMetaForm((f) => ({ ...f, show_in_nav: v }))} />
                </div>
                {metaForm.show_in_nav && (
                  <FieldRow label="Nav Label">
                    <Input value={metaForm.nav_label} onChange={(e) => setMetaForm((f) => ({ ...f, nav_label: e.target.value }))} placeholder={metaForm.title} />
                  </FieldRow>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-sm font-semibold mb-3">SEO</h2>
              <div className="space-y-3">
                <FieldRow label="Meta Title">
                  <Input
                    value={metaForm.meta_title}
                    onChange={(e) => setMetaForm((f) => ({ ...f, meta_title: e.target.value }))}
                    placeholder={metaForm.title}
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">{metaForm.meta_title.length}/60 chars</p>
                </FieldRow>
                <FieldRow label="Meta Description">
                  <Textarea
                    value={metaForm.meta_description}
                    onChange={(e) => setMetaForm((f) => ({ ...f, meta_description: e.target.value }))}
                    placeholder="A short description for search engines..."
                    rows={3}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">{metaForm.meta_description.length}/160 chars</p>
                </FieldRow>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground">Hide from search engines</Label>
                    <p className="text-xs text-muted-foreground/70">Adds noindex tag</p>
                  </div>
                  <Switch checked={metaForm.no_index} onCheckedChange={(v) => setMetaForm((f) => ({ ...f, no_index: v }))} />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => saveMetaMutation.mutate()}
                disabled={saveMetaMutation.isPending}
              >
                {saveMetaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Page Settings
              </Button>
            </div>

            <Separator />

            <div>
              <h2 className="text-sm font-semibold mb-2">Version History</h2>
              <Link href={`/website/pages/${pageId}/history`}>
                <Button variant="outline" size="sm" className="w-full text-xs">
                  View History
                </Button>
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Delete block confirmation ────────────────────────────────────── */}
      <AlertDialog open={!!deletingBlockId} onOpenChange={(o) => !o && setDeletingBlockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete block?</AlertDialogTitle>
            <AlertDialogDescription>
              This block and all its content will be removed. You can undo by discarding changes before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingBlockId && deleteBlock(deletingBlockId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
