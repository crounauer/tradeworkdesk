import type { BlogPost } from "@/lib/api";
import Link from "next/link";

interface Props {
  posts: BlogPost[];
  siteName: string;
}

export default function BlogList({ posts, siteName }: Props) {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: 40 }}>Blog</h1>

      {posts.length === 0 && (
        <p style={{ color: "#6b7280" }}>No posts published yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {posts.map((post) => (
          <article key={post.id} style={{ display: "flex", gap: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 32 }}>
            {post.featured_image_url && (
              <div style={{ flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.featured_image_url}
                  alt={post.title}
                  style={{ width: 200, height: 140, objectFit: "cover", borderRadius: 6 }}
                />
              </div>
            )}
            <div>
              {post.website_blog_categories && (
                <span style={{ fontSize: "0.8125rem", color: "#f97316", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {post.website_blog_categories.name}
                </span>
              )}
              <h2 style={{ margin: "8px 0", fontSize: "1.375rem", fontWeight: 700 }}>
                <Link href={`/blog/${post.slug}`} style={{ textDecoration: "none", color: "#111" }}>
                  {post.title}
                </Link>
              </h2>
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
    </main>
  );
}
