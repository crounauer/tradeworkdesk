import { useState } from "react";
import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema } from "@/lib/schema";
import { blogPosts, type BlogPost } from "@/data/blog-posts";
import { Clock, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = ["All", ...Array.from(new Set(blogPosts.map((p) => p.category)))];

export default function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? blogPosts
      : blogPosts.filter((p) => p.category === activeCategory);

  return (
    <MarketingLayout>
      <SEOHead
        title="Blog — Guides & Resources for Heating Engineers"
        description="Practical guides, compliance tips, and business advice for gas, oil, and heat pump engineers. Written by industry professionals."
        canonical={`${SITE_URL}/blog`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Blog", url: `${SITE_URL}/blog` },
          ]),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">Blog</h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl">
            Practical guides, compliance tips, and business advice for heating engineers.
          </p>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-slate-500 py-12">No posts in this category yet.</p>
          )}
        </div>
      </section>
    </MarketingLayout>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all overflow-hidden"
    >
      <div className="p-6">
        <span className="inline-block px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full mb-3">
          {post.category}
        </span>
        <h2 className="font-display font-semibold text-lg text-slate-900 group-hover:text-primary transition-colors line-clamp-2">
          {post.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600 line-clamp-3">{post.description}</p>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {post.author}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.readingTimeMinutes} min read
          </span>
        </div>
        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Read more <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
