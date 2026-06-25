import type { ProcessContent } from "@/features/website-builder/websiteBuilderTypes";

export default function ProcessBlock({ process }: { process: ProcessContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h3 className="text-lg font-semibold mb-3">{process.heading}</h3>
      <ol className="space-y-2 list-decimal list-inside">
        {process.steps.map((step, i) => (
          <li key={`${step.title}-${i}`}>
            <span className="font-medium">{step.title}</span>
            <p className="text-sm text-muted-foreground ml-5">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
