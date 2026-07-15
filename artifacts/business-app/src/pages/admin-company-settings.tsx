import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useCompanySettings, useUploadCompanyLogo, useUpdateCompanySettings } from "@/hooks/use-company-settings";
import type { CompanySettings } from "@/hooks/use-company-settings";
import { useCompanyType } from "@/hooks/use-company-type";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useSearch } from "wouter";
import {
  Building2, Phone, Mail, Globe, Shield, FileText, ExternalLink,
  Upload, Trash2, Loader2, MapPin, BadgeCheck, PoundSterling,
  Users, AlertTriangle, CreditCard,
  Plus, X, Check, Clock, Star, Package, Pencil, CalendarSync, Wrench, Palette,
  Search, Save, Zap, Banknote, CheckCircle2, XCircle, Link as LinkIcon, Bell, ListTree,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AccountingIntegrations } from "@/components/accounting-integrations";
import BillingPage from "@/pages/billing";
import AdminUsers from "@/pages/admin-users";
import { getExistingPushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push-notifications";

// ─── GoCardless section (embedded in Payments tab) ───────────────────────────

interface GcStatus { available: boolean; connected: boolean; organisation_id?: string }

type PushPermissionState = "default" | "denied" | "granted";

type PushEventMeta = {
  key:
    | "appointment_due"
    | "appointment_overdue"
    | "assignment_changes"
    | "blocking_status_changes"
    | "customer_communications"
    | "payment_alerts"
    | "sla_breach_risk"
    | "maintenance_lifecycle"
    | "operational_exceptions"
    | "system_reliability";
  label: string;
  description: string;
};

type PushUserPreferenceRow = {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
  isActive: boolean;
  preferences: Record<PushEventMeta["key"], boolean>;
};

function GoCardlessSection({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<GcStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gocardless/status", { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { loadStatus(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/gocardless/authorize", { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect GoCardless? Future invoices won't include a direct debit link.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/gocardless", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast({ title: "GoCardless disconnected" });
      setStatus({ available: true, connected: false });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setDisconnecting(false); }
  };

  if (loading) return <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />;
  if (!status?.available) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        GoCardless is not enabled on this platform. Contact your system administrator.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {status.connected
          ? <Badge className="bg-green-100 text-green-700 border-0 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</Badge>
          : <Badge variant="outline" className="text-slate-500 flex items-center gap-1"><XCircle className="w-3 h-3" /> Not connected</Badge>}
        {status.connected && status.organisation_id && (
          <span className="text-xs text-muted-foreground font-mono">Org: {status.organisation_id}</span>
        )}
      </div>
      {status.connected ? (
        <>
          <p className="text-sm text-muted-foreground">
            When you send an invoice, a GoCardless payment link is automatically attached so customers can pay by direct debit or instant bank transfer.
          </p>
          <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-lg border">
            <div>
              <p className="text-sm font-medium">Accept bank payments on invoices</p>
              <p className="text-xs text-muted-foreground">When off, no GoCardless link is added and the button is hidden from customers.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => onToggle(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                enabled ? "bg-teal-600" : "bg-slate-200"
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Disconnect GoCardless
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Connect your GoCardless account to let customers pay by direct debit or instant bank transfer. No card fees — ideal for regular customers.
          </p>
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Connect GoCardless
          </Button>
        </>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">Webhook setup</summary>
        <p className="mt-1 pl-3 border-l-2 border-slate-200">
          In your GoCardless dashboard → Developers → Webhooks, add:<br />
          <code className="bg-slate-100 px-1 rounded">{window.location.origin}/api/webhooks/gocardless</code><br />
          Copy the signing secret to <code className="bg-slate-100 px-1 rounded">GOCARDLESS_WEBHOOK_SECRET</code>.
        </p>
      </details>
    </div>
  );
}

function PushNotificationsSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const hasSupport =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      if (!mounted) return;
      setSupported(hasSupport);

      if (!hasSupport) {
        setLoading(false);
        return;
      }

      setPermission(Notification.permission as PushPermissionState);
      const existing = await getExistingPushSubscription();
      if (!mounted) return;
      setSubscribed(Boolean(existing));
      setSetupRequired(!existing && !("serviceWorker" in navigator && navigator.serviceWorker.controller));
      setLoading(false);
    };

    load().catch(() => {
      if (!mounted) return;
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const enablePush = async () => {
    try {
      setWorking(true);

      const requested = await Notification.requestPermission();
      setPermission(requested as PushPermissionState);
      if (requested !== "granted") {
        toast({ title: "Permission blocked", description: "Please allow notifications in your browser settings.", variant: "destructive" });
        return;
      }

      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) throw new Error("Failed to load push configuration");
      const keyData = await keyRes.json() as { publicKey?: string };
      if (!keyData.publicKey) throw new Error("Missing push public key");

      const subscription = await subscribeToPush(keyData.publicKey);

      const saveRes = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to save push subscription");
      }

      setSubscribed(true);
      toast({ title: "Push notifications enabled", description: "This device will receive website enquiry alerts." });
    } catch (err) {
      toast({ title: "Failed to enable push", description: (err as Error).message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const disablePush = async () => {
    try {
      setWorking(true);
      const endpoint = await unsubscribeFromPush();

      if (endpoint) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setSubscribed(false);
      toast({ title: "Push notifications disabled" });
    } catch (err) {
      toast({ title: "Failed to disable push", description: (err as Error).message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const sendTest = async () => {
    try {
      setWorking(true);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/push/test", {
        method: "POST",
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to send test push");
      }

      toast({ title: "Test sent", description: "You should receive a test push notification shortly." });
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Test notification timed out. Please try again."
        : (err as Error).message;
      toast({ title: "Failed to send test", description: message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="h-20 rounded-lg border bg-slate-50 animate-pulse" />;
  }

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" /> Device Push Notifications</CardTitle>
          <CardDescription>
            This browser does not support push notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (setupRequired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" /> Device Push Notifications</CardTitle>
          <CardDescription>
            Push setup is missing on this device. Refresh the app once so the service worker can register, then enable push notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Setup steps</p>
            <p>1. Reload the app so the service worker registers.</p>
            <p>2. Return here and select Enable on this device.</p>
            <p>3. Allow notifications when the browser asks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" /> Device Push Notifications</CardTitle>
        <CardDescription>
          Send instant alerts to mobiles, tablets, and desktops when new website enquiries arrive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Status: {subscribed ? "Subscribed" : "Not subscribed"} • Browser permission: {permission}
        </p>
        <div className="flex flex-wrap gap-2">
          {!subscribed ? (
            <Button type="button" onClick={enablePush} disabled={working || permission === "denied"}>
              {working ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Enable on this device
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={disablePush} disabled={working}>
              {working ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Disable on this device
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={sendTest} disabled={working || !subscribed}>
            Send test notification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PushPreferenceMatrix() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [events, setEvents] = useState<PushEventMeta[]>([]);
  const [rows, setRows] = useState<PushUserPreferenceRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [metaRes, usersRes] = await Promise.all([
          fetch("/api/push/preferences/meta"),
          fetch("/api/push/preferences/users"),
        ]);

        if (!metaRes.ok) throw new Error("Failed to load push event metadata");
        if (!usersRes.ok) throw new Error("Failed to load user push preferences");

        const metaData = await metaRes.json() as { events: PushEventMeta[] };
        const userData = await usersRes.json() as PushUserPreferenceRow[];

        if (!mounted) return;
        setEvents(metaData.events || []);
        setRows(Array.isArray(userData) ? userData : []);
      } catch (err) {
        if (!mounted) return;
        toast({ title: "Failed to load push preferences", description: (err as Error).message, variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load().catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [toast]);

  const updatePreference = async (userId: string, key: PushEventMeta["key"], nextValue: boolean) => {
    const rowKey = `${userId}:${key}`;
    const prevRows = rows;
    setSavingKey(rowKey);
    setRows((curr) => curr.map((r) => r.userId === userId
      ? { ...r, preferences: { ...r.preferences, [key]: nextValue } }
      : r));

    try {
      const res = await fetch(`/api/push/preferences/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: nextValue }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to save preference");
      }
    } catch (err) {
      setRows(prevRows);
      toast({ title: "Failed to save preference", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Push Event Preferences By User</CardTitle>
        <CardDescription>
          Tenant admins can enable or disable each push alert scenario per user.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-24 rounded-lg border bg-slate-50 animate-pulse" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found for this tenant.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.userId} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{row.fullName || row.email || "Unknown user"}</p>
                    <p className="text-xs text-muted-foreground">{row.email || "No email"} • {row.role || "unknown"}</p>
                  </div>
                  {!row.isActive && <Badge variant="outline">Inactive</Badge>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map((event) => {
                    const eventKey = `${row.userId}:${event.key}`;
                    const checked = !!row.preferences[event.key];
                    return (
                      <div key={event.key} className="flex items-start justify-between gap-4 rounded-md border p-2.5">
                        <div>
                          <p className="text-sm font-medium leading-tight">{event.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{event.description}</p>
                        </div>
                        <Switch
                          checked={checked}
                          disabled={savingKey === eventKey || !row.isActive}
                          onCheckedChange={(value) => {
                            void updatePreference(row.userId, event.key, value);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FormValues = Omit<CompanySettings, "id" | "singleton_id" | "logo_url" | "logo_storage_path" | "created_at" | "updated_at">;
type BookingWorkingHour = { day: number; start: string; end: string };
type BookingSettingsProfile = {
  working_hours: BookingWorkingHour[];
};

type GeoResult = {
  latitude: number;
  longitude: number;
  display_name?: string;
};

const coverageMapIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>`,
  className: "",
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
});

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

function parseRadiusMiles(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function calculateZoomForRadius(latitude: number, radiusMeters: number, containerWidth: number, containerHeight: number): number {
  const minDimension = Math.max(1, Math.min(containerWidth, containerHeight));
  const drawableRadiusPx = Math.max(1, minDimension / 2 - 16);
  const metersPerPixelAtZoom0 = 156543.03392 * Math.cos((latitude * Math.PI) / 180);
  const desiredMetersPerPixel = radiusMeters / drawableRadiusPx;
  const rawZoom = Math.log2(metersPerPixelAtZoom0 / desiredMetersPerPixel);
  const safeZoom = Number.isFinite(rawZoom) ? rawZoom : 13;
  return Math.max(1, Math.min(18, Math.floor(safeZoom)));
}

function CoverageRadiusAutoFit({ latitude, longitude, radiusMiles }: { latitude: number; longitude: number; radiusMiles: number }) {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    const maxSizeRetries = 20;
    let sizeRetryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const delayedRefitTimers: ReturnType<typeof setTimeout>[] = [];

    const applyViewport = () => {
      if (cancelled) return;

      const container = map.getContainer();
      if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
        if (sizeRetryCount < maxSizeRetries) {
          sizeRetryCount += 1;
          retryTimer = setTimeout(applyViewport, 100);
        }
        return;
      }

      const center = L.latLng(latitude, longitude);
      map.invalidateSize({ animate: false });

      if (radiusMiles > 0) {
        const radiusMeters = milesToMeters(radiusMiles);
        const zoom = calculateZoomForRadius(latitude, radiusMeters, container.offsetWidth, container.offsetHeight);
        map.setView(center, zoom, { animate: false });
      } else {
        map.setView([latitude, longitude], 13, { animate: false });
      }
    };

    const onResize = () => {
      applyViewport();
    };

    const scheduleDelayedRefits = () => {
      delayedRefitTimers.push(setTimeout(applyViewport, 150));
      delayedRefitTimers.push(setTimeout(applyViewport, 450));
    };

    map.whenReady(() => {
      requestAnimationFrame(applyViewport);
      scheduleDelayedRefits();
    });
    map.on("resize", onResize);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      for (const timer of delayedRefitTimers) clearTimeout(timer);
      map.off("resize", onResize);
    };
  }, [map, latitude, longitude, radiusMiles]);

  return null;
}

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_BOOKING_WORKING_HOURS: BookingWorkingHour[] = [
  { day: 1, start: "08:00", end: "17:00" },
  { day: 2, start: "08:00", end: "17:00" },
  { day: 3, start: "08:00", end: "17:00" },
  { day: 4, start: "08:00", end: "17:00" },
  { day: 5, start: "08:00", end: "17:00" },
];

export default function AdminCompanySettings() {
  const { data: settings, isLoading } = useCompanySettings();
  const uploadLogo = useUploadCompanyLogo();
  const { toast } = useToast();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { activeUserCount, isLoading: companyTypeLoading, isError: companyTypeError } = useCompanyType();
  const isAdmin = profile?.role === "admin";
  const { hasAddon } = usePlanFeatures();

  const searchString = useSearch();
  const updateSettings = useUpdateCompanySettings();
  const stripeEnabled = settings?.stripe_payments_enabled !== false;
  const gcEnabled = settings?.gocardless_payments_enabled !== false;

  const [activeTab, setActiveTab] = useState(() => {
    const p = new URLSearchParams(searchString);
    const tab = p.get("tab") ?? "profile";
    if (tab === "job-types") return "catalogue";
    if (["plans", "addons", "billing", "invoicing", "payments"].includes(tab)) return "finance";
    return tab;
  });
  const [financeTab, setFinanceTab] = useState<"plans" | "addons" | "billing" | "invoicing" | "payments">(() => {
    const p = new URLSearchParams(searchString);
    const legacy = p.get("tab");
    const sub = p.get("financeTab");
    if (sub === "plans" || sub === "addons" || sub === "billing" || sub === "invoicing" || sub === "payments") return sub;
    if (legacy === "plans" || legacy === "addons" || legacy === "billing" || legacy === "invoicing" || legacy === "payments") return legacy;
    return "plans";
  });
  const [bookingSettingsProfile, setBookingSettingsProfile] = useState<BookingSettingsProfile | null>(null);
  const [bookingHoursLoading, setBookingHoursLoading] = useState(false);
  const [bookingHoursSaving, setBookingHoursSaving] = useState(false);
  const bookingHoursLoadedRef = useRef(false);
  const [coverageCenter, setCoverageCenter] = useState<GeoResult | null>(null);
  const [coverageLookupLoading, setCoverageLookupLoading] = useState(false);
  const [coverageLookupError, setCoverageLookupError] = useState<string | null>(null);

  // Handle GoCardless OAuth callbacks redirected back here
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("gc_success") === "1") {
      toast({ title: "GoCardless connected", description: "Direct debit payment links will be created automatically on future invoices." });
      setActiveTab("finance");
      setFinanceTab("payments");
      window.history.replaceState({}, "", "/admin/company-settings?tab=finance&financeTab=payments");
    } else if (params.get("error") && params.get("tab") === "payments") {
      toast({ title: "Connection failed", description: params.get("error") || "Unknown error", variant: "destructive" });
      setActiveTab("finance");
      setFinanceTab("payments");
      window.history.replaceState({}, "", "/admin/company-settings?tab=finance&financeTab=payments");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStripeToggle(val: boolean) {
    updateSettings.mutate(
      { stripe_payments_enabled: val },
      { onSuccess: () => toast({ title: val ? "Card payments enabled" : "Card payments disabled" }),
        onError: (e) => toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" }) },
    );
  }

  function handleGcToggle(val: boolean) {
    updateSettings.mutate(
      { gocardless_payments_enabled: val },
      { onSuccess: () => toast({ title: val ? "Bank payments enabled" : "Bank payments disabled" }),
        onError: (e) => toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" }) },
    );
  }

  const { register, reset, getValues, watch, setValue, formState: { isDirty, dirtyFields } } = useForm<FormValues>();
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const settingsLoadedRef = useRef(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!settings || settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    reset({
      name: settings.name ?? "",
      trading_name: settings.trading_name ?? "",
      address_line1: settings.address_line1 ?? "",
      address_line2: settings.address_line2 ?? "",
      city: settings.city ?? "",
      county: settings.county ?? "",
      postcode: settings.postcode ?? "",
      country: settings.country ?? "United Kingdom",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      notification_emails: settings.notification_emails ?? [],
      website: settings.website ?? "",
      service_area: settings.service_area ?? "",
      coverage_radius_miles: settings.coverage_radius_miles != null ? Number(settings.coverage_radius_miles) : null,
      gas_safe_number: settings.gas_safe_number ?? "",
      oftec_number: settings.oftec_number ?? "",
      vat_number: settings.vat_number ?? "",
      company_number: settings.company_number ?? "",
      default_vat_rate: Number(settings.default_vat_rate ?? 20),
      default_payment_terms_days: Number(settings.default_payment_terms_days ?? 30),
      currency: settings.currency ?? "GBP",
      rates_url: settings.rates_url ?? "",
      trading_terms_url: settings.trading_terms_url ?? "",
      job_number_prefix: settings.job_number_prefix ?? "",
      google_calendar_enabled: settings.google_calendar_enabled ?? false,
      google_client_id: settings.google_client_id ?? "",
      google_client_secret: settings.google_client_secret ?? "",
      // Invoicing
      invoices_enabled: settings.invoices_enabled ?? false,
      invoice_number_prefix: settings.invoice_number_prefix ?? "INV",
      quote_number_prefix: settings.quote_number_prefix ?? "QUO",
      invoice_next_number: settings.invoice_next_number ?? 1,
      quote_next_number: settings.quote_next_number ?? 1,
      quote_validity_days: settings.quote_validity_days ?? 30,
      invoice_footer_text: settings.invoice_footer_text ?? "",
      invoice_bank_details: settings.invoice_bank_details ?? "",
      payment_link_url: settings.payment_link_url ?? "",
      invoicing_provider: (settings.invoicing_provider as "native" | "external" | "both") ?? "native",
      // Branding
      white_label_enabled: settings.white_label_enabled ?? false,
      brand_name: settings.brand_name ?? "",
      primary_color: settings.primary_color ?? "#6366f1",
      accent_color: settings.accent_color ?? "",
      favicon_url: settings.favicon_url ?? "",
      email_from_name: settings.email_from_name ?? "",
      email_reply_to: settings.email_reply_to ?? "",
      // Notifications
      website_enquiry_email_notify: settings.website_enquiry_email_notify ?? true,
      website_enquiry_sms_notify: settings.website_enquiry_sms_notify ?? false,
      custom_leave_types: settings.custom_leave_types ?? [],
    });
    setLogoPreview(settings.logo_url ?? null);
  }, [settings, reset]);

  // Keep preview in sync with persisted settings after refetches.
  useEffect(() => {
    if (!uploadLogo.isPending) {
      setLogoPreview(settings?.logo_url ?? null);
    }
  }, [settings?.logo_url, uploadLogo.isPending]);

  const numericFields = new Set(["default_vat_rate", "default_payment_terms_days", "invoice_next_number", "quote_next_number", "quote_validity_days", "coverage_radius_miles"]);
  const booleanFields = new Set(["google_calendar_enabled", "invoices_enabled", "white_label_enabled", "website_enquiry_email_notify", "website_enquiry_sms_notify"]);
  const arrayFields = new Set(["notification_emails", "custom_leave_types"]);

  const saveToServer = useCallback(async (values: Record<string, unknown>) => {
    const res = await fetch("/api/admin/company-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to save settings");
    }
  }, []);

  const doSave = useCallback(async (showToast = false) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    const values = getValues();
    const clean: Record<string, string | number | boolean | string[] | null> = {};
    const dirtyKeySet = new Set(
      Object.entries(dirtyFields as Record<string, unknown>)
        .filter(([, isDirtyField]) => Boolean(isDirtyField))
        .map(([key]) => key),
    );

    if (dirtyKeySet.size === 0) {
      isSavingRef.current = false;
      if (showToast) {
        toast({ title: "No changes to save" });
      }
      return;
    }

    for (const [k, v] of Object.entries(values)) {
      if (!dirtyKeySet.has(k)) continue;

      if (booleanFields.has(k)) {
        clean[k] = Boolean(v);
      } else if (numericFields.has(k)) {
        clean[k] = v != null && v !== "" ? Number(v) : null;
      } else if (arrayFields.has(k)) {
        clean[k] = Array.isArray(v)
          ? v.map((item) => String(item).trim()).filter(Boolean)
          : [];
      } else {
        clean[k] = (v as string)?.trim() || null;
      }
    }
    try {
      setAutoSaveStatus("saving");
      await saveToServer(clean);
      if (!isMountedRef.current) return;
      setAutoSaveStatus("saved");
      reset(values);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (showToast) {
        toast({ title: "Settings saved", description: "Company information has been updated." });
      }
      setTimeout(() => { if (isMountedRef.current) setAutoSaveStatus("idle"); }, 3000);
    } catch (err) {
      if (!isMountedRef.current) return;
      setAutoSaveStatus("idle");
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      isSavingRef.current = false;
    }
  }, [dirtyFields, getValues, reset, saveToServer, toast]);

  useEffect(() => {
    const subscription = watch(() => {
      if (!settingsLoadedRef.current) return;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => { doSave(); }, 1500);
    });
    return () => subscription.unsubscribe();
  }, [watch, doSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "profile") return;
    if (bookingHoursLoadedRef.current) return;

    let cancelled = false;
    setBookingHoursLoading(true);
    fetch("/api/booking/settings")
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to load booking settings");
        }
        return res.json() as Promise<Record<string, unknown>>;
      })
      .then((data) => {
        if (cancelled) return;
        const workingHours = Array.isArray(data?.working_hours)
          ? (data.working_hours as BookingWorkingHour[])
          : DEFAULT_BOOKING_WORKING_HOURS;
        setBookingSettingsProfile({
          working_hours: [...workingHours].sort((a, b) => a.day - b.day),
        });
        bookingHoursLoadedRef.current = true;
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setBookingSettingsProfile({ working_hours: DEFAULT_BOOKING_WORKING_HOURS });
        toast({ title: "Could not load working hours", description: err.message, variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setBookingHoursLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, toast]);

  const toggleBookingDay = useCallback((day: number) => {
    setBookingSettingsProfile((current) => {
      const prev = current ?? { working_hours: DEFAULT_BOOKING_WORKING_HOURS };
      const exists = prev.working_hours.find((w) => w.day === day);
      if (exists) {
        return { ...prev, working_hours: prev.working_hours.filter((w) => w.day !== day) };
      }
      return {
        ...prev,
        working_hours: [...prev.working_hours, { day, start: "08:00", end: "17:00" }].sort((a, b) => a.day - b.day),
      };
    });
  }, []);

  const updateBookingDayHours = useCallback((day: number, field: "start" | "end", value: string) => {
    setBookingSettingsProfile((current) => {
      const prev = current ?? { working_hours: DEFAULT_BOOKING_WORKING_HOURS };
      return {
        ...prev,
        working_hours: prev.working_hours.map((w) => (w.day === day ? { ...w, [field]: value } : w)),
      };
    });
  }, []);

  const saveBookingWorkingHours = useCallback(async () => {
    if (!bookingSettingsProfile) return;
    setBookingHoursSaving(true);
    try {
      const currentRes = await fetch("/api/booking/settings");
      if (!currentRes.ok) {
        const err = await currentRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to load booking settings");
      }
      const current = await currentRes.json() as Record<string, unknown>;

      const payload = {
        ...current,
        working_hours: [...bookingSettingsProfile.working_hours].sort((a, b) => a.day - b.day),
      };

      const saveRes = await fetch("/api/booking/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to save working hours");
      }
      toast({ title: "Working hours saved" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBookingHoursSaving(false);
    }
  }, [bookingSettingsProfile, toast]);

  const watchedPostcode = String(watch("postcode") || "").trim();
  const watchedCoverageRadiusRaw = watch("coverage_radius_miles");
  const watchedCoverageRadiusMiles = parseRadiusMiles(watchedCoverageRadiusRaw);

  useEffect(() => {
    if (activeTab !== "profile") return;

    const postcode = watchedPostcode;
    if (!postcode) {
      setCoverageCenter(null);
      setCoverageLookupError(null);
      setCoverageLookupLoading(false);
      return;
    }

    const addressParts = [
      String(getValues("address_line1") || "").trim(),
      String(getValues("city") || "").trim(),
      String(getValues("county") || "").trim(),
      postcode,
    ].filter(Boolean);
    const address = addressParts.join(", ");

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCoverageLookupLoading(true);
      setCoverageLookupError(null);
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Could not locate business postcode");
        }
        const geo = await res.json() as GeoResult;
        setCoverageCenter(geo);
      } catch (err) {
        if (controller.signal.aborted) return;
        setCoverageCenter(null);
        setCoverageLookupError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setCoverageLookupLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [activeTab, watchedPostcode, getValues]);



  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB.", variant: "destructive" });
      return;
    }
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
    try {
      await uploadLogo.mutateAsync(file);
      toast({ title: "Logo uploaded", description: "Company logo has been updated." });
    } catch (err) {
      setLogoPreview(settings?.logo_url ?? null);
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const res = await fetch("/api/admin/company-settings/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove logo");
      setLogoPreview(null);
      toast({ title: "Logo removed" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const renderSectionSaveButton = (label = "Save changes") => (
    <div className="flex justify-end">
      <Button
        type="button"
        size="sm"
        disabled={autoSaveStatus === "saving"}
        onClick={() => doSave(true)}
      >
        {autoSaveStatus === "saving" ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-1.5" />
        )}
        {label}
      </Button>
    </div>
  );


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayedLogo = logoPreview || settings?.logo_url || null;

  return (
    <>
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Company Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your business details, team settings, pricing and invoicing preferences.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 shrink-0">
          {autoSaveStatus === "saving" && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="text-sm text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex w-max min-w-full sm:grid sm:grid-cols-5">
            <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
            <TabsTrigger value="team" className="flex-1">Team</TabsTrigger>
            <TabsTrigger value="finance" className="flex-1">Finance</TabsTrigger>
            <TabsTrigger value="catalogue" className="flex-1">Catalogue</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1">Notifications</TabsTrigger>
          </TabsList>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <TabsContent value="profile" className="space-y-6 pt-4">
          {/* Logo */}
          <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company Logo
          </CardTitle>
          <CardDescription>
            Upload your company logo. Recommended: PNG with transparent background, at least 300×100px.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-slate-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleLogoFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {displayedLogo ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={displayedLogo}
                  alt="Company logo"
                  className="max-h-24 max-w-xs object-contain rounded"
                />
                <p className="text-sm text-muted-foreground">Click or drag to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-8 h-8" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs">PNG, JPG, SVG up to 5MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoFile(file);
              e.target.value = "";
            }}
          />
          {displayedLogo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleRemoveLogo}
              disabled={uploadLogo.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Logo
            </Button>
          )}
          {uploadLogo.isPending && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
            </p>
          )}
        </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Branding & White Label
            </CardTitle>
            <CardDescription>
              Configure your app brand identity, colours, favicon and outbound email branding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
              <div>
                <Label>Enable white-label mode</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Show your branding instead of TradeWorkDesk defaults.</p>
              </div>
              <Switch
                checked={watch("white_label_enabled") ?? false}
                onCheckedChange={(v) => setValue("white_label_enabled", v, { shouldDirty: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand_name">Brand Name</Label>
              <Input id="brand_name" placeholder="e.g. North East Ecoheat" {...register("brand_name")} />
              <p className="text-xs text-muted-foreground">Shown in sidebar when no logo is set and white-label mode is enabled.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="primary_color">Primary Colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={String(watch("primary_color") || "#6366f1")}
                    onChange={(e) => setValue("primary_color", e.target.value, { shouldDirty: true })}
                    className="w-10 h-10 rounded border"
                  />
                  <Input id="primary_color" className="font-mono" placeholder="#6366f1" {...register("primary_color")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accent_color">Accent Colour (optional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={String(watch("accent_color") || "#10b981")}
                    onChange={(e) => setValue("accent_color", e.target.value, { shouldDirty: true })}
                    className="w-10 h-10 rounded border"
                  />
                  <Input id="accent_color" className="font-mono" placeholder="#10b981" {...register("accent_color")} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="favicon_url">Favicon URL (optional)</Label>
              <Input id="favicon_url" type="url" placeholder="https://example.com/favicon.ico" {...register("favicon_url")} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email_from_name">Email From Name</Label>
                <Input id="email_from_name" placeholder="e.g. North East Ecoheat" {...register("email_from_name")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email_reply_to">Reply-To Email</Label>
                <Input id="email_reply_to" type="email" placeholder="info@example.co.uk" {...register("email_reply_to")} />
              </div>
            </div>

            {(watch("white_label_enabled") ?? false) && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-medium mb-2">Brand preview</p>
                <div className="flex items-center gap-3 p-2 bg-card rounded border w-fit">
                  {displayedLogo ? (
                    <img src={displayedLogo} alt="Brand preview" className="h-7 w-auto max-w-[140px] object-contain" />
                  ) : (
                    <>
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ backgroundColor: String(watch("primary_color") || "#6366f1") }}
                      />
                      <span className="font-semibold">{String(watch("brand_name") || "Your Brand")}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          </TabsContent>

          <TabsContent value="team" className="space-y-6 pt-4">
            {isAdmin && !companyTypeLoading && !companyTypeError && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Team Settings
                  </CardTitle>
                  <CardDescription>
                    Team behavior is based on active users and your plan. With one active user, jobs auto-assign to you. With multiple active users, assignment can be shared.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeUserCount <= 1 ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{activeUserCount <= 1 ? "Single User Mode" : "Team Mode"}</p>
                      <p className="text-xs text-muted-foreground">
                        {activeUserCount <= 1
                          ? "Jobs auto-assign to your user by default"
                          : `${activeUserCount} active users can be assigned to jobs`}
                      </p>
                    </div>
                  </div>

                  {activeUserCount <= 1 && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Need multi-user assignment?</p>
                        <p className="text-amber-700 mt-1">Invite at least one more user to enable technician assignment across multiple users.</p>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            )}

            <AdminUsers embedded />
          </TabsContent>

          <TabsContent value="profile" className="space-y-6 pt-0">
          {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Business Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">Company / Trading Name *</Label>
              <Input id="name" placeholder="e.g. Acme Heating Ltd" {...register("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trading_name">Alternative Trading Name</Label>
              <Input id="trading_name" placeholder="e.g. Acme Boiler Services" {...register("trading_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_number">Company Registration Number</Label>
              <Input id="company_number" placeholder="e.g. 12345678" {...register("company_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vat_number">VAT Number</Label>
              <Input id="vat_number" placeholder="e.g. GB123456789" {...register("vat_number")} />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Business Address
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input id="address_line1" placeholder="e.g. 10 High Street" {...register("address_line1")} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input id="address_line2" placeholder="e.g. Unit 5, Industrial Estate" {...register("address_line2")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Town / City</Label>
              <Input id="city" placeholder="e.g. Manchester" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="county">County</Label>
              <Input id="county" placeholder="e.g. Greater Manchester" {...register("county")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" placeholder="e.g. M1 1AA" {...register("postcode")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="United Kingdom" {...register("country")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Service Coverage
            </CardTitle>
            <CardDescription>
              Define your operating area for online bookings. If a work radius is set, customer postcodes outside this radius are rejected.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="service_area">Service area description</Label>
              <Input id="service_area" placeholder="e.g. Aberdeen & surrounding areas" {...register("service_area")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coverage_radius_miles">Work radius (miles)</Label>
              <Input
                id="coverage_radius_miles"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 20"
                {...register("coverage_radius_miles")}
              />
            </div>
            <div className="text-xs text-muted-foreground self-end">
              Radius checks are measured from your business postcode in Company Settings.
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label>Radius preview map</Label>
              <div className="rounded-lg overflow-hidden border border-border w-full max-w-md aspect-square">
                {coverageLookupLoading ? (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading map preview...
                  </div>
                ) : coverageCenter ? (
                  <MapContainer
                    center={[coverageCenter.latitude, coverageCenter.longitude]}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                    dragging={true}
                    zoomControl={true}
                  >
                    <CoverageRadiusAutoFit
                      latitude={coverageCenter.latitude}
                      longitude={coverageCenter.longitude}
                      radiusMiles={watchedCoverageRadiusMiles}
                    />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[coverageCenter.latitude, coverageCenter.longitude]} icon={coverageMapIcon} />
                    {watchedCoverageRadiusMiles > 0 && (
                      <Circle
                        center={[coverageCenter.latitude, coverageCenter.longitude]}
                        radius={milesToMeters(watchedCoverageRadiusMiles)}
                        pathOptions={{ color: "#2563eb", weight: 2, fillColor: "#60a5fa", fillOpacity: 0.2 }}
                      />
                    )}
                  </MapContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center px-4 text-sm text-muted-foreground text-center">
                    {coverageLookupError || "Enter a valid business postcode to preview your service radius on the map."}
                  </div>
                )}
              </div>
              {coverageCenter && watchedCoverageRadiusMiles > 0 && (
                <p className="text-xs text-muted-foreground">
                  Showing approximately {watchedCoverageRadiusMiles} miles from your business location.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone
              </Label>
              <Input id="phone" type="tel" placeholder="e.g. 0161 123 4567" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </Label>
              <Input id="email" type="email" placeholder="e.g. info@example.com" {...register("email")} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="notification_emails" className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Additional Notification Emails
              </Label>
              <Textarea
                id="notification_emails"
                rows={3}
                placeholder={"e.g. office@example.com\naccounts@example.com"}
                value={(watch("notification_emails") ?? []).join("\n")}
                onChange={(e) => {
                  const emails = e.target.value
                    .split(/[\n,;]/)
                    .map((x) => x.trim())
                    .filter(Boolean);
                  setValue("notification_emails", emails, { shouldDirty: true });
                }}
              />
              <p className="text-xs text-muted-foreground">
                One email per line. These addresses are CC'd on customer-facing emails (invoices, confirmations, portal invites, reminders).
              </p>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="website" className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Website
              </Label>
              <Input id="website" type="url" placeholder="e.g. https://www.example.com" {...register("website")} />
            </div>
          </CardContent>
        </Card>

        {/* Registrations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" />
              Trade Registrations
            </CardTitle>
            <CardDescription>
              Registration numbers appear on relevant certificates and inspection documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="gas_safe_number" className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-yellow-600" />
                Gas Safe Registration Number
              </Label>
              <Input id="gas_safe_number" placeholder="e.g. 123456" {...register("gas_safe_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oftec_number" className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                OFTEC Registration Number
              </Label>
              <Input id="oftec_number" placeholder="e.g. C12345" {...register("oftec_number")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListTree className="w-4 h-4" />
              Leave Type Labels
            </CardTitle>
            <CardDescription>
              Define custom leave labels shown in Leave & Holidays. One label per line (for example: Training, Compassionate Leave, Jury Service).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="custom_leave_types">Custom leave types</Label>
            <Textarea
              id="custom_leave_types"
              rows={4}
              placeholder={"Training\nCompassionate Leave\nJury Service"}
              value={(watch("custom_leave_types") ?? []).join("\n")}
              onChange={(e) => {
                // Keep raw line editing behavior intact (spaces/new lines while typing).
                // Final normalization (trim/filter/dedupe) happens in autosave payload cleanup.
                setValue("custom_leave_types", e.target.value.split("\n").slice(0, 20), { shouldDirty: true });
              }}
            />
            <p className="text-xs text-muted-foreground">
              These labels are used as the leave type options in Leave & Holidays. Stored per tenant.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Customer Documents
            </CardTitle>
            <CardDescription>
              Links to your rates sheet and trading terms. When set, these are included in all customer-facing emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rates_url">Rates URL</Label>
              <Input id="rates_url" type="url" placeholder="e.g. https://www.example.com/rates" {...register("rates_url")} />
              <p className="text-xs text-muted-foreground">Link to your published rates / price list.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trading_terms_url">Trading Terms URL</Label>
              <Input id="trading_terms_url" type="url" placeholder="e.g. https://www.example.com/terms" {...register("trading_terms_url")} />
              <p className="text-xs text-muted-foreground">Link to your terms and conditions.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarSync className="w-4 h-4" />
              Online Booking Working Hours
            </CardTitle>
            <CardDescription>
              Configure the days and times customers can book online. This was moved from Online Booking settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bookingHoursLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading working hours...
              </div>
            ) : (
              <div className="space-y-3">
                {WEEK_DAYS.map((name, day) => {
                  const wh = bookingSettingsProfile?.working_hours.find((w) => w.day === day);
                  return (
                    <div key={day} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-32">
                        <Switch checked={!!wh} onCheckedChange={() => toggleBookingDay(day)} />
                        <Label className={wh ? "" : "text-muted-foreground"}>{name}</Label>
                      </div>
                      {wh ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={wh.start}
                            onChange={(e) => updateBookingDayHours(day, "start", e.target.value)}
                            className="w-28"
                          />
                          <span className="text-muted-foreground text-sm">to</span>
                          <Input
                            type="time"
                            value={wh.end}
                            onChange={(e) => updateBookingDayHours(day, "end", e.target.value)}
                            className="w-28"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => void saveBookingWorkingHours()} disabled={bookingHoursLoading || bookingHoursSaving}>
                {bookingHoursSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save Working Hours
              </Button>
            </div>
          </CardContent>
        </Card>

        {renderSectionSaveButton("Save profile changes")}

          </TabsContent>

          <TabsContent value="finance" className="space-y-6 pt-4">
            <Tabs value={financeTab} onValueChange={(v) => setFinanceTab(v as "plans" | "addons" | "billing" | "invoicing" | "payments")}>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="plans">Plans</TabsTrigger>
                  <TabsTrigger value="addons">Add Ons</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                  <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="plans" className="space-y-6 pt-4">
                <BillingPage view="plans" />
              </TabsContent>

              <TabsContent value="addons" className="space-y-6 pt-4">
                <BillingPage view="addons" />
              </TabsContent>

              <TabsContent value="billing" className="space-y-6 pt-4">
                {/* Accounting Integrations */}
                <AccountingIntegrations />

                {/* Pricing & Invoicing */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PoundSterling className="w-4 h-4" />
                      Pricing & Invoicing
                    </CardTitle>
                    <CardDescription>
                      Default rates used for invoice calculations. These can be overridden per job.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="default_vat_rate">Default VAT Rate (%)</Label>
                      <Input id="default_vat_rate" type="number" step="0.01" min="0" max="100" placeholder="e.g. 20.00" {...register("default_vat_rate")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="default_payment_terms_days">Payment Terms (days)</Label>
                      <Input id="default_payment_terms_days" type="number" step="1" min="0" placeholder="e.g. 30" {...register("default_payment_terms_days")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="currency">Currency</Label>
                      <select id="currency" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("currency")}>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="USD">USD - US Dollar</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="job_number_prefix">Job Number Prefix</Label>
                      <Input
                        id="job_number_prefix"
                        placeholder="e.g. NNE"
                        maxLength={10}
                        className="uppercase"
                        {...register("job_number_prefix")}
                      />
                      <p className="text-xs text-muted-foreground">
                        Set a prefix for your job numbers. For example, entering <span className="font-mono font-medium">NNE</span> will number jobs as <span className="font-mono font-medium">NNE0001</span>, <span className="font-mono font-medium">NNE0002</span>, etc. Leave blank to use the default <span className="font-mono">JOB-0001</span> format.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <CalloutRatesSection />

                {renderSectionSaveButton("Save billing changes")}
              </TabsContent>

              <TabsContent value="invoicing" className="space-y-6 pt-4">

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarSync className="w-4 h-4" />
              Google Calendar Sync
            </CardTitle>
            <CardDescription>
              Sync scheduled jobs to Google Calendar automatically. Enter your Google OAuth credentials to enable this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 space-y-2">
              <p className="font-medium">How to get your Google Calendar credentials:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
                <li>Create a project (or select an existing one)</li>
                <li>Enable the <strong>Google Calendar API</strong> under "APIs &amp; Services"</li>
                <li>Go to <strong>Credentials</strong> &rarr; <strong>Create Credentials</strong> &rarr; <strong>OAuth 2.0 Client ID</strong></li>
                <li>Set the application type to <strong>Web application</strong></li>
                <li>Add <code className="bg-blue-100 px-1 rounded">https://www.tradeworkdesk.co.uk/api/google/callback</code> as an authorised redirect URI</li>
                <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields below</li>
              </ol>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="google_calendar_enabled"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register("google_calendar_enabled")}
              />
              <Label htmlFor="google_calendar_enabled" className="cursor-pointer">
                Enable Google Calendar sync
              </Label>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="google_client_id">Google Client ID</Label>
                <Input id="google_client_id" placeholder="e.g. 123456789.apps.googleusercontent.com" {...register("google_client_id")} />
                <p className="text-xs text-muted-foreground">From your Google Cloud Console OAuth 2.0 credentials.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="google_client_secret">Google Client Secret</Label>
                <Input id="google_client_secret" type="password" placeholder="Enter client secret" {...register("google_client_secret")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public Directory Listing */}
        <PublicDirectoryCard />

        {/* Invoicing & Quotes */}
        <Card>
          <CardHeader>
            <CardTitle>Invoicing &amp; Quotes</CardTitle>
            <CardDescription>
              Enable invoicing to create and send professional invoices and quotes to your customers.
              Requires a Professional plan or higher.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="invoices_enabled" className="font-medium">Enable Invoicing</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Turn on the Invoices &amp; Quotes module for this company.
                </p>
              </div>
              <input
                type="checkbox"
                id="invoices_enabled"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register("invoices_enabled")}
              />
            </div>

            {/* Invoicing provider */}
            <div className="space-y-2">
              <Label className="font-medium">Invoicing System</Label>
              <p className="text-xs text-muted-foreground">
                Choose how you manage invoices. Select "Both" if you're moving platforms and want to run systems in parallel.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {([
                  { value: "native", label: "TradeWorkDesk", description: "Create invoices & quotes directly in TWD" },
                  { value: "external", label: "Accounting Software", description: "Push jobs to Zoho, Xero, QuickBooks etc." },
                  { value: "both", label: "Both", description: "Use TWD invoicing and accounting software together" },
                ] as const).map(opt => {
                  const selected = (watch("invoicing_provider") || "native") === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex flex-col gap-1 cursor-pointer rounded-lg border p-3 transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <input type="radio" value={opt.value} {...register("invoicing_provider")} className="sr-only" />
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="invoice_number_prefix">Invoice Number Prefix</Label>
                <Input id="invoice_number_prefix" placeholder="INV" {...register("invoice_number_prefix")} />
                <p className="text-xs text-muted-foreground">e.g. INV → INV-0001</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote_number_prefix">Quote Number Prefix</Label>
                <Input id="quote_number_prefix" placeholder="QUO" {...register("quote_number_prefix")} />
                <p className="text-xs text-muted-foreground">e.g. QUO → QUO-0001</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote_validity_days">Quote Validity (days)</Label>
                <Input id="quote_validity_days" type="number" min="1" placeholder="30" {...register("quote_validity_days")} />
                <p className="text-xs text-muted-foreground">Default expiry period for new quotes.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice_next_number">Next Invoice Number</Label>
                <Input id="invoice_next_number" type="number" min="1" placeholder="1" {...register("invoice_next_number")} />
                <p className="text-xs text-muted-foreground">Override if migrating from another system.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice_bank_details">Bank Account Details</Label>
              <Textarea
                id="invoice_bank_details"
                placeholder={"Bank: Example Bank\nSort Code: 00-00-00\nAccount: 12345678"}
                rows={3}
                className="resize-none font-mono text-sm"
                {...register("invoice_bank_details")}
              />
              <p className="text-xs text-muted-foreground">Printed on invoices to help customers pay you.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_link_url">Customer Payment Link (optional)</Label>
              <Input
                id="payment_link_url"
                type="url"
                placeholder="e.g. https://buy.stripe.com/your-link or PayPal link"
                {...register("payment_link_url")}
              />
              <p className="text-xs text-muted-foreground">
                Fallback "Pay Now" button shown on portal invoices. Use a Stripe Payment Link, PayPal.me, or any payment URL.
                For automatic per-invoice payment links, connect Stripe below.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice_footer_text">Invoice Footer Text</Label>
              <Textarea
                id="invoice_footer_text"
                placeholder="e.g. Thank you for your business. Payment is due within 30 days."
                rows={2}
                className="resize-none text-sm"
                {...register("invoice_footer_text")}
              />
            </div>
          </CardContent>
        </Card>

                {renderSectionSaveButton("Save invoicing changes")}

              </TabsContent>

              <TabsContent value="payments" className="space-y-6 pt-4">

        {/* Stripe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-violet-600" /> Stripe
            </CardTitle>
            <CardDescription>
              Industry-leading card payments. Customers pay by card via a hosted Stripe Checkout page. Configured separately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/admin/stripe-connect">
              <Button type="button" variant="outline" size="sm" className="flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5" /> Manage Stripe Connection
              </Button>
            </a>
            <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Accept card payments on invoices</p>
                <p className="text-xs text-muted-foreground">When off, no Stripe link is added and the Pay by Card button is hidden from customers.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={stripeEnabled}
                disabled={updateSettings.isPending}
                onClick={() => handleStripeToggle(!stripeEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  stripeEnabled ? "bg-violet-600" : "bg-slate-200"
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${stripeEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </CardContent>
        </Card>

                {/* GoCardless */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Banknote className="w-4 h-4 text-teal-600" /> GoCardless
                    </CardTitle>
                    <CardDescription>
                      Direct debit &amp; instant bank pay. Popular with UK tradespeople — ideal for regular customers and larger invoices.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GoCardlessSection enabled={gcEnabled} onToggle={handleGcToggle} />
                  </CardContent>
                </Card>

              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="catalogue" className="space-y-6 pt-4">

        <ProductCatalogueSection />
        <ServiceCatalogueSection />

          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Website Enquiry Notifications
                </CardTitle>
                <CardDescription>
                  Choose how you want to be alerted when a new enquiry arrives from your website contact form.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email notification</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Send an email to your company address when a new enquiry is submitted</p>
                  </div>
                  <Switch
                    checked={watch("website_enquiry_email_notify") ?? true}
                    onCheckedChange={(v) => setValue("website_enquiry_email_notify", v, { shouldDirty: true })}
                  />
                </div>
                {hasAddon("sms_messaging") && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>SMS notification</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Send a text message to your company phone number for each new enquiry</p>
                    </div>
                    <Switch
                      checked={watch("website_enquiry_sms_notify") ?? false}
                      onCheckedChange={(v) => setValue("website_enquiry_sms_notify", v, { shouldDirty: true })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <PushNotificationsSection />

            {isAdmin && <PushPreferenceMatrix />}

            {renderSectionSaveButton("Save notification changes")}
          </TabsContent>


        </form>
      </Tabs>

    </div>

      {autoSaveStatus !== "idle" && (
        <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
          <div className="rounded-full border border-border/70 bg-background/90 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground shadow-sm flex items-center gap-1.5">
            {autoSaveStatus === "saving" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving changes
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                Saved{lastSavedAt ? ` at ${lastSavedAt}` : ""}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

type CalloutRate = {
  id: string;
  name: string;
  amount: number;
  hourly_rate: number | null;
  day_type: string;
  time_from: string | null;
  time_to: string | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

const DAY_TYPE_LABELS: Record<string, string> = {
  weekday: "Weekday",
  weekend: "Weekend",
  after_hours: "After Hours",
  any: "Any Day",
};

function CalloutRatesSection() {
  const { toast } = useToast();
  const [rates, setRates] = useState<CalloutRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", hourly_rate: "", day_type: "weekday", time_from: "", time_to: "", is_default: false });
  const [submitting, setSubmitting] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`);
      setRates(Array.isArray(data) ? data as CalloutRate[] : []);
    } catch { setRates([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const resetForm = () => {
    setForm({ name: "", amount: "", hourly_rate: "", day_type: "weekday", time_from: "", time_to: "", is_default: false });
    setShowAdd(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        amount: Number(form.amount),
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        day_type: form.day_type,
        time_from: form.time_from || null,
        time_to: form.time_to || null,
        is_default: form.is_default,
      };
      if (editingId) {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Updated", description: "Callout rate updated" });
      } else {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Added", description: "Callout rate added" });
      }
      resetForm();
      fetchRates();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleEdit = (r: CalloutRate) => {
    setForm({
      name: r.name,
      amount: String(r.amount),
      hourly_rate: r.hourly_rate != null ? String(r.hourly_rate) : "",
      day_type: r.day_type,
      time_from: r.time_from || "",
      time_to: r.time_to || "",
      is_default: r.is_default,
    });
    setEditingId(r.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Callout rate removed" });
      fetchRates();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Callout Rate Tiers
            </CardTitle>
            <CardDescription>
              Different callout fees for weekdays, weekends, and after-hours. The system auto-selects based on the first time entry.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => { if (showAdd) resetForm(); else setShowAdd(true); }}>
            {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Rate</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekday Standard" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Callout Amount *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="65.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hourly Rate (after 1st hour)</Label>
                <Input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 45.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Day Type</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.day_type} onChange={e => setForm(f => ({ ...f, day_type: e.target.value }))}>
                  <option value="weekday">Weekday</option>
                  <option value="weekend">Weekend</option>
                  <option value="after_hours">After Hours</option>
                  <option value="any">Any Day</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From Time (optional)</Label>
                <Input type="time" value={form.time_from} onChange={e => setForm(f => ({ ...f, time_from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Time (optional)</Label>
                <Input type="time" value={form.time_to} onChange={e => setForm(f => ({ ...f, time_to: e.target.value }))} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded" />
                  <Star className="w-3.5 h-3.5 text-amber-500" /> Default rate
                </label>
              </div>
            </div>
            <Button type="button" size="sm" onClick={handleSave} disabled={submitting || !form.name.trim() || !form.amount}>
              <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No callout rates configured. The default call-out fee from Pricing above will be used.</p>
        ) : (
          <div className="space-y-2">
            {rates.map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  {r.is_default && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                  <div>
                    <span className="font-medium text-sm">{r.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {DAY_TYPE_LABELS[r.day_type] || r.day_type}
                      {r.time_from && r.time_to && ` (${r.time_from.substring(0,5)}-${r.time_to.substring(0,5)})`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-semibold text-sm">&pound;{Number(r.amount).toFixed(2)}</span>
                    {r.hourly_rate != null && (
                      <span className="text-xs text-muted-foreground ml-1.5">(£{Number(r.hourly_rate).toFixed(2)}/hr)</span>
                    )}
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ProductItem = {
  id: string;
  name: string;
  default_price: number | null;
  is_active: boolean;
};

function ProductCatalogueSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", default_price: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/products`);
      setProducts(Array.isArray(data) ? data as ProductItem[] : []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetForm = () => { setForm({ name: "", default_price: "" }); setShowAdd(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const body = { name: form.name.trim(), default_price: form.default_price ? Number(form.default_price) : null };
      if (editingId) {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/products/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Updated", description: "Product updated" });
      } else {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/products`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Added", description: "Product added to catalogue" });
      }
      resetForm();
      fetchProducts();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleEdit = (p: ProductItem) => {
    setForm({ name: p.name, default_price: p.default_price != null ? String(p.default_price) : "" });
    setEditingId(p.id);
    setShowAdd(false);
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/products/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active }),
      });
      toast({ title: is_active ? "Reactivated" : "Deactivated", description: `Product ${is_active ? "reactivated" : "deactivated"}` });
      fetchProducts();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/products/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Product removed" });
      fetchProducts();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Product Catalogue
            </CardTitle>
            <CardDescription>
              Pre-defined parts and materials. Technicians can select these when adding parts to a job.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => { if (showAdd) resetForm(); else { setEditingId(null); setForm({ name: "", default_price: "" }); setShowAdd(true); } }}>
            {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Product</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Product Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Grundfos UPS2 Pump" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default Price (optional)</Label>
                <Input type="number" step="0.01" min="0" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <Button type="button" size="sm" onClick={handleSave} disabled={submitting || !form.name.trim()}>
              <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : "Add"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products in catalogue. Add common parts and materials for quick selection on jobs.</p>
        ) : (
          <div className="space-y-2">
            {products.map(p => (
              editingId === p.id ? (
                <div key={p.id} className="border rounded-lg p-3 bg-slate-50/50 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Product Name *</Label>
                      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Default Price (optional)</Label>
                      <Input type="number" step="0.01" min="0" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={handleSave} disabled={submitting || !form.name.trim()}>
                      <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : "Update"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div key={p.id} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${!p.is_active ? "opacity-50" : ""}`}>
                  <div>
                    <span className="font-medium text-sm">{p.name}</span>
                    {!p.is_active && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {p.default_price != null && <span className="text-sm text-muted-foreground">&pound;{Number(p.default_price).toFixed(2)}</span>}
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={p.is_active ? "text-amber-600 hover:text-amber-800" : "text-green-600 hover:text-green-800"}
                      onClick={() => handleToggleActive(p.id, !p.is_active)}
                      title={p.is_active ? "Deactivate" : "Reactivate"}
                    >
                      {p.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ServiceItem = {
  id: string;
  name: string;
  default_price: number | null;
  booking_duration_minutes: number;
  online_booking_enabled: boolean;
  show_in_job_type_dropdown: boolean;
  show_in_website_service_rates: boolean;
  website_service_description: string | null;
  website_service_badge: string | null;
  website_service_price_text: string | null;
  website_service_cta_text: string | null;
  website_service_cta_url: string | null;
  website_service_display_order: number;
  is_active: boolean;
};

type ServiceFormState = {
  name: string;
  default_price: string;
  booking_duration_minutes: string;
  online_booking_enabled: boolean;
  show_in_job_type_dropdown: boolean;
  show_in_website_service_rates: boolean;
  website_service_description: string;
  website_service_badge: string;
  website_service_price_text: string;
  website_service_cta_text: string;
  website_service_cta_url: string;
  website_service_display_order: string;
};

function createEmptyServiceForm(): ServiceFormState {
  return {
    name: "",
    default_price: "",
    booking_duration_minutes: "60",
    online_booking_enabled: false,
    show_in_job_type_dropdown: false,
    show_in_website_service_rates: false,
    website_service_description: "",
    website_service_badge: "",
    website_service_price_text: "",
    website_service_cta_text: "",
    website_service_cta_url: "",
    website_service_display_order: "0",
  };
}

function ServiceCatalogueSection() {
  const { toast } = useToast();
  const { hasAddon } = usePlanFeatures();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormState>(createEmptyServiceForm());
  const [submitting, setSubmitting] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue`);
      setServices(Array.isArray(data) ? data as ServiceItem[] : []);
    } catch { setServices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const resetForm = () => { setForm(createEmptyServiceForm()); setShowAdd(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        default_price: form.default_price ? Number(form.default_price) : null,
        booking_duration_minutes: form.booking_duration_minutes ? Number(form.booking_duration_minutes) : 60,
        online_booking_enabled: form.online_booking_enabled,
        show_in_job_type_dropdown: form.show_in_job_type_dropdown,
        show_in_website_service_rates: form.show_in_website_service_rates,
        website_service_description: form.website_service_description.trim() || null,
        website_service_badge: form.website_service_badge.trim() || null,
        website_service_price_text: form.website_service_price_text.trim() || null,
        website_service_cta_text: form.website_service_cta_text.trim() || null,
        website_service_cta_url: form.website_service_cta_url.trim() || null,
        website_service_display_order: form.website_service_display_order ? Number(form.website_service_display_order) : 0,
      };
      if (editingId) {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Updated", description: "Service updated" });
      } else {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Added", description: "Service added to catalogue" });
      }
      resetForm();
      fetchServices();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleEdit = (s: ServiceItem) => {
    setForm({
      name: s.name,
      default_price: s.default_price != null ? String(s.default_price) : "",
      booking_duration_minutes: String(s.booking_duration_minutes || 60),
      online_booking_enabled: s.online_booking_enabled,
      show_in_job_type_dropdown: s.show_in_job_type_dropdown,
      show_in_website_service_rates: s.show_in_website_service_rates,
      website_service_description: s.website_service_description || "",
      website_service_badge: s.website_service_badge || "",
      website_service_price_text: s.website_service_price_text || "",
      website_service_cta_text: s.website_service_cta_text || "",
      website_service_cta_url: s.website_service_cta_url || "",
      website_service_display_order: String(s.website_service_display_order || 0),
    });
    setEditingId(s.id);
    setShowAdd(false);
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active }),
      });
      toast({ title: is_active ? "Reactivated" : "Deactivated", description: `Service ${is_active ? "reactivated" : "deactivated"}` });
      fetchServices();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Service removed" });
      fetchServices();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Service Catalogue
            </CardTitle>
            <CardDescription>
              Pre-defined services such as boiler services and gas safety checks with fixed prices. Set booking duration so online bookings reserve the correct appointment length.
              <br />
              For website pricing: enable <strong>Show in website service rates</strong> on any service to publish it automatically in the Website Builder Service Rates block. Add optional website-specific description, badge, CTA and order fields to control how it appears.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => { if (showAdd) resetForm(); else { setEditingId(null); setForm(createEmptyServiceForm()); setShowAdd(true); } }}>
            {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Service</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <>
            {showAdd && (
              <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Service Name *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Annual Boiler Service" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Default Price (optional)</Label>
                    <Input type="number" step="0.01" min="0" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Booking Duration (minutes)</Label>
                    <Input type="number" min={15} step={15} value={form.booking_duration_minutes} onChange={e => setForm(f => ({ ...f, booking_duration_minutes: e.target.value }))} placeholder="60" />
                    <p className="text-[11px] text-muted-foreground">Used by online booking to calculate slot length.</p>
                  </div>
                  <div className="space-y-1 flex items-center justify-between rounded-md border bg-background px-3 py-2">
                    <div>
                      <Label className="text-xs">Use in online booking</Label>
                      <p className="text-[11px] text-muted-foreground">Show this service on the public booking form</p>
                    </div>
                    <Switch checked={form.online_booking_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, online_booking_enabled: v }))} />
                  </div>
                  <div className="space-y-1 flex items-center justify-between rounded-md border bg-background px-3 py-2">
                    <div>
                      <Label className="text-xs">Use in job type dropdown</Label>
                      <p className="text-[11px] text-muted-foreground">Show this service as a selectable job type when creating jobs</p>
                    </div>
                    <Switch checked={form.show_in_job_type_dropdown} onCheckedChange={(v) => setForm((f) => ({ ...f, show_in_job_type_dropdown: v }))} />
                  </div>
                  <div className="space-y-1 flex items-center justify-between rounded-md border bg-background px-3 py-2">
                    <div>
                      <Label className="text-xs">Show in website service rates</Label>
                      <p className="text-[11px] text-muted-foreground">Include this service in the website Service Rates block</p>
                    </div>
                    <Switch checked={form.show_in_website_service_rates} onCheckedChange={(v) => setForm((f) => ({ ...f, show_in_website_service_rates: v }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Website Service Description (optional)</Label>
                    <Textarea value={form.website_service_description} onChange={e => setForm(f => ({ ...f, website_service_description: e.target.value }))} placeholder="Short marketing description for service rates." rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Website Badge (optional)</Label>
                    <Input value={form.website_service_badge} onChange={e => setForm(f => ({ ...f, website_service_badge: e.target.value }))} placeholder="Popular" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Website Price Text Override (optional)</Label>
                    <Input value={form.website_service_price_text} onChange={e => setForm(f => ({ ...f, website_service_price_text: e.target.value }))} placeholder="From £95" />
                    <p className="text-[11px] text-muted-foreground">If blank, website uses Default Price.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Website CTA Text (optional)</Label>
                    <Input value={form.website_service_cta_text} onChange={e => setForm(f => ({ ...f, website_service_cta_text: e.target.value }))} placeholder="Get quote" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Website CTA URL (optional)</Label>
                    <Input value={form.website_service_cta_url} onChange={e => setForm(f => ({ ...f, website_service_cta_url: e.target.value }))} placeholder="/contact" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Website Display Order</Label>
                    <Input type="number" min={0} step={1} value={form.website_service_display_order} onChange={e => setForm(f => ({ ...f, website_service_display_order: e.target.value }))} placeholder="0" />
                  </div>
                </div>
                <Button type="button" size="sm" onClick={handleSave} disabled={submitting || !form.name.trim()}>
                  <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : editingId ? "Update" : "Add"}
                </Button>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services in catalogue. Add recurring services for quick selection on jobs.</p>
            ) : (
              <div className="space-y-2">
                {services.map(s => (
                  editingId === s.id ? (
                    <div key={s.id} className="border rounded-lg p-3 bg-slate-50/50 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Service Name *</Label>
                          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Default Price (optional)</Label>
                          <Input type="number" step="0.01" min="0" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Booking Duration (minutes)</Label>
                          <Input type="number" min={15} step={15} value={form.booking_duration_minutes} onChange={e => setForm(f => ({ ...f, booking_duration_minutes: e.target.value }))} placeholder="60" />
                          <p className="text-[11px] text-muted-foreground">Used by online booking to calculate slot length.</p>
                        </div>
                        <div className="space-y-1 flex items-center justify-between rounded-md border bg-background px-3 py-2">
                          <div>
                            <Label className="text-xs">Use in online booking</Label>
                            <p className="text-[11px] text-muted-foreground">Show this service on the public booking form</p>
                          </div>
                          <Switch checked={form.online_booking_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, online_booking_enabled: v }))} />
                        </div>
                        <div className="space-y-1 flex items-center justify-between rounded-md border bg-background px-3 py-2">
                          <div>
                            <Label className="text-xs">Use in job type dropdown</Label>
                            <p className="text-[11px] text-muted-foreground">Show this service as a selectable job type when creating jobs</p>
                          </div>
                          <Switch checked={form.show_in_job_type_dropdown} onCheckedChange={(v) => setForm((f) => ({ ...f, show_in_job_type_dropdown: v }))} />
                        </div>
                        <div className="space-y-1 flex items-center justify-between rounded-md border bg-background px-3 py-2">
                          <div>
                            <Label className="text-xs">Show in website service rates</Label>
                            <p className="text-[11px] text-muted-foreground">Include this service in the website Service Rates block</p>
                          </div>
                          <Switch checked={form.show_in_website_service_rates} onCheckedChange={(v) => setForm((f) => ({ ...f, show_in_website_service_rates: v }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Website Service Description (optional)</Label>
                          <Textarea value={form.website_service_description} onChange={e => setForm(f => ({ ...f, website_service_description: e.target.value }))} rows={2} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Website Badge (optional)</Label>
                          <Input value={form.website_service_badge} onChange={e => setForm(f => ({ ...f, website_service_badge: e.target.value }))} placeholder="Popular" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Website Price Text Override (optional)</Label>
                          <Input value={form.website_service_price_text} onChange={e => setForm(f => ({ ...f, website_service_price_text: e.target.value }))} placeholder="From £95" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Website CTA Text (optional)</Label>
                          <Input value={form.website_service_cta_text} onChange={e => setForm(f => ({ ...f, website_service_cta_text: e.target.value }))} placeholder="Get quote" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Website CTA URL (optional)</Label>
                          <Input value={form.website_service_cta_url} onChange={e => setForm(f => ({ ...f, website_service_cta_url: e.target.value }))} placeholder="/contact" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Website Display Order</Label>
                          <Input type="number" min={0} step={1} value={form.website_service_display_order} onChange={e => setForm(f => ({ ...f, website_service_display_order: e.target.value }))} placeholder="0" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={handleSave} disabled={submitting || !form.name.trim()}>
                          <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : "Update"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div key={s.id} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${!s.is_active ? "opacity-50" : ""}`}>
                      <div>
                        <span className="font-medium text-sm">{s.name}</span>
                        {!s.is_active && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                        {s.online_booking_enabled && <span className="ml-2 text-xs rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Online booking</span>}
                        {s.show_in_job_type_dropdown && <span className="ml-2 text-xs rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Job type</span>}
                        {s.show_in_website_service_rates && <span className="ml-2 text-xs rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Website rates</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{s.booking_duration_minutes}min</span>
                        {s.default_price != null && <span className="text-sm text-muted-foreground">&pound;{Number(s.default_price).toFixed(2)}</span>}
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={s.is_active ? "text-amber-600 hover:text-amber-800" : "text-green-600 hover:text-green-800"}
                          onClick={() => handleToggleActive(s.id, !s.is_active)}
                          title={s.is_active ? "Deactivate" : "Reactivate"}
                        >
                          {s.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Public Directory Listing Card (standalone, separate API call)
// ---------------------------------------------------------------------------
function PublicDirectoryCard() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [isListed, setIsListed] = useState(false);
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [tradeTypes, setTradeTypes] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [coverageRadius, setCoverageRadius] = useState("");
  const [coverageRadiusSupported, setCoverageRadiusSupported] = useState(true);
  const [businessPostcode, setBusinessPostcode] = useState("");
  const [coverageCenter, setCoverageCenter] = useState<GeoResult | null>(null);
  const [coverageLookupLoading, setCoverageLookupLoading] = useState(false);
  const [coverageLookupError, setCoverageLookupError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      customFetch("/api/admin/directory-listing"),
      customFetch("/api/admin/company-settings").catch(() => ({} as Record<string, unknown>)),
    ])
      .then(([data, companyData]: [Record<string, unknown>, Record<string, unknown>]) => {
        setIsListed(!!data.is_publicly_listed);
        setSlug((data.listing_slug as string) ?? "");
        setDescription((data.public_description as string) ?? "");
        setTradeTypes((data.trade_types as string) ?? "");
        setServiceArea((data.service_area as string) ?? "");
        setCoverageRadius(data.coverage_radius_miles != null ? String(data.coverage_radius_miles) : "");
        setCoverageRadiusSupported(data.coverage_radius_supported !== false);
        setBusinessPostcode(String(companyData.postcode || "").trim());
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const postcode = businessPostcode.trim();
    if (!postcode) {
      setCoverageCenter(null);
      setCoverageLookupError("Add your business postcode in Company Settings to preview radius coverage.");
      return;
    }

    const controller = new AbortController();
    setCoverageLookupLoading(true);
    setCoverageLookupError(null);
    fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: postcode }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Could not geocode business postcode");
        }
        return res.json() as Promise<GeoResult>;
      })
      .then((geo) => setCoverageCenter(geo))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCoverageCenter(null);
        setCoverageLookupError((err as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCoverageLookupLoading(false);
      });

    return () => controller.abort();
  }, [businessPostcode]);

  const handleSlugChange = (val: string) => {
    setSlug(val);
    setSlugStatus("idle");
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (!val.trim()) return;
    slugTimerRef.current = setTimeout(() => {
      setSlugStatus("checking");
      customFetch(`/api/admin/directory-check-slug/${encodeURIComponent(val.trim())}`)
        .then((d: Record<string, unknown>) => setSlugStatus(d.available ? "available" : "taken"))
        .catch(() => setSlugStatus("idle"));
    }, 500);
  };

  const handleSave = async () => {
    if (!slug.trim()) { toast({ title: "URL required", description: "Enter a URL slug before saving.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await customFetch("/api/admin/directory-listing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_publicly_listed: isListed, listing_slug: slug, public_description: description, trade_types: tradeTypes, service_area: serviceArea, coverage_radius_miles: coverageRadius }),
      });
      toast({ title: "Directory listing saved", description: isListed ? "Your business is now publicly listed." : "Listing saved (not publicly visible)." });
      setSlugStatus("idle");
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  const normalisedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const previewUrl = normalisedSlug ? `tradeworkdesk.co.uk/find/${normalisedSlug}` : "tradeworkdesk.co.uk/find/your-slug";
  const radiusMiles = parseRadiusMiles(coverageRadius);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="w-4 h-4" />
          Public Directory Listing
        </CardTitle>
        <CardDescription>
          Opt in to appear on the <a href="/find" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">/find directory</a> so potential customers can discover your business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Show my business in the public directory</p>
            <p className="text-xs text-muted-foreground mt-0.5">Free — anyone can find and contact you</p>
          </div>
          <Switch checked={isListed} onCheckedChange={setIsListed} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="listing_slug">Your public URL</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">tradeworkdesk.co.uk/find/</span>
            <div className="relative flex-1">
              <Input
                id="listing_slug"
                placeholder="e.g. john-smith-plumbing"
                value={slug}
                onChange={e => handleSlugChange(e.target.value)}
                className={slugStatus === "taken" ? "border-red-400" : slugStatus === "available" ? "border-green-400" : ""}
              />
            </div>
          </div>
          {slugStatus === "checking" && <p className="text-xs text-muted-foreground">Checking availability…</p>}
          {slugStatus === "taken" && <p className="text-xs text-red-500">This URL is already taken. Try another.</p>}
          {slugStatus === "available" && <p className="text-xs text-green-600">Available!</p>}
          {normalisedSlug && <p className="text-xs text-muted-foreground">Preview: {previewUrl}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="public_description">About your business</Label>
          <Textarea
            id="public_description"
            placeholder="Briefly describe what you do, your experience, and what makes you different…"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Shown on your profile page. Keep it under 250 characters for best results.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trade_types">Services offered</Label>
          <Input
            id="trade_types"
            placeholder="e.g. Boiler Service, Gas Engineer, Heat Pump Installation"
            value={tradeTypes}
            onChange={e => setTradeTypes(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Comma-separated list of your services. Used for search and filtering.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="service_area">Service area</Label>
          <Input
            id="service_area"
            placeholder="e.g. Edinburgh & Lothians, or Within 20 miles of EH1"
            value={serviceArea}
            onChange={e => setServiceArea(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Shown on your profile so customers know if you cover their area.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="coverage_radius">Postcode coverage radius</Label>
          <Input
            id="coverage_radius"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 20"
            value={coverageRadius}
            onChange={e => setCoverageRadius(e.target.value)}
            disabled={!coverageRadiusSupported}
          />
          {coverageRadiusSupported ? (
            <p className="text-xs text-muted-foreground">Used by the website postcode checker. Leave blank to keep the checker text-only.</p>
          ) : (
            <p className="text-xs text-amber-700">Postcode radius is not available on this database yet. Run patch-052-website-coverage.sql to enable it.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Radius map preview</Label>
          <div className="rounded-lg overflow-hidden border border-border w-full max-w-md aspect-square">
            {coverageLookupLoading ? (
              <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading map preview...
              </div>
            ) : coverageCenter ? (
              <MapContainer
                center={[coverageCenter.latitude, coverageCenter.longitude]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
                dragging={true}
                zoomControl={true}
              >
                <CoverageRadiusAutoFit
                  latitude={coverageCenter.latitude}
                  longitude={coverageCenter.longitude}
                  radiusMiles={radiusMiles}
                />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[coverageCenter.latitude, coverageCenter.longitude]} icon={coverageMapIcon} />
                {radiusMiles > 0 && (
                  <Circle
                    center={[coverageCenter.latitude, coverageCenter.longitude]}
                    radius={milesToMeters(radiusMiles)}
                    pathOptions={{ color: "#2563eb", weight: 2, fillColor: "#60a5fa", fillOpacity: 0.2 }}
                  />
                )}
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center px-4 text-sm text-muted-foreground text-center">
                {coverageLookupError || "Set your business postcode to preview coverage radius."}
              </div>
            )}
          </div>
          {coverageCenter && radiusMiles > 0 && (
            <p className="text-xs text-muted-foreground">Showing approximately {radiusMiles} miles from your business postcode.</p>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Save className="w-4 h-4 mr-2" /> Save Listing</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
