import type { ReviewItem } from '../types';

export type ReviewsBlockProps = {
  eyebrow?: string;
  title: string;
  reviews: ReviewItem[];
  variant?: 'default' | 'classic';
  cardStyle?: 'default' | 'quote';
  background?: 'default' | 'white' | 'light';
};

export function ReviewsBlock({
  eyebrow = 'Reviews',
  title,
  reviews,
  variant = 'default',
  cardStyle = 'default',
  background = 'default',
}: ReviewsBlockProps) {
  const isClassic = variant === 'classic';
  const sectionClassName = background === 'light'
    ? 'bg-[#f0f4f9] px-6 py-20 lg:px-8'
    : 'bg-white px-6 py-20 lg:px-8';
  const cardClassName = cardStyle === 'quote' || isClassic
    ? 'rounded-sm border border-slate-300 bg-white p-6'
    : 'rounded-xl border border-slate-200 bg-slate-50 p-6';

  return (
    <section className={sectionClassName}>
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a6b]">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {reviews.map((review) => (
            <figure key={review.name + review.quote} className={cardClassName}>
              {review.rating ? (
                <p className="mb-4 text-sm font-bold text-[#1a3a6b]">{review.rating}/5 rating</p>
              ) : null}
              <blockquote className="text-slate-700">“{review.quote}”</blockquote>
              <figcaption className="mt-5 font-semibold text-slate-950">
                {review.name}
                {review.location ? <span className="font-normal text-slate-500">, {review.location}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
