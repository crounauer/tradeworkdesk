import { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const pinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>`,
  className: "",
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
});

function RecenterMap({ lat, lng, skipRef }: { lat: number; lng: number; skipRef: React.MutableRefObject<boolean> }) {
  const map = useMap();
  const prevRef = useRef({ lat: 0, lng: 0 });
  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      prevRef.current = { lat, lng };
      return;
    }
    if (lat !== prevRef.current.lat || lng !== prevRef.current.lng) {
      map.setView([lat, lng], 16);
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map, skipRef]);
  return null;
}

function DraggableMarker({ lat, lng, onDragEnd }: { lat: number; lng: number; onDragEnd: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const pos = marker.getLatLng();
        onDragEnd(pos.lat, pos.lng);
      }
    },
  }), [onDragEnd]);

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[lat, lng]}
      ref={markerRef}
      icon={pinIcon}
    />
  );
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface PropertyLocationLookupProps {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  onLocationFound: (lat: number, lng: number) => void;
  onClearLocation?: () => void;
}

export function PropertyLocationLookup({
  address,
  latitude,
  longitude,
  onLocationFound,
  onClearLocation,
}: PropertyLocationLookupProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const hasCoords = latitude != null && longitude != null;
  const skipRecenterRef = useRef(false);

  const handleLookup = async () => {
    if (!address.trim()) {
      toast({ title: "No address", description: "Enter an address before looking up location", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });

      if (res.status === 402) {
        toast({ title: "Feature not available", description: "Geomapping is not included in your current plan", variant: "destructive" });
        return;
      }

      if (res.status === 404) {
        toast({ title: "Not found", description: "Could not find coordinates for this address. Try a more complete address.", variant: "destructive" });
        return;
      }

      if (!res.ok) {
        throw new Error("Geocoding failed");
      }

      const data = await res.json();
      onLocationFound(data.latitude, data.longitude);
      toast({ title: "Location found", description: data.display_name });
    } catch {
      toast({ title: "Error", description: "Failed to look up location. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePinMove = (lat: number, lng: number) => {
    skipRecenterRef.current = true;
    onLocationFound(lat, lng);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLookup}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 mr-2" />
          )}
          {loading ? "Looking up..." : "Lookup exact location"}
        </Button>
        {hasCoords && onClearLocation && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearLocation}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
        {hasCoords && (
          <span className="text-xs text-muted-foreground">
            {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
          </span>
        )}
      </div>

      {hasCoords && (
        <>
          <p className="text-xs text-muted-foreground">
            Drag the pin or click the map to adjust the exact position.
          </p>
          <div className="rounded-lg overflow-hidden border border-border" style={{ height: 250 }}>
            <MapContainer
              center={[latitude!, longitude!]}
              zoom={16}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
              dragging={true}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <DraggableMarker lat={latitude!} lng={longitude!} onDragEnd={handlePinMove} />
              <MapClickHandler onClick={handlePinMove} />
              <RecenterMap lat={latitude!} lng={longitude!} skipRef={skipRecenterRef} />
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
}
