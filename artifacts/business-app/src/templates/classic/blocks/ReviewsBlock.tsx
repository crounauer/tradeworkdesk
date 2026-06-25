import type { ReviewsContent } from "@/features/website-builder/websiteBuilderTypes";

export default function ReviewsBlock({ reviews }: { reviews: ReviewsContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h3 className="text-lg font-semibold mb-3">{reviews.heading}</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {reviews.items.map((review, i) => (
          <div key={`${review.customerName}-${i}`} className="rounded border p-3">
            <p className="font-medium">{review.customerName} · {review.rating}/5</p>
            <p className="text-sm text-muted-foreground">{review.quote}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
