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
  const heading = content.heading || "Latest Articles";
  const subheading = content.subheading;
  const label = content.label;

  return (
    <section style={{ padding: "72px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          {label && <p style={{ color: "#f97316", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>{heading}</h2>
          {subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem" }}>{subheading}</p>}
        </div>

        {posts.length === 0 ? (
          <p style={{ color: "#6b7280", textAlign: "center" }}>{content.empty_message || "No posts published yet."}</p>
        ) : (
          <div style={{ display: "grid", gap: 24 }}>
            {posts.map((post) => (
              <article key={post.id} style={{ display: "grid", gap: 20, gridTemplateColumns: post.featured_image_url ? "180px 1fr" : "1fr", alignItems: "start", borderBottom: "1px solid #e5e7eb", paddingBottom: 24 }}>
                {post.featured_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.featured_image_url} alt={post.title} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }} />
                )}
                <div>
                  {post.website_blog_categories && (
                    <span style={{ fontSize: "0.8125rem", color: "#f97316", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {post.website_blog_categories.name}
                    </span>
                  )}
                  <h3 style={{ margin: "8px 0", fontSize: "1.375rem", fontWeight: 700 }}>
                    <a href={`/blog/${post.slug}`} style={{ textDecoration: "none", color: "#111827" }}>{post.title}</a>
                  </h3>
                  {post.excerpt && <p style={{ color: "#4b5563", lineHeight: 1.7, margin: "0 0 12px" }}>{post.excerpt}</p>}
                  {post.published_at && (
                    <time style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                      {new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </time>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}