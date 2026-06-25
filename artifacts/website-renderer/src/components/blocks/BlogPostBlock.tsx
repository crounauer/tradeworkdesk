import type { SiteData, SitePage } from "@/lib/api";

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
  const heading = content.heading || post?.title || "Blog Post";
  const body = (content.html || content.body || content.text || post?.content) as string | undefined;

  return (
    <article style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>
      <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 16px", color: "#111827" }}>{heading}</h2>
      {content.subheading && <p style={{ fontSize: "1.0625rem", color: "#6b7280", lineHeight: 1.75, margin: "0 0 24px" }}>{content.subheading}</p>}
      {typeof body === "string" && <div style={{ color: "#374151", lineHeight: 1.85 }} dangerouslySetInnerHTML={{ __html: body }} />}
      {!body && post?.excerpt && <p style={{ color: "#374151", lineHeight: 1.85 }}>{post.excerpt}</p>}
      {content.cta_text && content.cta_url && (
        <div style={{ marginTop: 32 }}>
          <a href={content.cta_url} style={{ display: "inline-block", padding: "12px 24px", backgroundColor: "#f97316", color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700 }}>
            {content.cta_text}
          </a>
        </div>
      )}
    </article>
  );
}