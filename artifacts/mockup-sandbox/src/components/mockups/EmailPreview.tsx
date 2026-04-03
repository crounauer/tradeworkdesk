export default function EmailPreview() {
  return (
    <div style={{ background: "#f8fafc", padding: "40px 20px", minHeight: "100vh" }}>
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
        {/* Company Header */}
        <div style={{ background: "#1d4ed8", padding: "28px 32px 20px", color: "#fff" }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 4 }}>
            ABC Heating & Plumbing Ltd
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

        {/* Email Body */}
        <div style={{ padding: 32, color: "#1e293b", lineHeight: 1.6, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Job Forms — JOB-2026-0042</h2>
          <p style={{ margin: "0 0 16px" }}>Dear Mr. John Smith,</p>
          <p style={{ margin: "0 0 16px" }}>
            Please find attached the completed service form(s) for your recent job carried out by{" "}
            <strong>ABC Heating & Plumbing Ltd</strong>.
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
            <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>Attached Forms:</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li style={{ margin: "4px 0", fontSize: 14 }}>Gas Service Record</li>
              <li style={{ margin: "4px 0", fontSize: 14 }}>Gas Safety Record (CP12)</li>
              <li style={{ margin: "4px 0", fontSize: 14 }}>Gas Benchmark Commissioning Checklist</li>
            </ul>
          </div>

          <p style={{ margin: "0 0 16px" }}>
            These documents contain the full details of the work completed at your property. Please retain them for your records.
          </p>
          <p style={{ margin: "0 0 16px" }}>
            If you have any questions about the work carried out, please contact us on{" "}
            <strong>0161 234 5678</strong> or email{" "}
            <a href="mailto:info@abcheating.co.uk" style={{ color: "#1d4ed8" }}>
              info@abcheating.co.uk
            </a>
            .
          </p>

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "20px 0" }} />
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Kind regards,
            <br />
            <strong>ABC Heating & Plumbing Ltd</strong>
            <br />
            <em>Sent via TradeWorkDesk</em>
          </p>
        </div>

        {/* Footer */}
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
