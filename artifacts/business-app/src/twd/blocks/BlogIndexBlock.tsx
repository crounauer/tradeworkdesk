import type { BlogPostItem } from '../types';

export type BlogIndexBlockProps = {
  eyebrow?: string;
  title: string;
  posts: BlogPostItem[];
};

export function BlogIndexBlock({
  eyebrow = 'Blog',
  title,
  posts,
}: BlogIndexBlockProps) {
  return (
    <section className="bg-slate-50 px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <article key={post.href} className="rounded-xl border border-slate-200 bg-white p-6">
              {post.date ? <p className="text-sm font-semibold text-amber-600">{post.date}</p> : null}
              <h3 className="mt-3 text-xl font-bold text-slate-950">{post.title}</h3>
              <p className="mt-3 text-slate-600">{post.excerpt}</p>
              <a href={post.href} className="mt-5 inline-block font-semibold text-slate-950">
                Read article →
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
