import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, RotateCcw, Eye } from "lucide-react";
import { applyHomeTsxToClassicTemplate, classicTemplate } from "@/templates/classic/classic.template";
import { classicSampleContent } from "@/templates/classic/sample-content";
import WebsitePageEditor from "./WebsitePageEditor";
import WebsitePreviewPanel from "./WebsitePreviewPanel";
import { resolveTenantWebsiteContent, validateTenantWebsiteContent } from "./websiteContentSchema";
import type { TenantWebsiteContent } from "./websiteBuilderTypes";

const STORAGE_KEY = "twd.websiteBuilder.classic.draft";

function loadDraft(): TenantWebsiteContent {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return classicSampleContent;
  try {
    return resolveTenantWebsiteContent(JSON.parse(raw));
  } catch {
    return classicSampleContent;
  }
}

export default function WebsiteBuilderPage() {
  const { toast } = useToast();
  const [content, setContent] = useState<TenantWebsiteContent>(() => loadDraft());
  const [selectedPageSlug, setSelectedPageSlug] = useState("home");
  const [showPreview, setShowPreview] = useState(true);
  const [homeTsxSource, setHomeTsxSource] = useState("");

  const parsedTemplate = useMemo(() => {
    if (!homeTsxSource.trim()) return classicTemplate;
    return applyHomeTsxToClassicTemplate(homeTsxSource);
  }, [homeTsxSource]);

  const selectedPage = parsedTemplate.pages.find((p) => p.slug === selectedPageSlug) || parsedTemplate.pages[0];

  const onSave = () => {
    const errors = validateTenantWebsiteContent(content);
    if (errors.length) {
      toast({ title: "Validation failed", description: errors[0], variant: "destructive" });
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));

    // TODO: Wire save to Supabase `tenant_website_content` table:
    // - upsert tenant_id + draft_content/content + active_template_id
    toast({ title: "Saved", description: "Website draft content saved locally." });
  };

  const onReset = () => {
    setContent(classicSampleContent);
    toast({ title: "Reset", description: "Content reset to sample defaults." });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/website">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Website Builder (Classic)</h1>
            <p className="text-sm text-muted-foreground">Edit block content by page while preserving tenant data.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview((v) => !v)}><Eye className="w-4 h-4 mr-1" />{showPreview ? "Hide Preview" : "Show Preview"}</Button>
          <Button variant="outline" onClick={onReset}><RotateCcw className="w-4 h-4 mr-1" />Reset to sample</Button>
          <Button onClick={onSave}><Save className="w-4 h-4 mr-1" />Save</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Optional Home.tsx Parser Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Paste Home.tsx to extract page name and block order</Label>
          <Textarea value={homeTsxSource} onChange={(e) => setHomeTsxSource(e.target.value)} className="min-h-28" placeholder="Paste Home.tsx source here..." />
          <p className="text-xs text-muted-foreground">Parser updates Home page block cards only. Other pages remain from classic template source of truth.</p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[1fr,1fr] gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Page Block Editor</CardTitle>
              <div className="w-56">
                <Select value={selectedPage.slug} onValueChange={setSelectedPageSlug}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {parsedTemplate.pages.map((page) => (
                      <SelectItem key={page.slug} value={page.slug}>{page.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <WebsitePageEditor page={selectedPage} content={content} onChange={setContent} />
          </CardContent>
        </Card>

        {showPreview ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
            <CardContent>
              <WebsitePreviewPanel pageSlug={selectedPage.slug} content={content} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
