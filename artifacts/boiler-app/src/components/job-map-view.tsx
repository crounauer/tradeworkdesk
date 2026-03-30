import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useListJobs, useListProfiles } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, Navigation, ExternalLink, Route } from "lucide-react";

type MapJob = {
  id: string;
  customer_name?: string | null;
  property_address?: string | null;
  technician_name?: string | null;
  assigned_technician_id?: string | null;
  job_type: string;
  job_type_name?: string | null;
  status: string;
  priority: string;
  scheduled_date: string | Date;
  scheduled_time?: string | null;
  property_latitude?: number | null;
  property_longitude?: number | null;
  property_postcode?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#10b981",
  cancelled: "#6b7280",
  requires_follow_up: "#ef4444",
  invoiced: "#8b5cf6",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function createColoredIcon(color: string, label?: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
    ${label ? `<text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="${color}">${label}</text>` : ""}
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

function openNavigation(lat: number, lng: number) {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIos) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}`, "_blank");
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
  }
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

export default function JobMapView() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("");
  const [showRouteView, setShowRouteView] = useState(false);

  const dateStr = toDateStr(selectedDate);

  const { data: rawJobs = [] } = useListJobs({
    date_from: dateStr,
    date_to: dateStr,
  } as Record<string, string>);

  const { data: profiles = [] } = useListProfiles();
  const technicians = useMemo(() => profiles.filter(p => p.role === "technician"), [profiles]);

  const jobs = rawJobs as unknown as MapJob[];

  const mappableJobs = useMemo(() => {
    let filtered = jobs.filter(j => j.property_latitude != null && j.property_longitude != null && j.status !== "cancelled");
    if (selectedTechnicianId) {
      filtered = filtered.filter(j => j.assigned_technician_id === selectedTechnicianId);
    }
    return filtered;
  }, [jobs, selectedTechnicianId]);

  const sortedRouteJobs = useMemo(() => {
    if (!showRouteView) return mappableJobs;
    return [...mappableJobs].sort((a, b) => {
      if (a.scheduled_time && b.scheduled_time) return a.scheduled_time.localeCompare(b.scheduled_time);
      if (a.scheduled_time) return -1;
      if (b.scheduled_time) return 1;
      return 0;
    });
  }, [mappableJobs, showRouteView]);

  const positions = useMemo<[number, number][]>(
    () => sortedRouteJobs.map(j => [j.property_latitude!, j.property_longitude!]),
    [sortedRouteJobs]
  );

  const navigateDate = (dir: number) => {
    setSelectedDate(prev => new Date(prev.getTime() + dir * 86400000));
  };

  const goToday = () => setSelectedDate(new Date());

  const isAdmin = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  const unmappableCount = jobs.filter(j => j.property_latitude == null || j.property_longitude == null).length;

  return (
    <Card className="p-4 border-0 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h2 className="text-xl font-display font-bold flex-1">Map View</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && technicians.length > 0 && (
            <select
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
              value={selectedTechnicianId}
              onChange={e => setSelectedTechnicianId(e.target.value)}
            >
              <option value="">All Engineers</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          )}

          <Button
            variant={showRouteView ? "default" : "outline"}
            size="sm"
            onClick={() => setShowRouteView(!showRouteView)}
            className="h-8"
            disabled={mappableJobs.length < 2}
          >
            <Route className="w-3.5 h-3.5 mr-1.5" />
            Route
          </Button>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navigateDate(-1)} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday} className="h-8 px-3 text-xs">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateDate(1)} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <span className="text-sm font-medium text-muted-foreground">
            {selectedDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {unmappableCount > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
          {unmappableCount} job{unmappableCount !== 1 ? "s" : ""} missing location data (use "Lookup exact location" on property pages to add coordinates)
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 500 }}>
        <MapContainer
          center={[54.5, -2.5]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.length > 0 && <FitBounds positions={positions} />}

          {sortedRouteJobs.map((job, index) => (
            <Marker
              key={job.id}
              position={[job.property_latitude!, job.property_longitude!]}
              icon={createColoredIcon(
                STATUS_COLORS[job.status] || "#6b7280",
                showRouteView ? String(index + 1) : undefined
              )}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <p className="font-bold text-sm">{job.customer_name || "Unknown"}</p>
                  <p className="text-xs text-gray-600">{job.property_address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded uppercase text-white"
                      style={{ backgroundColor: STATUS_COLORS[job.status] || "#6b7280" }}
                    >
                      {job.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {job.job_type_name ?? job.job_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  {job.scheduled_time && (
                    <p className="text-xs mt-1">Time: {formatTime(job.scheduled_time)}</p>
                  )}
                  {job.technician_name && (
                    <p className="text-xs text-gray-500">Engineer: {job.technician_name}</p>
                  )}
                  <p className="text-xs text-gray-500">Priority: {PRIORITY_LABELS[job.priority] || job.priority}</p>
                  <div className="flex gap-1.5 mt-2">
                    <Link href={`/jobs/${job.id}`}>
                      <button className="flex items-center gap-1 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
                        <ExternalLink className="w-3 h-3" /> View
                      </button>
                    </Link>
                    <button
                      className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600"
                      onClick={() => openNavigation(job.property_latitude!, job.property_longitude!)}
                    >
                      <Navigation className="w-3 h-3" /> Navigate
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {showRouteView && positions.length >= 2 && (
            <Polyline
              positions={positions}
              pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.7, dashArray: "10, 6" }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{status.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>

      {mappableJobs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No jobs with location data for this date. Add coordinates to properties using "Lookup exact location" on property pages.
        </div>
      )}
    </Card>
  );
}
