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

// Register the service worker with proper error handling.
// vite-plugin-pwa injectRegister is disabled so we control the registration here.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // SW load can fail on poor connections (especially iOS Safari PWA wake-up).
        // This is non-fatal; the app works without a service worker.
      });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Intentionally no hard reload.
    // Users can refresh manually if they need to pick up new assets immediately.
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
