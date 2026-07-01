"use client";

import { useState, useRef, type FormEvent } from "react";
import { submitForm, uploadFormPhotos } from "@/lib/api";

interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  service_area?: string;
  hours?: string;
}

interface Props {
  content: {
    form_id?: string;
    form_kind?: string;
    heading?: string;
    title?: string;
    label?: string;
    eyebrow?: string;
    subheading?: string;
    subtitle?: string;
    submit_label?: string;
    success_message?: string;
    accent_color?: string;
    contact_info?: ContactInfo;
    allow_photos?: boolean;
    fields?: Array<{ name: string; label: string; type: string; required?: boolean; options?: string[] }>;
  } & Record<string, unknown>;
}

export default function ContactFormBlock({ content }: Props) {
  const heading = (content.heading || content.title || "Get in Touch") as string;
  const label = (content.label || content.eyebrow) as string | undefined;
  const subheading = (content.subheading || content.subtitle) as string | undefined;
  const rootPhone = content.phone as string | undefined;
  const rootEmail = content.email as string | undefined;
  const rootAddress = content.address as string | undefined;
  const rootOpeningHours = content.openingHours as string | undefined;
  const isModernTradePayload = Boolean(content.title || content.eyebrow || rootOpeningHours || rootAddress);

  const {
    form_id,
    form_kind,
    submit_label = "Send Message",
    success_message = "Thank you! We'll be in touch soon.",
    accent_color = "#0d9488",
    contact_info,
    allow_photos = true,
    fields = [
      { name: "name", label: "Full Name", type: "text", required: true },
      { name: "phone", label: "Phone Number", type: "tel", required: true },
      { name: "email", label: "Email Address", type: "email", required: true },
      { name: "message", label: "Message", type: "textarea" },
    ],
  } = content;

  const mergedContactInfo: ContactInfo | undefined = contact_info || (rootPhone || rootEmail || rootAddress || rootOpeningHours
    ? {
        phone: rootPhone,
        email: rootEmail,
        address: rootAddress,
        hours: rootOpeningHours,
      }
    : undefined);

  if (isModernTradePayload && !form_id) {
    return (
      <section id="contact" style={{ backgroundColor: "#020617", color: "#ffffff", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 40, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div>
            {label && <p style={{ color: "#fbbf24", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(1.9rem, 3.2vw, 2.6rem)", fontWeight: 800 }}>{heading}</h2>
            {subheading && <p style={{ margin: "0 0 24px", color: "#cbd5e1", lineHeight: 1.7 }}>{subheading}</p>}
            <div style={{ display: "grid", gap: 14, color: "#cbd5e1" }}>
              {rootPhone && <div><strong style={{ color: "#fff" }}>Phone</strong><br /><a href={`tel:${rootPhone.replace(/\s/g, "")}`} style={{ color: "#cbd5e1", textDecoration: "none" }}>{rootPhone}</a></div>}
              {rootEmail && <div><strong style={{ color: "#fff" }}>Email</strong><br /><a href={`mailto:${rootEmail}`} style={{ color: "#cbd5e1", textDecoration: "none" }}>{rootEmail}</a></div>}
              {rootAddress && <div><strong style={{ color: "#fff" }}>Address</strong><br />{rootAddress}</div>}
              {rootOpeningHours && <div><strong style={{ color: "#fff" }}>Opening hours</strong><br />{rootOpeningHours}</div>}
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", color: "#0f172a", borderRadius: 14, padding: "24px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "1.125rem", fontWeight: 700 }}>Enquiry form placeholder</p>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>This block is ready for your website builder form fields later.</p>
          </div>
        </div>
      </section>
    );
  }

  const [values, setValues] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!form_id) return null;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    setPhotos(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  function removePhoto(i: number) {
    const next = photos.filter((_, idx) => idx !== i);
    setPhotos(next);
    setPhotoPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Upload photos first (if any)
    let photoUrls: string[] = [];
    if (allow_photos && photos.length > 0) {
      photoUrls = await uploadFormPhotos(form_id!, photos);
      if (photoUrls.length === 0) {
        setSubmitting(false);
        setError("Photo upload failed. Please try again or submit without photos.");
        return;
      }
    }

    const payload = photoUrls.length > 0
      ? { ...values, photos: photoUrls, form_kind: form_kind || "contact" }
      : { ...values, form_kind: form_kind || "contact" };
    const result = await submitForm(form_id!, payload);

    setSubmitting(false);
    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error || "Something went wrong. Please try again.");
    }
  }

  if (success) {
    return (
      <section style={{ padding: "64px 24px", textAlign: "center" }}>
        <p style={{ fontSize: "1.25rem", color: "#16a34a", fontWeight: 600 }}>{success_message}</p>
      </section>
    );
  }

  const hasSplit = !!(mergedContactInfo && (mergedContactInfo.phone || mergedContactInfo.email || mergedContactInfo.address || mergedContactInfo.hours || mergedContactInfo.service_area));

  return (
    <section id="contact" style={{ padding: "72px 24px", backgroundColor: "#f9fafb" }}>
      <style>{`
        .cf-layout { display: grid; grid-template-columns: 1fr; gap: 48px; }
        @media (min-width: 800px) { .cf-layout.split { grid-template-columns: 1fr 1.6fr; } }
      `}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className={`cf-layout${hasSplit ? " split" : ""}`}>
          {/* Left: heading + contact info */}
          <div>
            {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
            {heading && <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>{heading}</h2>}
            {subheading && <p style={{ color: "#6b7280", marginBottom: 32, lineHeight: 1.7 }}>{subheading}</p>}
            {mergedContactInfo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 28 }}>
                {mergedContactInfo.phone && (
                  <a href={`tel:${mergedContactInfo.phone.replace(/\s/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
                    <span style={{ width: 44, height: 44, backgroundColor: `${accent_color}15`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>📞</span>
                    <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#111827" }}>{mergedContactInfo.phone}</span>
                  </a>
                )}
                {mergedContactInfo.email && (
                  <a href={`mailto:${mergedContactInfo.email}`} style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
                    <span style={{ width: 44, height: 44, backgroundColor: `${accent_color}15`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>✉️</span>
                    <span style={{ color: "#374151", fontSize: "1rem" }}>{mergedContactInfo.email}</span>
                  </a>
                )}
                {mergedContactInfo.address && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ width: 44, height: 44, backgroundColor: `${accent_color}15`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>📍</span>
                    <span style={{ color: "#374151", fontSize: "1rem", lineHeight: 1.5 }}>{mergedContactInfo.address}</span>
                  </div>
                )}
                {mergedContactInfo.service_area && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ width: 44, height: 44, backgroundColor: `${accent_color}15`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🗺️</span>
                    <span style={{ color: "#374151", fontSize: "1rem", lineHeight: 1.5 }}>{mergedContactInfo.service_area}</span>
                  </div>
                )}
                {mergedContactInfo.hours && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ width: 44, height: 44, backgroundColor: `${accent_color}15`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🕐</span>
                    <span style={{ color: "#374151", fontSize: "1rem", lineHeight: 1.5 }}>{mergedContactInfo.hours}</span>
                  </div>
                )}
              </div>
            )}
            {!hasSplit && heading && <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}></h2>}
          </div>

          {/* Right: form */}
          <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "36px", boxShadow: "0 1px 8px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb" }}>
            {!hasSplit && heading && <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>{heading}</h2>}
            {!hasSplit && subheading && <p style={{ color: "#666", marginBottom: 24 }}>{subheading}</p>}
            <form onSubmit={handleSubmit}>
              {fields.map((field) => (
                <div key={field.name} style={{ marginBottom: 18 }}>
                  <label htmlFor={field.name} style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem", color: "#374151" }}>
                    {field.label}{field.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      required={field.required}
                      rows={4}
                      value={values[field.name] || ""}
                      onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9375rem", resize: "vertical", boxSizing: "border-box" }}
                    />
                  ) : field.type === "select" && field.options ? (
                    <select
                      id={field.name}
                      name={field.name}
                      required={field.required}
                      value={values[field.name] || ""}
                      onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9375rem", backgroundColor: "#fff", boxSizing: "border-box" }}
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      id={field.name}
                      type={field.type}
                      name={field.name}
                      required={field.required}
                      value={values[field.name] || ""}
                      onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9375rem", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              ))}

              {/* Photo upload (optional, controlled by allow_photos prop) */}
              {allow_photos && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem", color: "#374151" }}>
                    Photos <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional, up to 5)</span>
                  </label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />
                  {photoPreviews.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      {photoPreviews.map((src, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Photo ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }} />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.75rem", lineHeight: "20px", textAlign: "center", padding: 0 }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    style={{ padding: "8px 16px", border: `1px dashed ${accent_color}`, borderRadius: 6, background: "transparent", color: accent_color, cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    📷 {photos.length === 0 ? "Add photos" : "Change photos"}
                  </button>
                </div>
              )}

              {error && <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                style={{ width: "100%", padding: "14px", backgroundColor: accent_color, color: "#fff", border: "none", borderRadius: 6, fontSize: "1rem", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, marginTop: 8 }}
              >
                {submitting ? "Sending…" : submit_label}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
