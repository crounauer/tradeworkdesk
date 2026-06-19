"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface Props {
  websiteId: string;
  enabled?: boolean;
}

type SessionState = {
  visitorId: string;
  sessionId: string;
  startedAt: number;
  lastSeenAt: number;
  pageIndex: number;
};

const VISITOR_KEY = "twd_visitor_id_v1";
const SESSION_KEY = "twd_session_state_v1";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateVisitorId(): string {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const created = makeId();
  localStorage.setItem(VISITOR_KEY, created);
  return created;
}

function getOrCreateSession(): SessionState {
  const now = Date.now();
  const visitorId = getOrCreateVisitorId();

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SessionState>;
      const timedOut = !parsed.lastSeenAt || now - parsed.lastSeenAt > SESSION_TIMEOUT_MS;
      if (!timedOut && parsed.sessionId && parsed.startedAt) {
        return {
          visitorId,
          sessionId: parsed.sessionId,
          startedAt: parsed.startedAt,
          lastSeenAt: parsed.lastSeenAt || now,
          pageIndex: parsed.pageIndex || 0,
        };
      }
    }
  } catch {
    // Ignore parse errors and create a new session
  }

  return {
    visitorId,
    sessionId: makeId(),
    startedAt: now,
    lastSeenAt: now,
    pageIndex: 0,
  };
}

function persistSession(state: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

function sendEvent(payload: Record<string, unknown>, preferBeacon = false): void {
  const body = JSON.stringify(payload);

  if (preferBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/website-analytics/track", blob);
    return;
  }

  fetch("/api/website-analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore analytics transport errors
  });
}

export default function WebsiteTrafficTracker({ websiteId, enabled = true }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fullPath = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!enabled || !websiteId) return;

    const state = getOrCreateSession();
    const now = Date.now();
    state.lastSeenAt = now;
    state.pageIndex += 1;
    persistSession(state);

    const elapsedSeconds = Math.max(0, Math.round((now - state.startedAt) / 1000));

    sendEvent({
      websiteId,
      event_type: "page_view",
      session_id: state.sessionId,
      visitor_id: state.visitorId,
      path: fullPath,
      referrer: document.referrer || null,
      session_elapsed_seconds: elapsedSeconds,
      session_page_index: state.pageIndex,
    });
  }, [enabled, websiteId, fullPath]);

  useEffect(() => {
    if (!enabled || !websiteId) return;

    const onPageLeave = () => {
      const state = getOrCreateSession();
      const now = Date.now();
      state.lastSeenAt = now;
      persistSession(state);

      const elapsedSeconds = Math.max(0, Math.round((now - state.startedAt) / 1000));

      sendEvent({
        websiteId,
        event_type: "session_end",
        session_id: state.sessionId,
        visitor_id: state.visitorId,
        path: fullPath,
        referrer: document.referrer || null,
        session_elapsed_seconds: elapsedSeconds,
        session_page_index: state.pageIndex,
      }, true);
    };

    window.addEventListener("pagehide", onPageLeave);
    window.addEventListener("beforeunload", onPageLeave);

    return () => {
      window.removeEventListener("pagehide", onPageLeave);
      window.removeEventListener("beforeunload", onPageLeave);
    };
  }, [enabled, websiteId, fullPath]);

  return null;
}
