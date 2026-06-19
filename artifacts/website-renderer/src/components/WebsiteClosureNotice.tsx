import type { CompanySettings } from "@/lib/api";

function isWithinNoticeWindow(startDate: string | null | undefined, endDate: string | null | undefined): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (start && Number.isNaN(start.getTime())) return true;
  if (end && Number.isNaN(end.getTime())) return true;

  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(0, 0, 0, 0);

  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  const hasStart = !!startDate;
  const hasEnd = !!endDate;
  if (!hasStart && !hasEnd) return null;

  const fmt = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (hasStart && hasEnd) return `Closed ${fmt(startDate!)} to ${fmt(endDate!)}`;
  if (hasStart) return `Closed from ${fmt(startDate!)}`;
  return `Closed until ${fmt(endDate!)}`;
}

export default function WebsiteClosureNotice({ company }: { company: CompanySettings | null }) {
  if (!company?.website_closure_notice_enabled) return null;

  const message = (company.website_closure_notice_message || "").trim();
  if (!message) return null;

  if (!isWithinNoticeWindow(company.website_closure_notice_start_date, company.website_closure_notice_end_date)) {
    return null;
  }

  const dateLine = formatDateRange(company.website_closure_notice_start_date, company.website_closure_notice_end_date);

  return (
    <section style={{ backgroundColor: "#fef3c7", borderBottom: "1px solid #f59e0b" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px", color: "#78350f", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Service Update</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.95rem", lineHeight: 1.45 }}>{message}</p>
        {dateLine && <p style={{ margin: "4px 0 0", fontSize: "0.82rem", opacity: 0.9 }}>{dateLine}</p>}
      </div>
    </section>
  );
}
