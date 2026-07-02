import type { HeroContent } from "@/features/website-builder/websiteBuilderTypes";

export default function HeroBlock({ hero }: { hero: HeroContent }) {

  return (
    <section className="rounded-md border p-6 bg-white">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{hero.eyebrow}</p>
      <h2 className="text-2xl font-bold mt-2">{hero.heading}</h2>
      <p className="text-sm text-muted-foreground mt-2">{hero.subheading}</p>
      <div className="flex gap-2 mt-4">
        <span className="text-xs rounded bg-primary text-primary-foreground px-2 py-1">{hero.primaryButtonText}</span>
        <span className="text-xs rounded border px-2 py-1">{hero.secondaryButtonText}</span>
      </div>
    </section>
  );
}
