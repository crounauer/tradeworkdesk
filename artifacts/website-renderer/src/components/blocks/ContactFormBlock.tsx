"use client";

import { useState, type FormEvent } from "react";
import { submitForm } from "@/lib/api";

interface Props {
  content: {
    form_id?: string;
    heading?: string;
    subheading?: string;
    submit_label?: string;
    success_message?: string;
    fields?: Array<{ name: string; label: string; type: string; required?: boolean }>;
  } & Record<string, unknown>;
}

export default function ContactFormBlock({ content }: Props) {
  const {
    form_id,
    heading = "Get in Touch",
    subheading,
    submit_label = "Send Message",
    success_message = "Thank you! We'll be in touch soon.",
    fields = [
      { name: "name", label: "Your Name", type: "text", required: true },
      { name: "email", label: "Email Address", type: "email", required: true },
      { name: "phone", label: "Phone Number", type: "tel" },
      { name: "message", label: "Message", type: "textarea", required: true },
    ],
  } = content;

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!form_id) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await submitForm(form_id!, values);

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

  return (
    <section style={{ padding: "64px 24px", backgroundColor: "#f9fafb" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {heading && <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>{heading}</h2>}
        {subheading && <p style={{ color: "#666", marginBottom: 32 }}>{subheading}</p>}

        <form onSubmit={handleSubmit}>
          {fields.map((field) => (
            <div key={field.name} style={{ marginBottom: 20 }}>
              <label
                htmlFor={field.name}
                style={{ display: "block", fontWeight: 500, marginBottom: 6 }}
              >
                {field.label}
                {field.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
              </label>

              {field.type === "textarea" ? (
                <textarea
                  id={field.name}
                  name={field.name}
                  required={field.required}
                  rows={5}
                  value={values[field.name] || ""}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: "1rem",
                    resize: "vertical",
                  }}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  name={field.name}
                  required={field.required}
                  value={values[field.name] || ""}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: "1rem",
                  }}
                />
              )}
            </div>
          ))}

          {error && (
            <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: "#f97316",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: "1.1rem",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Sending..." : submit_label}
          </button>
        </form>
      </div>
    </section>
  );
}
