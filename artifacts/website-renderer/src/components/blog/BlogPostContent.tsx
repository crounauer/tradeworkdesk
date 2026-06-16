import type { BlogPost } from "@/lib/api";
import Link from "next/link";

interface Props {
  post: BlogPost & { content?: unknown[] };
}

export default function BlogPostContent({ post }: Props) {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
      {post.website_blog_categories && (
        <Link
          href="/blog"
          style={{ fontSize: "0.8125rem", color: "#f97316", fontWeight: 600, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          ← {post.website_blog_categories.name}
        </Link>
      )}

      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: "16px 0 24px", lineHeight: 1.2 }}>
        {post.title}
      </h1>

      {post.published_at && (
        <time style={{ fontSize: "0.9375rem", color: "#6b7280", display: "block", marginBottom: 32 }}>
          Published {new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </time>
      )}

      {post.featured_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.featured_image_url}
          alt={post.title}
          style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 8, marginBottom: 40 }}
        />
      )}

      {post.excerpt && (
        <p style={{ fontSize: "1.25rem", color: "#374151", fontStyle: "italic", borderLeft: "4px solid #f97316", paddingLeft: 16, margin: "0 0 32px" }}>
          {post.excerpt}
        </p>
      )}

      {/* Blog post content is stored as blocks — render as simple paragraphs for now */}
      {Array.isArray(post.content) && post.content.map((block: unknown, i: number) => {
        const b = block as Record<string, unknown>;
        if (b.type === "paragraph" || !b.type) {
          return (
            <p key={i} style={{ lineHeight: 1.8, marginBottom: 20, color: "#374151" }}>
              {String(b.text || b.content || "")}
            </p>
          );
        }
        return null;
      })}

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
        <Link href="/blog" style={{ color: "#f97316", textDecoration: "none", fontWeight: 500 }}>
          ← Back to Blog
        </Link>
      </div>
    </main>
  );
}
