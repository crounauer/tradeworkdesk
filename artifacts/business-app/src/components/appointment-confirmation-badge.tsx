type AppointmentConfirmationStatus = "pending" | "confirmed" | "change_requested";

type AppointmentConfirmationBadgeProps = {
  status?: string | null;
  className?: string;
  showPending?: boolean;
};

const STATUS_STYLE: Record<AppointmentConfirmationStatus, string> = {
  pending: "border-slate-200 bg-slate-100 text-slate-700",
  confirmed: "border-emerald-200 bg-emerald-100 text-emerald-800",
  change_requested: "border-amber-200 bg-amber-100 text-amber-800",
};

const STATUS_LABEL: Record<AppointmentConfirmationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  change_requested: "Change Requested",
};

function normalizeStatus(status?: string | null): AppointmentConfirmationStatus | null {
  const value = String(status || "").trim().toLowerCase();
  if (value === "pending" || value === "confirmed" || value === "change_requested") {
    return value;
  }
  return null;
}

export function AppointmentConfirmationBadge({
  status,
  className,
  showPending = true,
}: AppointmentConfirmationBadgeProps) {
  const normalized = normalizeStatus(status);
  if (!normalized) return null;
  if (normalized === "pending" && !showPending) return null;

  const baseClasses = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold";
  const classes = [baseClasses, STATUS_STYLE[normalized], className].filter(Boolean).join(" ");

  return <span className={classes}>{STATUS_LABEL[normalized]}</span>;
}
