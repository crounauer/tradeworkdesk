import { getSiteByDomain } from "@/lib/api";
import { getRequestDomain } from "@/lib/request-domain";
import TemplateLayout from "@/components/layout/TemplateLayout";
import PageRenderer from "@/components/PageRenderer";
import type { ReactNode } from "react";

export default async function NotFound(): Promise<ReactNode> {
  const domain = await getRequestDomain("");
  const site = domain ? await getSiteByDomain(domain) : null;

  const notFoundPage = site?.pages.find((page) => page.page_type === "404" || page.slug === "/404" || page.slug === "404");

  if (site && notFoundPage) {
    return (
      <TemplateLayout site={site}>
        <PageRenderer
          websiteId={site.website.id}
          slug={notFoundPage.slug}
          page={notFoundPage}
          site={site}
          theme={site.website.theme as Record<string, string>}
          tenantId={site.website.tenant_id}
          companyContact={{
            phone: site.company?.phone || null,
            email: site.company?.email || null,
          }}
        />
      </TemplateLayout>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: "4rem", fontWeight: 800, color: "#f97316", margin: "0 0 16px" }}>404</h1>
        <p style={{ fontSize: "1.25rem", color: "#374151", margin: "0 0 32px" }}>
          Sorry, we couldn&apos;t find that page.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            backgroundColor: "#f97316",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
