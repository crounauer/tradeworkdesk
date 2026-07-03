import type { SiteData } from "@/lib/api";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    empty_message?: string;
  } & Record<string, unknown>;
  site?: SiteData;
}

export default function BlogIndexBlock({ content, site }: Props) {
  const posts = site?.blog_posts ?? [];

  const heading = String(content.heading || content.title || "Latest Articles");
  const subheading = String(content.subheading || content.subtitle || "");
  const label = String(content.label || content.eyebrow || "");
  const emptyMessage = String(content.empty_message || "No posts published yet.");

  const layout = String(content.layout_variant || content.layout || "editorial-list").toLowerCase();

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const cardBg = String(content.card_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const accentColor = String(content.accent_color || "#f97316");
  const headingColor = String(content.heading_color || content.text_color || "#111827");
  const bodyColor = String(content.body_color || content.muted_text_color || "#6b7280");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const bodySize = String(content.body_size || "1rem");
  const cardRadius = String(content.card_radius || "12px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1080px");

  const formatDate = (value: string | null) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const renderCategory = (name?: string | null) => (
    name ? (
      <span style={{ fontSize: "0.78rem", color: accentColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: bodyFont }}>
        {name}
      </span>
    ) : null
  );

  const renderTitle = (title: string, slug: string) => (
    <h3 style={{ margin: "8px 0", fontSize: "1.2rem", fontWeight: 700, fontFamily: headingFont, color: headingColor }}>
      <a href={`/blog/${slug}`} style={{ textDecoration: "none", color: headingColor }}>{title}</a>
    </h3>
  );

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, background: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: layout === "magazine" ? "left" : "center", marginBottom: 32 }}>
          {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{label}</p> : null}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
          {subheading ? <p style={{ color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}
        </div>

        {posts.length === 0 ? (
          <p style={{ color: bodyColor, textAlign: "center", fontFamily: bodyFont }}>{emptyMessage}</p>
        ) : null}

        {posts.length > 0 && (layout === "minimal-list") ? (
          <div style={{ display: "grid", gap: 14 }}>
            {posts.map((post) => (
              <article key={post.id} style={{ borderBottom: `1px solid ${borderColor}`, paddingBottom: 12 }}>
                {renderCategory(post.website_blog_categories?.name)}
                {renderTitle(post.title, post.slug)}
                <time style={{ fontSize: "0.85rem", color: bodyColor, fontFamily: bodyFont }}>{formatDate(post.published_at)}</time>
              </article>
            ))}
          </div>
        ) : null}

        {posts.length > 0 && layout === "card-grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
            {posts.map((post) => (
              <article key={post.id} style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, overflow: "hidden" }}>
                {post.featured_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.featured_image_url} alt={post.title} style={{ width: "100%", height: 150, objectFit: "cover" }} />
                ) : null}
                <div style={{ padding: 14 }}>
                  {renderCategory(post.website_blog_categories?.name)}
                  {renderTitle(post.title, post.slug)}
                  {post.excerpt ? <p style={{ color: bodyColor, lineHeight: 1.6, margin: "0 0 10px", fontFamily: bodyFont, fontSize: bodySize }}>{post.excerpt}</p> : null}
                  <time style={{ fontSize: "0.85rem", color: bodyColor, fontFamily: bodyFont }}>{formatDate(post.published_at)}</time>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {posts.length > 0 && layout === "magazine" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 20 }}>
            <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, overflow: "hidden" }}>
              {posts[0]?.featured_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posts[0].featured_image_url} alt={posts[0].title} style={{ width: "100%", height: 230, objectFit: "cover" }} />
              ) : null}
              <div style={{ padding: 16 }}>
                {renderCategory(posts[0]?.website_blog_categories?.name)}
                {renderTitle(posts[0]?.title || "", posts[0]?.slug || "")}
                {posts[0]?.excerpt ? <p style={{ color: bodyColor, margin: "0 0 10px", lineHeight: 1.7, fontFamily: bodyFont }}>{posts[0].excerpt}</p> : null}
                <time style={{ fontSize: "0.85rem", color: bodyColor, fontFamily: bodyFont }}>{formatDate(posts[0]?.published_at || null)}</time>
              </div>
            </article>
            <div style={{ display: "grid", gap: 12 }}>
              {posts.slice(1, 5).map((post) => (
                <article key={post.id} style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 12 }}>
                  {renderCategory(post.website_blog_categories?.name)}
                  {renderTitle(post.title, post.slug)}
                  <time style={{ fontSize: "0.85rem", color: bodyColor, fontFamily: bodyFont }}>{formatDate(post.published_at)}</time>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {posts.length > 0 && (layout === "editorial-list" || !["minimal-list", "card-grid", "magazine"].includes(layout)) ? (
          <div style={{ display: "grid", gap: 20 }}>
            {posts.map((post) => (
              <article key={post.id} style={{ display: "grid", gap: 16, gridTemplateColumns: post.featured_image_url ? "170px 1fr" : "1fr", alignItems: "start", border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 12 }}>
                {post.featured_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.featured_image_url} alt={post.title} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8 }} />
                ) : null}
                <div>
                  {renderCategory(post.website_blog_categories?.name)}
                  {renderTitle(post.title, post.slug)}
                  {post.excerpt ? <p style={{ color: bodyColor, lineHeight: 1.7, margin: "0 0 12px", fontFamily: bodyFont, fontSize: bodySize }}>{post.excerpt}</p> : null}
                  <time style={{ fontSize: "0.85rem", color: bodyColor, fontFamily: bodyFont }}>{formatDate(post.published_at)}</time>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
