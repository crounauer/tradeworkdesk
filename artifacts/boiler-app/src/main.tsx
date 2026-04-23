import "./lib/fetch-interceptor";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

// Fire a warmup ping immediately so Railway wakes up while the browser
// initialises React + Supabase auth. Uses keepalive so it survives navigation.
// No auth needed — /api/ping is a public no-op endpoint.
fetch("/api/ping", { method: "GET", keepalive: true }).catch(() => {});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
