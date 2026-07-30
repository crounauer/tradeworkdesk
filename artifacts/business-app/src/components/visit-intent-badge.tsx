type VisitIntent = "standard" | "estimate";

type VisitIntentBadgeProps = {
  intent?: string | null;
  jobTypeLabel?: string | null;
  showStandard?: boolean;
  className?: string;
};

function resolveVisitIntent(intent?: string | null, jobTypeLabel?: string | null): VisitIntent | null {
  const normalizedIntent = String(intent || "").trim().toLowerCase();
  if (normalizedIntent === "estimate") return "estimate";
  if (normalizedIntent === "standard") return "standard";

  const label = String(jobTypeLabel || "").trim().toLowerCase();
  if (/\b(estimate|quote)\b/.test(label)) return "estimate";

  return null;
}

export function VisitIntentBadge({
  intent,
  jobTypeLabel,
  showStandard = true,
  className,
}: VisitIntentBadgeProps) {
  const resolved = resolveVisitIntent(intent, jobTypeLabel);
  if (!resolved) return null;
  if (resolved === "standard" && !showStandard) return null;

  const baseClasses = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  const variantClasses = resolved === "estimate"
    ? "border-amber-200 bg-amber-100 text-amber-800"
    : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={[baseClasses, variantClasses, className].filter(Boolean).join(" ")}>
      {resolved === "estimate" ? "Estimate" : "Standard"}
    </span>
  );
}
