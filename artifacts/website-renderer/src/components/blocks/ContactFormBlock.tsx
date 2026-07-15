"use client";

import { useState, useRef, type FormEvent } from "react";
import { submitForm, submitWebsiteForm, uploadFormPhotos } from "@/lib/api";
import { isModernTemplateContent } from "@/lib/siteTheme";

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
  const websiteId = typeof content.website_id === "string" ? content.website_id : "";
  const configuredFormId =
    (typeof content.form_id === "string" && content.form_id.trim())
      ? content.form_id.trim()
      : (typeof content.formId === "string" && content.formId.trim())
        ? content.formId.trim()
        : "";

  const heading = (content.heading || content.title || "Get in Touch") as string;
  const label = (content.label || content.eyebrow) as string | undefined;
  const subheading = (content.subheading || content.subtitle) as string | undefined;
  const rootPhone = content.phone as string | undefined;
  const rootEmail = content.email as string | undefined;
  const rootAddress = content.address as string | undefined;
  const rootOpeningHours = content.openingHours as string | undefined;
  const isModernTradePayload = isModernTemplateContent(content);

  const {
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

  const layoutVariant = String(content.layout_variant || content.layout || "split-form").toLowerCase();
  const sectionBg = String(content.section_bg || content.background_color || "#f9fafb");
  const cardBg = String(content.card_bg || content.form_background || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const headingColor = String(content.heading_color || content.text_color || "#111827");
  const bodyColor = String(content.body_color || content.muted_text_color || "#6b7280");
  const iconBg = String(content.icon_bg || `${accent_color}15`);
  const iconColor = String(content.icon_color || accent_color);
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.6rem, 3vw, 2rem)");

  const contactRows = [
    mergedContactInfo?.phone ? { icon: "📞", label: "Phone", value: mergedContactInfo.phone, href: `tel:${mergedContactInfo.phone.replace(/\s/g, "")}` } : null,
    mergedContactInfo?.email ? { icon: "✉️", label: "Email", value: mergedContactInfo.email, href: `mailto:${mergedContactInfo.email}` } : null,
    mergedContactInfo?.address ? { icon: "📍", label: "Address", value: mergedContactInfo.address } : null,
    mergedContactInfo?.service_area ? { icon: "🗺️", label: "Service area", value: mergedContactInfo.service_area } : null,
    mergedContactInfo?.hours ? { icon: "🕐", label: "Opening hours", value: mergedContactInfo.hours } : null,
  ].filter(Boolean) as Array<{ icon: string; label: string; value: string; href?: string }>;

  const hasContactInfo = contactRows.length > 0;

  if (!configuredFormId && !websiteId) {
    return (
      <section id="contact" style={{ backgroundColor: sectionBg, color: headingColor, padding: "72px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {layoutVariant === "card-overlay" && (
            <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 14, padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
              {label && <p style={{ margin: "0 0 8px", color: accent_color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: bodyFont }}>{label}</p>}
              <h2 style={{ margin: "0 0 10px", fontSize: headingSize, color: headingColor, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
              {subheading && <p style={{ margin: "0 0 16px", color: bodyColor, lineHeight: 1.7, fontFamily: bodyFont }}>{subheading}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                {contactRows.map((row, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 34, height: 34, borderRadius: "50%", background: iconBg, color: iconColor, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{row.icon}</span>
                    <div style={{ color: bodyColor, fontFamily: bodyFont }}>
                      <strong style={{ color: headingColor }}>{row.label}</strong><br />
                      {row.href ? <a href={row.href} style={{ color: bodyColor, textDecoration: "none" }}>{row.value}</a> : row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {layoutVariant === "centered-stack" && (
            <div style={{ textAlign: "center" }}>
              {label && <p style={{ margin: "0 0 8px", color: accent_color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: bodyFont }}>{label}</p>}
              <h2 style={{ margin: "0 0 10px", fontSize: headingSize, color: headingColor, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
              {subheading && <p style={{ margin: "0 auto 18px", color: bodyColor, lineHeight: 1.7, maxWidth: 760, fontFamily: bodyFont }}>{subheading}</p>}
              <div style={{ display: "grid", gap: 12, maxWidth: 760, margin: "0 auto" }}>
                {contactRows.map((row, idx) => (
                  <div key={idx} style={{ border: `1px solid ${borderColor}`, borderRadius: 10, background: cardBg, padding: 12, display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                    <span style={{ width: 32, height: 32, borderRadius: "50%", background: iconBg, color: iconColor, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{row.icon}</span>
                    {row.href ? <a href={row.href} style={{ color: headingColor, textDecoration: "none", fontFamily: buttonFont, fontWeight: 700 }}>{row.value}</a> : <span style={{ color: headingColor, fontFamily: bodyFont }}>{row.value}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {layoutVariant === "minimal-list" && (
            <div>
              {label && <p style={{ margin: "0 0 8px", color: accent_color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: bodyFont }}>{label}</p>}
              <h2 style={{ margin: "0 0 10px", fontSize: headingSize, color: headingColor, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
              {subheading && <p style={{ margin: "0 0 14px", color: bodyColor, lineHeight: 1.7, fontFamily: bodyFont }}>{subheading}</p>}
              <div style={{ borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}>
                {contactRows.map((row, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: idx < contactRows.length - 1 ? `1px solid ${borderColor}` : "none" }}>
                    <span>{row.icon}</span>
                    <strong style={{ color: headingColor, fontFamily: headingFont }}>{row.label}:</strong>
                    {row.href ? <a href={row.href} style={{ color: bodyColor, textDecoration: "none", fontFamily: bodyFont }}>{row.value}</a> : <span style={{ color: bodyColor, fontFamily: bodyFont }}>{row.value}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(layoutVariant === "split-form" || !["card-overlay", "centered-stack", "minimal-list"].includes(layoutVariant)) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              <div>
                {label && <p style={{ margin: "0 0 8px", color: accent_color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: bodyFont }}>{label}</p>}
                <h2 style={{ margin: "0 0 10px", fontSize: headingSize, color: headingColor, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
                {subheading && <p style={{ margin: "0 0 14px", color: bodyColor, lineHeight: 1.7, fontFamily: bodyFont }}>{subheading}</p>}
              </div>
              <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: 16, display: "grid", gap: 10 }}>
                {contactRows.map((row, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 34, height: 34, borderRadius: "50%", background: iconBg, color: iconColor, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{row.icon}</span>
                    <div style={{ color: bodyColor, fontFamily: bodyFont }}>
                      <strong style={{ color: headingColor }}>{row.label}</strong><br />
                      {row.href ? <a href={row.href} style={{ color: bodyColor, textDecoration: "none" }}>{row.value}</a> : row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasContactInfo && <p style={{ color: bodyColor, fontFamily: bodyFont }}>Add phone, email or address details to display contact information.</p>}
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
      if (!configuredFormId) {
        setSubmitting(false);
        setError("Photo uploads are unavailable until this contact form is fully configured.");
        return;
      }

      photoUrls = await uploadFormPhotos(configuredFormId, photos);
      if (photoUrls.length === 0) {
        setSubmitting(false);
        setError("Photo upload failed. Please try again or submit without photos.");
        return;
      }
    }

    const payload = photoUrls.length > 0
      ? { ...values, photos: photoUrls, form_kind: form_kind || "contact" }
      : { ...values, form_kind: form_kind || "contact" };

    const result = configuredFormId
      ? await submitForm(configuredFormId, payload)
      : await submitWebsiteForm(websiteId, payload);

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
        <p style={{ fontSize: "1.25rem", color: accent_color, fontWeight: 600, fontFamily: headingFont }}>{success_message}</p>
      </section>
    );
  }

  const hasSplit = hasContactInfo;

  return (
    <section id="contact" style={{ padding: "72px 24px", backgroundColor: sectionBg }}>
      <style>{`
        .cf-layout { display: grid; grid-template-columns: 1fr; gap: 48px; }
        @media (min-width: 800px) { .cf-layout.split { grid-template-columns: 1fr 1.6fr; } }
      `}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className={`cf-layout${hasSplit ? " split" : ""}`}>
          {/* Left: heading + contact info */}
          <div>
            {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{label}</p>}
            {heading && <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>}
            {subheading && <p style={{ color: bodyColor, marginBottom: 32, lineHeight: 1.7, fontFamily: bodyFont }}>{subheading}</p>}
            {mergedContactInfo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 28 }}>
                {mergedContactInfo.phone && (
                  <a href={`tel:${mergedContactInfo.phone.replace(/\s/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
                    <span style={{ width: 44, height: 44, backgroundColor: iconBg, color: iconColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>📞</span>
                    <span style={{ fontWeight: 700, fontSize: "1.125rem", color: headingColor, fontFamily: buttonFont }}>{mergedContactInfo.phone}</span>
                  </a>
                )}
                {mergedContactInfo.email && (
                  <a href={`mailto:${mergedContactInfo.email}`} style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
                    <span style={{ width: 44, height: 44, backgroundColor: iconBg, color: iconColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>✉️</span>
                    <span style={{ color: bodyColor, fontSize: "1rem", fontFamily: bodyFont }}>{mergedContactInfo.email}</span>
                  </a>
                )}
                {mergedContactInfo.address && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ width: 44, height: 44, backgroundColor: iconBg, color: iconColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>📍</span>
                    <span style={{ color: bodyColor, fontSize: "1rem", lineHeight: 1.5, fontFamily: bodyFont }}>{mergedContactInfo.address}</span>
                  </div>
                )}
                {mergedContactInfo.service_area && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ width: 44, height: 44, backgroundColor: iconBg, color: iconColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🗺️</span>
                    <span style={{ color: bodyColor, fontSize: "1rem", lineHeight: 1.5, fontFamily: bodyFont }}>{mergedContactInfo.service_area}</span>
                  </div>
                )}
                {mergedContactInfo.hours && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ width: 44, height: 44, backgroundColor: iconBg, color: iconColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🕐</span>
                    <span style={{ color: bodyColor, fontSize: "1rem", lineHeight: 1.5, fontFamily: bodyFont }}>{mergedContactInfo.hours}</span>
                  </div>
                )}
              </div>
            )}
            {!hasSplit && heading && <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}></h2>}
          </div>

          {/* Right: form */}
          <div style={{ backgroundColor: cardBg, borderRadius: 12, padding: "36px", boxShadow: "0 1px 8px rgba(0,0,0,0.07)", border: `1px solid ${borderColor}` }}>
            {!hasSplit && heading && <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8, color: headingColor, fontFamily: headingFont }}>{heading}</h2>}
            {!hasSplit && subheading && <p style={{ color: bodyColor, marginBottom: 24, fontFamily: bodyFont }}>{subheading}</p>}
            <form onSubmit={handleSubmit}>
              {fields.map((field) => (
                <div key={field.name} style={{ marginBottom: 18 }}>
                  <label htmlFor={field.name} style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem", color: headingColor, fontFamily: bodyFont }}>
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
                      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${borderColor}`, borderRadius: 6, fontSize: "0.9375rem", resize: "vertical", boxSizing: "border-box", color: headingColor, fontFamily: bodyFont }}
                    />
                  ) : field.type === "select" && field.options ? (
                    <select
                      id={field.name}
                      name={field.name}
                      required={field.required}
                      value={values[field.name] || ""}
                      onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${borderColor}`, borderRadius: 6, fontSize: "0.9375rem", backgroundColor: "#fff", boxSizing: "border-box", color: headingColor, fontFamily: bodyFont }}
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
                      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${borderColor}`, borderRadius: 6, fontSize: "0.9375rem", boxSizing: "border-box", color: headingColor, fontFamily: bodyFont }}
                    />
                  )}
                </div>
              ))}

              {/* Photo upload (optional, controlled by allow_photos prop) */}
              {allow_photos && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem", color: headingColor, fontFamily: bodyFont }}>
                    Photos <span style={{ fontWeight: 400, color: bodyColor }}>(optional, up to 5)</span>
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
                          <img src={src} alt={`Photo ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: `1px solid ${borderColor}` }} />
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
                    style={{ padding: "8px 16px", border: `1px dashed ${accent_color}`, borderRadius: 6, background: "transparent", color: accent_color, cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, fontFamily: buttonFont }}
                  >
                    📷 {photos.length === 0 ? "Add photos" : "Change photos"}
                  </button>
                </div>
              )}

              {error && <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                style={{ width: "100%", padding: "14px", backgroundColor: accent_color, color: "#fff", border: "none", borderRadius: 6, fontSize: "1rem", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, marginTop: 8, fontFamily: buttonFont }}
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
