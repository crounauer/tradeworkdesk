import { useEffect, useState } from "react";

export default function JobConfirmationEmail() {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const apiBase = window.location.origin.replace(
      /__mockup.*/,
      ""
    );
    fetch(`${apiBase}/api/email-preview/job-confirmation`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(setHtml)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div style={{ padding: 40, color: "#dc2626", fontFamily: "sans-serif" }}>
        <h2>Failed to load email preview</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", color: "#64748b" }}>
        Loading email preview...
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      style={{ width: "100%", height: "100vh", border: "none" }}
      title="Job Confirmation Email Preview"
    />
  );
}
