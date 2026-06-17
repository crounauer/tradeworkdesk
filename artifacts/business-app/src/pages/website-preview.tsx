/**
 * Website Preview — full-page iframe preview of the tenant's live site.
 * Supports device emulation (desktop / tablet / mobile) and a page picker.
 * URL: /website/preview?page=slug
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Monitor, Tablet, Smartphone, ExternalLink, RefreshCw, Globe } from "lucide-react";

interface Page {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  page_type: string;
}

interface WebsiteData {
  id: string;
  site_name: string;
  status: "draft" | "published";
  preview_url: string | null;
  domains: Array<{ id: string; domain: string; is_active: boolean; ssl_status: string; verification_status: string }>;
}

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { id: "tablet",  label: "Tablet",  icon: Tablet,  width: "768px" },
  { id: "mobile",  label: "Mobile",  icon: Smartphone, width: "390px" },
] as const;

export default function WebsitePreview() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const initialPage = params.get("page") ?? "";

  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [selectedPage, setSelectedPage] = useState(initialPage);
  const [iframeKey, setIframeKey] = useState(0); // force reload

  const { data: website } = useQuery<WebsiteData | null>({
    queryKey: ["/api/website"],
    queryFn: () => apiFetch("/api/website"),
  });

  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: ["/api/website/pages"],
    queryFn: () => apiFetch("/api/website/pages") ?? [],
    enabled: !!website,
  });

  const activeDomain = website?.domains.find(d => d.is_active);
  const currentDevice = DEVICES.find(d => d.id === device) ?? DEVICES[0];

  // Always prefer the renderer's /preview route — it shows draft pages too.
  // Only fall back to the live custom domain if preview_url isn't configured.
  const previewUrl = (() => {
    if (!website) return null;
    if (website.preview_url) {
      const base = website.preview_url;
      if (!selectedPage || selectedPage === "/" || selectedPage === "home") return base;
      return `${base}?page=${encodeURIComponent(selectedPage)}`;
    }
    // Fallback: live domain (published pages only)
    if (!activeDomain) return null;
    const base = `https://${activeDomain.domain}`;
    if (!selectedPage || selectedPage === "/" || selectedPage === "home") return base;
    const slug = selectedPage.startsWith("/") ? selectedPage : `/${selectedPage}`;
    return `${base}${slug}`;
  })();

  // External "open in new tab" always goes to the live domain if available
  const externalUrl = activeDomain
    ? (() => {
        const base = `https://${activeDomain.domain}`;
        if (!selectedPage || selectedPage === "/" || selectedPage === "home") return base;
        const slug = selectedPage.startsWith("/") ? selectedPage : `/${selectedPage}`;
        return `${base}${slug}`;
      })()
    : previewUrl;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0 flex-wrap">
        <Link href="/website">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <span className="font-medium text-sm">{website?.site_name ?? "Website Preview"}</span>

        {website && (
          <Badge variant={website.status === "published" ? "default" : "secondary"} className="text-xs">
            {website.status === "published" ? "Live" : "Draft"}
          </Badge>
        )}

        {/* Page picker */}
        {pages.length > 0 && (
          <Select value={selectedPage || "/"} onValueChange={(v) => { setSelectedPage(v === "/" ? "" : v); setIframeKey(k => k + 1); }}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Home" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="/">Home</SelectItem>
              {pages
                .filter(p => p.page_type !== "home")
                .map(p => (
                  <SelectItem key={p.id} value={p.slug}>
                    {p.title}
                    {p.status === "draft" && <span className="ml-1 text-muted-foreground">(draft)</span>}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {/* Device switcher */}
        <div className="flex items-center gap-1 ml-auto">
          {DEVICES.map(d => (
            <Button
              key={d.id}
              variant={device === d.id ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title={d.label}
              onClick={() => setDevice(d.id)}
            >
              <d.icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reload" onClick={() => setIframeKey(k => k + 1)}>
          <RefreshCw className="w-4 h-4" />
        </Button>

        {externalUrl && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Open in new tab" asChild>
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 bg-slate-100 flex items-start justify-center overflow-auto p-4">
        {!website ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Globe className="w-10 h-10 opacity-30" />
            <p className="text-sm">No website found. <Link href="/website" className="underline text-primary">Create your website first.</Link></p>
          </div>
        ) : !previewUrl ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 max-w-sm text-center">
            <Globe className="w-10 h-10 opacity-30" />
            <div>
              <p className="text-sm font-medium text-foreground">Preview unavailable</p>
              <p className="text-sm mt-1">The website renderer URL is not configured. Please contact support or add a custom domain.</p>
            </div>
            <Link href="/website/domain">
              <Button size="sm" variant="outline">Add a domain</Button>
            </Link>
          </div>
        ) : (
          <div
            className="bg-white shadow-xl rounded-lg overflow-hidden transition-all duration-300"
            style={{
              width: currentDevice.width,
              maxWidth: "100%",
              minHeight: "600px",
              height: "calc(100vh - 9rem)",
            }}
          >
            <iframe
              key={iframeKey}
              src={previewUrl ?? "about:blank"}
              title="Website Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        )}
      </div>
    </div>
  );
}
