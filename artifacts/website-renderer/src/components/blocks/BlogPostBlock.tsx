import type { SiteData, SitePage } from "@/lib/api";
import { sanitizeTenantHtml } from "@/lib/sanitize-html";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    body?: string;
    html?: string;
    text?: string;
    cta_text?: string;
    cta_url?: string;
    slug?: string;
  } & Record<string, unknown>;
  site?: SiteData;
  page?: SitePage;
}

export default function BlogPostBlock({ content, site, page }: Props) {
  const post = site?.blog_posts.find((item) => item.slug === page?.slug || item.slug === String(content.slug || ""));

  const heading = String(content.heading || content.title || post?.title || "Blog Post");
  const subheading = String(content.subheading || content.subtitle || "");
  const body = (content.html || content.body || content.text || post?.content) as string | undefined;
  const safeBody = sanitizeTenantHtml(body);

  const ctaText = String(content.cta_text || content.ctaText || "");
  const ctaUrl = String(content.cta_url || content.ctaUrl || "");

  const layout = String(content.layout_variant || content.layout || "classic-article").toLowerCase();

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const cardBg = String(content.card_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const accentColor = String(content.accent_color || "#f97316");
  const headingColor = String(content.heading_color || content.text_color || "#111827");
  const bodyColor = String(content.body_color || content.muted_text_color || "#374151");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");

  const headingSize = String(content.heading_size || "2rem");
  const bodySize = String(content.body_size || "1rem");
  const cardRadius = String(content.card_radius || "12px");
  const paddingY = String(content.padding_y || "64px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "860px");

  const articleBody = safeBody
    ? <div style={{ color: bodyColor, lineHeight: 1.85, fontFamily: bodyFont, fontSize: bodySize }} dangerouslySetInnerHTML={{ __html: safeBody }} />
    : (post?.excerpt ? <p style={{ color: bodyColor, lineHeight: 1.85, fontFamily: bodyFont, fontSize: bodySize }}>{post.excerpt}</p> : <p style={{ color: bodyColor, lineHeight: 1.85, fontFamily: bodyFont, fontSize: bodySize }}>No blog content is available for this post.</p>);

  const cta = ctaText && ctaUrl ? (
    <div style={{ marginTop: 28 }}>
      <a href={ctaUrl} style={{ display: "inline-block", padding: "12px 24px", backgroundColor: accentColor, color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontFamily: buttonFont }}>
        {ctaText}
      </a>
    </div>
  ) : null;

  const categoryName = post?.website_blog_categories?.name;
  const publishedDate = post?.published_at
    ? new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, background: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {layout === "split-aside" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(190px, 220px)", gap: 20 }}>
            <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 22 }}>
              {categoryName ? <p style={{ margin: "0 0 10px", color: accentColor, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: bodyFont }}>{categoryName}</p> : null}
              <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
              {subheading ? <p style={{ fontSize: "1.0625rem", color: bodyColor, lineHeight: 1.75, margin: "0 0 20px", fontFamily: bodyFont }}>{subheading}</p> : null}
              {articleBody}
              {cta}
            </article>
            <aside style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 14, alignSelf: "start", position: "sticky", top: 16 }}>
              <p style={{ margin: 0, color: headingColor, fontWeight: 700, fontFamily: headingFont }}>Article details</p>
              {publishedDate ? <p style={{ margin: "7px 0 0", color: bodyColor, fontFamily: bodyFont, fontSize: "0.85rem" }}>{publishedDate}</p> : null}
              {categoryName ? <p style={{ margin: "5px 0 0", color: bodyColor, fontFamily: bodyFont, fontSize: "0.85rem" }}>{categoryName}</p> : null}
            </aside>
          </div>
        ) : null}

        {layout === "hero-lead" ? (
          <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, overflow: "hidden" }}>
            <div style={{ height: 180, background: `linear-gradient(120deg, ${accentColor} 0%, #0f172a 100%)` }} />
            <div style={{ padding: 22 }}>
              {categoryName ? <p style={{ margin: "0 0 10px", color: accentColor, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: bodyFont }}>{categoryName}</p> : null}
              <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
              {subheading ? <p style={{ fontSize: "1.0625rem", color: bodyColor, lineHeight: 1.75, margin: "0 0 20px", fontFamily: bodyFont }}>{subheading}</p> : null}
              {publishedDate ? <p style={{ margin: "0 0 16px", color: bodyColor, fontFamily: bodyFont, fontSize: "0.9rem" }}>{publishedDate}</p> : null}
              {articleBody}
              {cta}
            </div>
          </article>
        ) : null}

        {layout === "minimal-prose" ? (
          <article>
            {categoryName ? <p style={{ margin: "0 0 10px", color: accentColor, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: bodyFont }}>{categoryName}</p> : null}
            <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
            {subheading ? <p style={{ fontSize: "1.0625rem", color: bodyColor, lineHeight: 1.75, margin: "0 0 20px", fontFamily: bodyFont }}>{subheading}</p> : null}
            {publishedDate ? <p style={{ margin: "0 0 16px", color: bodyColor, fontFamily: bodyFont, fontSize: "0.9rem" }}>{publishedDate}</p> : null}
            {articleBody}
            {cta}
          </article>
        ) : null}

        {(layout === "classic-article" || !["split-aside", "hero-lead", "minimal-prose"].includes(layout)) ? (
          <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 22 }}>
            {categoryName ? <p style={{ margin: "0 0 10px", color: accentColor, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: bodyFont }}>{categoryName}</p> : null}
            <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
            {subheading ? <p style={{ fontSize: "1.0625rem", color: bodyColor, lineHeight: 1.75, margin: "0 0 20px", fontFamily: bodyFont }}>{subheading}</p> : null}
            {publishedDate ? <p style={{ margin: "0 0 16px", color: bodyColor, fontFamily: bodyFont, fontSize: "0.9rem" }}>{publishedDate}</p> : null}
            {articleBody}
            {cta}
          </article>
        ) : null}
      </div>
    </section>
  );
}
