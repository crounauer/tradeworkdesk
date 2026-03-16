import { Link, useParams } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, blogPostingSchema } from "@/lib/schema";
import { getPostBySlug, getRelatedPosts } from "@/data/blog-posts";
import { Clock, User, Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const post = getPostBySlug(params.slug || "");

  if (!post) {
    return (
      <MarketingLayout>
        <SEOHead
          title="Post Not Found"
          description="The blog post you're looking for doesn't exist."
          noindex
        />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl font-bold text-slate-900">Post not found</h1>
          <p className="mt-4 text-slate-600">The blog post you're looking for doesn't exist.</p>
          <Link href="/blog">
            <Button className="mt-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </MarketingLayout>
    );
  }

  const related = getRelatedPosts(post.slug, 3);

  const paragraphs = post.body.split("\n\n");

  return (
    <MarketingLayout>
      <SEOHead
        title={post.title}
        description={post.description}
        canonical={`${SITE_URL}/blog/${post.slug}`}
        ogType="article"
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Blog", url: `${SITE_URL}/blog` },
            { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
          ]),
          blogPostingSchema(post),
        ]}
      />

      <article className="bg-white">
        <div className="bg-gradient-to-br from-slate-50 to-white py-12 md:py-16 border-b border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
            <span className="inline-block px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full mb-4">
              {post.category}
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              {post.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {post.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {post.readingTimeMinutes} min read
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            {paragraphs.map((p, i) => {
              const trimmed = p.trim();
              if (trimmed.startsWith("## ")) {
                return <h2 key={i} className="font-display text-2xl font-bold text-slate-900 mt-10 mb-4">{trimmed.replace("## ", "")}</h2>;
              }
              if (trimmed.startsWith("### ")) {
                return <h3 key={i} className="font-display text-xl font-semibold text-slate-900 mt-8 mb-3">{trimmed.replace("### ", "")}</h3>;
              }
              if (trimmed.startsWith("- **") || trimmed.startsWith("1. **")) {
                const items = trimmed.split("\n").filter(Boolean);
                const isOrdered = trimmed.startsWith("1.");
                const Tag = isOrdered ? "ol" : "ul";
                return (
                  <Tag key={i} className={`my-4 space-y-2 ${isOrdered ? "list-decimal" : "list-disc"} pl-6`}>
                    {items.map((item, j) => {
                      const cleaned = item.replace(/^-\s+/, "").replace(/^\d+\.\s*/, "");
                      const parts = cleaned.split(/\*\*/);
                      return (
                        <li key={j} className="text-slate-700 leading-relaxed">
                          {parts.map((part, k) =>
                            k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                          )}
                        </li>
                      );
                    })}
                  </Tag>
                );
              }
              if (trimmed.startsWith("**") && trimmed.includes("?")) {
                const parts = trimmed.split(/\*\*/);
                return (
                  <div key={i} className="my-4">
                    {parts.map((part, k) =>
                      k % 2 === 1 ? (
                        <p key={k} className="font-semibold text-slate-900">{part}</p>
                      ) : part.trim() ? (
                        <p key={k} className="text-slate-700 leading-relaxed">{part}</p>
                      ) : null
                    )}
                  </div>
                );
              }
              if (!trimmed) return null;
              const parts = trimmed.split(/\*\*/);
              return (
                <p key={i} className="text-slate-700 leading-relaxed my-4">
                  {parts.map((part, k) =>
                    k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                  )}
                </p>
              );
            })}
          </div>

          <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-lg font-display font-bold text-primary">
                  {post.author.split(" ").map((n) => n[0]).join("")}
                </span>
              </div>
              <div>
                <p className="font-display font-semibold text-slate-900">{post.author}</p>
                <p className="text-sm text-slate-500">{post.authorRole}</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="bg-slate-50 py-16 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-slate-900 mb-8">Related articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/blog/${rp.slug}`}
                  className="group block bg-white rounded-xl border border-slate-200 p-6 hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <span className="text-xs font-medium text-primary">{rp.category}</span>
                  <h3 className="mt-2 font-display font-semibold text-slate-900 group-hover:text-primary transition-colors line-clamp-2">
                    {rp.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-2">{rp.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </MarketingLayout>
  );
}
