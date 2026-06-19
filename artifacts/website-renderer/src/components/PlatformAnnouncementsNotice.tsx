import type { PlatformAnnouncement } from "@/lib/api";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  info: { bg: "#eff6ff", border: "#93c5fd", text: "#1e3a8a", label: "Info" },
  warning: { bg: "#fffbeb", border: "#f59e0b", text: "#78350f", label: "Important" },
  critical: { bg: "#fef2f2", border: "#fca5a5", text: "#7f1d1d", label: "Critical" },
};

export default function PlatformAnnouncementsNotice({ announcements }: { announcements?: PlatformAnnouncement[] | null }) {
  const items = Array.isArray(announcements) ? announcements : [];
  if (items.length === 0) return null;

  return (
    <section aria-label="Platform announcements" style={{ borderBottom: "1px solid #e5e7eb" }}>
      {items.map((announcement) => {
        const style = SEVERITY_STYLES[announcement.severity] || SEVERITY_STYLES.info;
        return (
          <div
            key={announcement.id}
            style={{
              backgroundColor: style.bg,
              borderBottom: `1px solid ${style.border}`,
            }}
          >
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px", color: style.text, fontFamily: "system-ui, sans-serif" }}>
              <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.8 }}>
                {style.label}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "0.96rem", fontWeight: 700 }}>{announcement.title}</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.93rem", lineHeight: 1.45 }}>{announcement.body}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
