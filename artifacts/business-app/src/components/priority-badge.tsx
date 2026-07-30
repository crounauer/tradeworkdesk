type PriorityValue = "low" | "medium" | "high" | "urgent";

type PriorityBadgeProps = {
  priority?: string | null;
  className?: string;
};

const PRIORITY_STYLES: Record<PriorityValue, string> = {
  low: "border-slate-200 bg-slate-100 text-slate-700",
  medium: "border-blue-200 bg-blue-100 text-blue-700",
  high: "border-amber-200 bg-amber-100 text-amber-800",
  urgent: "border-red-200 bg-red-100 text-red-700",
};

function normalizePriority(priority?: string | null): PriorityValue | null {
  const value = String(priority || "").trim().toLowerCase();
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
    return value;
  }
  return null;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const normalized = normalizePriority(priority);
  if (!normalized) return null;

  const baseClasses = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  const resolvedClasses = [baseClasses, PRIORITY_STYLES[normalized], className].filter(Boolean).join(" ");

  return <span className={resolvedClasses}>{normalized}</span>;
}
