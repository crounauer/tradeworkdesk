import type { FaqsContent } from "@/features/website-builder/websiteBuilderTypes";

export default function FaqBlock({ faqs }: { faqs: FaqsContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h3 className="text-lg font-semibold mb-3">{faqs.heading}</h3>
      <div className="space-y-3">
        {faqs.items.map((item, i) => (
          <div key={`${item.question}-${i}`} className="rounded border p-3">
            <p className="font-medium">{item.question}</p>
            <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
