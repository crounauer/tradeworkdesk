import "./lib/fetch-interceptor";

// Initialize Sentry early, before React renders
if (import.meta.env.VITE_SENTRY_DSN) {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string;
  const env = import.meta.env.VITE_SENTRY_ENV || "development";
  const traceSampleRate = parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1");
  
  // Lazy-load Sentry only if DSN is configured
  import("@sentry/react").then(Sentry => {
    Sentry.init({
      dsn,
      environment: env,
      tracesSampleRate: traceSampleRate,
      release: import.meta.env.VITE_APP_VERSION || "unknown",
      denyUrls: [
        // Ignore own scripts
      ],
      beforeSend(event, hint) {
        // Filter out certain errors if needed
        return event;
      },
    });
    
    // Expose test functions for manual testing
    (window as any).triggerTestError = () => {
      throw new Error("Test error from browser console");
    };
    (window as any).captureTestMessage = () => {
      Sentry.captureMessage("Test message from browser console", "info");
    };
  }).catch(err => {
    console.error("Failed to initialize Sentry:", err);
  });
}

import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

// When a new service worker takes control (after skipWaiting), reload the page
// so the installed PWA gets fresh assets instead of serving the old cached bundle.
if ("serviceWorker" in navigator) {
  const SW_RELOAD_GUARD_KEY = "sw_controllerchange_last_reload";
  const SW_RELOAD_COOLDOWN_MS = 60_000;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const now = Date.now();
    const previous = Number(sessionStorage.getItem(SW_RELOAD_GUARD_KEY) || "0");
    if (Number.isFinite(previous) && now - previous < SW_RELOAD_COOLDOWN_MS) {
      return;
    }
    sessionStorage.setItem(SW_RELOAD_GUARD_KEY, String(now));
    window.location.reload();
  });
}

// Fire a warmup ping immediately so Railway wakes up while the browser
// initialises React + Supabase auth. Uses keepalive so it survives navigation.
// No auth needed — /api/ping is a public no-op endpoint.
fetch("/api/ping", { method: "GET", keepalive: true }).catch(() => {});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
