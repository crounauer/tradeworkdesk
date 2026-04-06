export default function JobConfirmationEmail() {
  return (
    <div style={{ background: "#f8fafc", padding: "40px 20px", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        }}
      >
        <div style={{ background: "#1d4ed8", padding: "28px 32px 20px", color: "#fff" }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 4 }}>
            ABC Heating &amp; Plumbing Ltd
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, margin: "2px 0" }}>
            Unit 5, Riverside Industrial Estate, 42 Thameside Road, Manchester, Greater Manchester, M15 4QR
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
            <span style={{ whiteSpace: "nowrap" }}>📞 0161 234 5678</span>
            &nbsp;&bull;&nbsp;
            <span style={{ whiteSpace: "nowrap" }}>✉️ info@abcheating.co.uk</span>
            &nbsp;&bull;&nbsp;
            <span style={{ whiteSpace: "nowrap" }}>🌐 www.abcheating.co.uk</span>
          </div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              marginTop: 8,
              borderTop: "1px solid rgba(255,255,255,.2)",
              paddingTop: 8,
            }}
          >
            Gas Safe: 123456 &nbsp;|&nbsp; OFTEC: OFT-78901 &nbsp;|&nbsp; VAT: GB 987 6543 21
          </div>
        </div>

        <div style={{ padding: 32, color: "#1e293b", lineHeight: 1.6, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Appointment Confirmation</h2>
          <p style={{ margin: "0 0 16px" }}>Dear Isaac Raven,</p>
          <p style={{ margin: "0 0 16px" }}>
            We're writing to confirm your upcoming appointment with{" "}
            <strong>ABC Heating &amp; Plumbing Ltd</strong>.
          </p>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 16,
              margin: "16px 0",
            }}
          >
            <p style={{ margin: "4px 0", fontSize: 14 }}><strong>Job Reference:</strong> JOB-2026-0078</p>
            <p style={{ margin: "4px 0", fontSize: 14 }}><strong>Type of Work:</strong> Boiler Service &amp; Gas Safety Check</p>
            <p style={{ margin: "4px 0", fontSize: 14 }}><strong>Date:</strong> Thursday, 3 April 2026 at 9:00am</p>
            <p style={{ margin: "4px 0", fontSize: 14 }}><strong>Property:</strong> 25 Mill Street, Crichie, AB42 5DP</p>
            <p style={{ margin: "4px 0", fontSize: 14 }}><strong>Engineer:</strong> Simon Ruddy</p>
          </div>

          <p style={{ margin: "0 0 16px" }}><strong>Notes:</strong> Boiler on constantly</p>

          <p style={{ margin: "0 0 16px" }}>
            Please ensure there is access to the property at the scheduled time. If you need to reschedule or have any questions, please contact us on{" "}
            <strong>0161 234 5678</strong> or email{" "}
            <a href="mailto:info@abcheating.co.uk" style={{ color: "#1d4ed8" }}>
              info@abcheating.co.uk
            </a>.
          </p>

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "20px 0" }} />
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Kind regards,
            <br />
            <strong>ABC Heating &amp; Plumbing Ltd</strong>
            <br />
            <em>Sent via TradeWorkDesk</em>
          </p>
        </div>

        <div
          style={{
            padding: "20px 32px",
            background: "#f1f5f9",
            fontSize: 12,
            color: "#64748b",
            textAlign: "center",
          }}
        >
          <a
            href="https://www.tradeworkdesk.co.uk"
            style={{ color: "#1d4ed8", fontWeight: 600, fontSize: 13, textDecoration: "none" }}
          >
            Powered by TradeWorkDesk
          </a>
          <span style={{ display: "block", margin: "4px 0 8px", fontSize: 11, color: "#94a3b8" }}>
            Simplify your trade service business —{" "}
            <a href="#" style={{ color: "#1d4ed8", textDecoration: "underline" }}>
              Learn more
            </a>
          </span>
          &copy; 2026 TradeWorkDesk Ltd. All rights reserved.
          <br />
          <span style={{ marginTop: 6, display: "block" }}>
            To stop receiving emails, contact us at{" "}
            <a href="mailto:support@tradeworkdesk.co.uk" style={{ color: "#64748b" }}>
              support@tradeworkdesk.co.uk
            </a>{" "}
            to unsubscribe.
          </span>
        </div>
      </div>
    </div>
  );
}
