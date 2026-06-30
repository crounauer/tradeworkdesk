"use client";

/**
 * OnlineBookingBlock — customer-facing booking widget embedded in website pages.
 *
 * Flow:
 *   Step 1  — Select service (routine vs complex flagged by service metadata)
 *   Step 2  — Gather job details (description, photos not yet, postcode, notes)
 *   Step 3  — Pick date + time slot (available slots from API)
 *   Step 4  — Enter contact details
 *   Step 5  — Confirm + submit
 *   Result  — auto_confirm=true  → "Booking confirmed" message
 *           — auto_confirm=false → "Request received, we'll be in touch" message
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL || "https://tradeworkdesk-api.fly.dev"
    : "https://tradeworkdesk-api.fly.dev";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  price_type: "fixed" | "from" | "free" | "tbc";
  requires_approval?: boolean; // set in service description as JSON hint — see below
}

interface Slot {
  start: string;
  end: string;
}

interface Props {
  content: {
    tenant_id?: string;
    heading?: string;
    subheading?: string;
    accent_color?: string;
    show_price?: boolean;
    require_postcode?: boolean;
    require_description?: boolean;
    complex_keywords?: string; // comma-separated words that flag a job as complex
  } & Record<string, unknown>;
}

type Step = "service" | "details" | "slots" | "contact" | "confirm" | "done";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Group slots by date
function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const date = s.start.split("T")[0];
    (acc[date] = acc[date] || []).push(s);
    return acc;
  }, {});
}

// Determine if a service is complex based on keywords in the description or name
function isComplexService(service: Service, complexKeywords: string[]): boolean {
  if (complexKeywords.length === 0) return false;
  const text = (service.name + " " + (service.description || "")).toLowerCase();
  return complexKeywords.some((kw) => text.includes(kw.toLowerCase()));
}

export default function OnlineBookingBlock({ content }: Props) {
  const {
    tenant_id,
    heading = "Book an Appointment",
    subheading = "Choose a service and pick a time that suits you.",
    accent_color = "#1d4ed8",
    show_price = true,
    require_postcode = true,
    require_description = true,
    complex_keywords = "repair,breakdown,fault,emergency,not working,no hot water,leak",
  } = content;

  const complexKws = complex_keywords.split(",").map((s) => s.trim()).filter(Boolean);

  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Form state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isComplex, setIsComplex] = useState(false);
  const [description, setDescription] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");

  // Slot state
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotWeekOffset, setSlotWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Contact
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Result
  const [submitting, setSubmitting] = useState(false);
  const [resultStatus, setResultStatus] = useState<"confirmed" | "pending" | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  // Load services
  useEffect(() => {
    if (!tenant_id) return;
    fetch(`${API_BASE}/api/public/booking/${tenant_id}/services`)
      .then((r) => r.json())
      .then((data: Service[]) => {
        setServices(Array.isArray(data) ? data : []);
        setLoadingServices(false);
      })
      .catch(() => setLoadingServices(false));
  }, [tenant_id]);

  // Load slots for current week window
  const loadSlots = useCallback(() => {
    if (!tenant_id || !selectedService) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    const from = new Date();
    from.setDate(from.getDate() + slotWeekOffset * 7 + 1);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    fetch(
      `${API_BASE}/api/public/booking/${tenant_id}/slots?from=${fmt(from)}&to=${fmt(to)}&service_id=${selectedService.id}`
    )
      .then((r) => r.json())
      .then((data: Slot[]) => {
        setSlots(Array.isArray(data) ? data : []);
        setLoadingSlots(false);
      })
      .catch(() => setLoadingSlots(false));
  }, [tenant_id, selectedService, slotWeekOffset]);

  useEffect(() => {
    if (step === "slots") loadSlots();
  }, [step, loadSlots]);

  async function handleSubmit() {
    if (!tenant_id || !selectedSlot || !selectedService) return;
    setSubmitting(true);
    setResultError(null);
    try {
      const body = {
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim() || undefined,
        customer_address: address.trim() || undefined,
        customer_postcode: postcode.trim() || undefined,
        service_catalogue_id: selectedService.id,
        scheduled_start: selectedSlot.start,
        notes: [
          description ? "Job details: " + description : "",
          notes ? "Additional notes: " + notes : "",
          isComplex ? "(Flagged as complex — awaiting confirmation)" : "",
        ].filter(Boolean).join("\n") || undefined,
        requires_approval: isComplex ? true : undefined,
      };
      const res = await fetch(`${API_BASE}/api/public/booking/${tenant_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { status?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to submit booking");
      setResultStatus(data.status === "confirmed" ? "confirmed" : "pending");
      setStep("done");
    } catch (err) {
      setResultError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenant_id) return null;

  const btn = (
    label: string,
    onClick: () => void,
    disabled = false,
    variant: "primary" | "outline" = "primary"
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 22px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        border: variant === "outline" ? `2px solid ${accent_color}` : "none",
        background: variant === "outline" ? "transparent" : accent_color,
        color: variant === "outline" ? accent_color : "#fff",
        transition: "opacity .15s",
      }}
    >
      {label}
    </button>
  );

  const input = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { type?: string; required?: boolean; placeholder?: string }
  ) => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
        {label}{opts?.required && <span style={{ color: "#ef4444" }}> *</span>}
      </span>
      <input
        type={opts?.type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder || ""}
        required={opts?.required}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 14, boxSizing: "border-box" }}
      />
    </label>
  );

  const textarea = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { required?: boolean; placeholder?: string; rows?: number }
  ) => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
        {label}{opts?.required && <span style={{ color: "#ef4444" }}> *</span>}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder || ""}
        rows={opts?.rows || 3}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
      />
    </label>
  );

  const stepBar = (current: Step) => {
    const steps: { key: Step; label: string }[] = [
      { key: "service", label: "Service" },
      { key: "details", label: "Details" },
      { key: "slots", label: "Date & Time" },
      { key: "contact", label: "Your Info" },
      { key: "confirm", label: "Confirm" },
    ];
    const idx = steps.findIndex((s) => s.key === current);
    return (
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "2px solid #e5e7eb", paddingBottom: 12 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px",
              background: i < idx ? accent_color : i === idx ? accent_color : "#e5e7eb",
              color: i <= idx ? "#fff" : "#9ca3af",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
            }}>
              {i < idx ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: 11, color: i <= idx ? accent_color : "#9ca3af", fontWeight: i === idx ? 700 : 400 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section style={{ padding: "56px 16px", background: "#f8fafc" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(1.5rem,4vw,2.25rem)", fontWeight: 800, color: "#111827", margin: 0 }}>{heading}</h2>
          {subheading && <p style={{ marginTop: 10, fontSize: 16, color: "#6b7280" }}>{subheading}</p>}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", padding: "32px 28px" }}>

          {/* ── Step 1: Service ── */}
          {step === "service" && (
            <>
              {stepBar("service")}
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>What do you need?</h3>
              {loadingServices ? (
                <p style={{ color: "#6b7280" }}>Loading services…</p>
              ) : services.length === 0 ? (
                <p style={{ color: "#6b7280" }}>No services available at this time. Please call us to book.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {services.map((svc) => {
                    const complex = isComplexService(svc, complexKws);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => {
                          setSelectedService(svc);
                          setIsComplex(complex);
                          setStep("details");
                        }}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "14px 18px", borderRadius: 10, border: `2px solid #e5e7eb`,
                          background: "#fff", cursor: "pointer", textAlign: "left",
                          transition: "border-color .15s",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = accent_color)}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{svc.name}</div>
                          {svc.description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{svc.description}</div>}
                          {complex && (
                            <div style={{ fontSize: 12, color: "#d97706", marginTop: 4, fontWeight: 600 }}>
                              ⚠ Likely requires a call-back before confirming
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                          {show_price && svc.price_type !== "free" && svc.price_type !== "tbc" && svc.price && (
                            <div style={{ fontWeight: 700, color: accent_color, fontSize: 15 }}>
                              {svc.price_type === "from" ? "from " : ""}£{svc.price}
                            </div>
                          )}
                          {show_price && svc.price_type === "free" && <div style={{ color: "#16a34a", fontWeight: 700 }}>Free</div>}
                          {show_price && svc.price_type === "tbc" && <div style={{ color: "#6b7280", fontSize: 13 }}>Price TBC</div>}
                          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{svc.duration_minutes} min</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Details ── */}
          {step === "details" && selectedService && (
            <>
              {stepBar("details")}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Service: {selectedService.name}</div>
                {isComplex && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef9c3", borderRadius: 8, borderLeft: `4px solid #d97706`, fontSize: 13, color: "#92400e" }}>
                    <strong>This type of job usually needs a call-back before we can confirm an appointment.</strong>{" "}
                    We'll review your request and contact you within 2 hours to confirm a time.
                  </div>
                )}
              </div>

              {require_description && textarea(
                isComplex ? "Describe the problem *" : "Describe the work needed (optional)",
                description,
                setDescription,
                {
                  required: isComplex,
                  placeholder: isComplex
                    ? "E.g. Boiler not firing, no hot water since yesterday. Make/model if known…"
                    : "E.g. Annual boiler service, Worcester Bosch Greenstar 30i…",
                  rows: 4,
                }
              )}

              {require_postcode && input("Postcode", postcode, setPostcode, { required: true, placeholder: "NE1 1AA" })}

              {textarea("Anything else we should know? (optional)", notes, setNotes, {
                placeholder: "Access codes, parking info, best time to call…",
                rows: 2,
              })}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {btn("Back", () => setStep("service"), false, "outline")}
                {btn(
                  "Next: Choose a time",
                  () => setStep("slots"),
                  !!(require_description && isComplex && !description.trim()) || !!(require_postcode && !postcode.trim())
                )}
              </div>
            </>
          )}

          {/* ── Step 3: Slots ── */}
          {step === "slots" && (
            <>
              {stepBar("slots")}
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: "#1f2937" }}>Choose a date and time</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>All times are shown in local time.</p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button
                  onClick={() => { setSlotWeekOffset((o) => Math.max(0, o - 1)); }}
                  disabled={slotWeekOffset === 0}
                  style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", cursor: slotWeekOffset === 0 ? "not-allowed" : "pointer", color: "#374151" }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                  {slotWeekOffset === 0 ? "This week" : `+${slotWeekOffset} week${slotWeekOffset > 1 ? "s" : ""}`}
                </span>
                <button
                  onClick={() => setSlotWeekOffset((o) => o + 1)}
                  style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#374151" }}
                >
                  Next →
                </button>
              </div>

              {loadingSlots ? (
                <p style={{ color: "#6b7280", textAlign: "center", padding: "24px 0" }}>Loading available slots…</p>
              ) : slots.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ color: "#6b7280" }}>No slots available this week.</p>
                  <button onClick={() => setSlotWeekOffset((o) => o + 1)} style={{ marginTop: 8, color: accent_color, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Try next week →
                  </button>
                </div>
              ) : (
                Object.entries(groupByDate(slots)).map(([date, daySlots]) => (
                  <div key={date} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                      {formatDate(date + "T00:00:00")}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {daySlots.map((slot) => {
                        const selected = selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={slot.start}
                            onClick={() => setSelectedSlot(slot)}
                            style={{
                              padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
                              background: selected ? accent_color : "#f3f4f6",
                              color: selected ? "#fff" : "#374151",
                              border: selected ? `2px solid ${accent_color}` : "2px solid transparent",
                              transition: "all .12s",
                            }}
                          >
                            {formatTime(slot.start)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                {btn("Back", () => setStep("details"), false, "outline")}
                {btn("Next: Your details", () => setStep("contact"), !selectedSlot)}
              </div>
            </>
          )}

          {/* ── Step 4: Contact ── */}
          {step === "contact" && (
            <>
              {stepBar("contact")}
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>Your contact details</h3>
              {input("Full name", name, setName, { required: true, placeholder: "John Smith" })}
              {input("Email address", email, setEmail, { type: "email", required: true, placeholder: "john@example.com" })}
              {input("Phone number", phone, setPhone, { type: "tel", required: true, placeholder: "07700 900000" })}
              {input("Address (optional)", address, setAddress, { placeholder: "12 High Street" })}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {btn("Back", () => setStep("slots"), false, "outline")}
                {btn("Review booking", () => setStep("confirm"), !name.trim() || !email.trim() || !phone.trim())}
              </div>
            </>
          )}

          {/* ── Step 5: Confirm ── */}
          {step === "confirm" && selectedService && selectedSlot && (
            <>
              {stepBar("confirm")}
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>Review your booking</h3>

              {isComplex && (
                <div style={{ padding: "12px 16px", background: "#fef9c3", borderRadius: 8, borderLeft: `4px solid #d97706`, marginBottom: 16, fontSize: 13, color: "#92400e" }}>
                  <strong>Complex job — pending approval.</strong> We'll contact you to confirm this appointment before it's locked in.
                </div>
              )}

              <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 18px", marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
                <div><strong>Service:</strong> {selectedService.name}</div>
                <div><strong>Date &amp; Time:</strong> {formatDate(selectedSlot.start)} at {formatTime(selectedSlot.start)}</div>
                <div><strong>Name:</strong> {name}</div>
                <div><strong>Email:</strong> {email}</div>
                <div><strong>Phone:</strong> {phone}</div>
                {postcode && <div><strong>Postcode:</strong> {postcode}</div>}
                {description && <div><strong>Details:</strong> {description}</div>}
                {notes && <div><strong>Notes:</strong> {notes}</div>}
              </div>

              {resultError && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
                  {resultError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                {btn("Back", () => setStep("contact"), false, "outline")}
                {btn(submitting ? "Submitting…" : isComplex ? "Submit request" : "Confirm booking", handleSubmit, submitting)}
              </div>
            </>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{resultStatus === "confirmed" ? "✅" : "📋"}</div>
              {resultStatus === "confirmed" ? (
                <>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Booking confirmed!</h3>
                  <p style={{ color: "#374151", marginBottom: 4 }}>
                    <strong>{selectedService?.name}</strong> on {selectedSlot && formatDate(selectedSlot.start)} at {selectedSlot && formatTime(selectedSlot.start)}.
                  </p>
                  <p style={{ color: "#6b7280", fontSize: 14 }}>A confirmation has been sent to {email}.</p>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Request received!</h3>
                  <p style={{ color: "#374151", marginBottom: 4 }}>
                    We've received your {isComplex ? "request" : "booking request"} for <strong>{selectedService?.name}</strong>.
                  </p>
                  <p style={{ color: "#6b7280", fontSize: 14 }}>
                    {isComplex
                      ? "Because this is a more complex job, one of our team will call you within 2 hours to confirm your appointment."
                      : "We'll confirm your appointment shortly and send details to " + email + "."}
                  </p>
                </>
              )}
              <button
                onClick={() => {
                  setStep("service"); setSelectedService(null); setSelectedSlot(null);
                  setDescription(""); setPostcode(""); setNotes(""); setName(""); setEmail(""); setPhone(""); setAddress("");
                  setResultStatus(null); setResultError(null);
                }}
                style={{ marginTop: 20, background: "none", border: "none", color: accent_color, fontWeight: 600, cursor: "pointer", fontSize: 14 }}
              >
                Make another booking
              </button>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}
