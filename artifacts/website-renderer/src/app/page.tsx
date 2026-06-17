import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain } from "@/lib/api";
import TemplateLayout from "@/components/layout/TemplateLayout";
import PageRenderer from "@/components/PageRenderer";

// ISR — re-validate every 60 seconds
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const site = await getSiteByDomain(domain);
  if (!site) return {};

  const { website, company } = site;
  const title = website.default_meta_title || website.site_name;
  const description = website.default_meta_description || website.tagline || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    icons: website.favicon_url ? { icon: website.favicon_url } : undefined,
  };
}

export default async function HomePage() {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const site = await getSiteByDomain(domain);

  if (!site) notFound();

  const homePage = site.pages.find((p) => p.page_type === "home" || p.slug === "/") || site.pages[0];

  // No published pages yet — show a coming soon placeholder
  if (!homePage) {
    const { website, company } = site;
    const accent = (website.theme as Record<string, string>)?.accent_color || "#f97316";
    const displayName = (company as Record<string, string> | null)?.trading_name || (company as Record<string, string> | null)?.name || website.site_name;
    return (
      <TemplateLayout site={site}>
        <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 520 }}>
            <div style={{ width: 64, height: 64, backgroundColor: accent, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 28px" }}>🔧</div>
            <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, marginBottom: 16, color: "#111827" }}>{displayName}</h1>
            <p style={{ fontSize: "1.125rem", color: "#6b7280", marginBottom: 8 }}>Website coming soon.</p>
            {(company as Record<string, string> | null)?.phone && (
              <p style={{ fontSize: "1rem", color: "#374151", marginTop: 24 }}>
                Call us: <a href={`tel:${((company as Record<string, string>).phone).replace(/\s/g, "")}`} style={{ color: accent, fontWeight: 700, textDecoration: "none" }}>{(company as Record<string, string>).phone}</a>
              </p>
            )}
            {(company as Record<string, string> | null)?.email && (
              <p style={{ fontSize: "1rem", color: "#374151", marginTop: 8 }}>
                Email: <a href={`mailto:${(company as Record<string, string>).email}`} style={{ color: accent, fontWeight: 700, textDecoration: "none" }}>{(company as Record<string, string>).email}</a>
              </p>
            )}
          </div>
        </div>
      </TemplateLayout>
    );
  }

  return (
    <TemplateLayout site={site}>
      <PageRenderer
        websiteId={site.website.id}
        slug={homePage.slug}
        page={homePage}
      />
    </TemplateLayout>
  );
}
