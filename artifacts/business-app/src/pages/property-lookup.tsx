import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Briefcase, Clock3, ExternalLink, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { BookJobDialog } from "@/components/book-job-dialog";
import { PostcodeAddressFinder } from "@/components/postcode-address-finder";

const PropertyLocationLookup = lazy(() =>
  import("@/components/property-location-lookup").then((module) => ({ default: module.PropertyLocationLookup })),
);

type LookedUpProperty = {
  id: string;
  address_line1: string;
  address_line2: string;
  city: string;
  county: string;
  postcode: string;
  latitude: number;
  longitude: number;
  looked_up_at: string;
};

const MAX_HISTORY_ITEMS = 20;

function propertyAddress(property: LookedUpProperty): string {
  return [
    property.address_line1,
    property.address_line2,
    property.city,
    property.county,
    property.postcode,
  ].filter(Boolean).join(", ");
}

function propertyKey(property: LookedUpProperty): string {
  return `${property.address_line1}|${property.postcode}`.toLowerCase().replace(/\s+/g, "");
}

function readHistory(key: string): LookedUpProperty[] {
  try {
    const value = localStorage.getItem(key);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as LookedUpProperty[] : [];
  } catch {
    return [];
  }
}

export default function PropertyLookupPage() {
  const { profile } = useAuth();
  const { hasAddon, hasFeature, isLoading } = usePlanFeatures();
  const storageKey = useMemo(
    () => `property_lookup_history:${profile?.id || "anonymous"}`,
    [profile?.id],
  );
  const [history, setHistory] = useState<LookedUpProperty[]>(() => readHistory(storageKey));
  const [selected, setSelected] = useState<LookedUpProperty | null>(null);
  const [showBookJob, setShowBookJob] = useState(false);

  useEffect(() => {
    setHistory(readHistory(storageKey));
    setSelected(null);
  }, [storageKey]);

  if (!isLoading && (!hasFeature("geo_mapping") || !hasAddon("uk_address_lookup"))) {
    return (
      <UpgradePrompt
        feature={!hasFeature("geo_mapping") ? "geo_mapping" : "uk_address_lookup"}
        title="Property Lookup Not Available"
        description="Property Lookup requires Geomapping and the UK Address Lookup add-on."
      />
    );
  }

  const saveHistory = (next: LookedUpProperty[]) => {
    setHistory(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const selectProperty = (property: LookedUpProperty) => {
    const next = [
      { ...property, looked_up_at: new Date().toISOString() },
      ...history.filter((item) => propertyKey(item) !== propertyKey(property)),
    ].slice(0, MAX_HISTORY_ITEMS);
    saveHistory(next);
    setSelected(next[0]);
  };

  const updateSelectedCoordinates = (latitude: number, longitude: number) => {
    if (!selected) return;
    const updated = { ...selected, latitude, longitude };
    setSelected(updated);
    saveHistory([
      updated,
      ...history.filter((item) => propertyKey(item) !== propertyKey(updated)),
    ].slice(0, MAX_HISTORY_ITEMS));
  };

  const removeHistoryItem = (property: LookedUpProperty) => {
    saveHistory(history.filter((item) => item.id !== property.id));
    if (selected?.id === property.id) setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Property Lookup</h1>
        <p className="text-muted-foreground mt-1">
          Find and pin an exact property location without creating a customer or job.
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] gap-6 items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <PostcodeAddressFinder
              onAddressSelected={(address) => selectProperty({
                id: crypto.randomUUID(),
                ...address,
                looked_up_at: new Date().toISOString(),
              })}
            />
          </Card>

          {selected && (
            <Card className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h2 className="font-bold">{selected.address_line1}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{propertyAddress(selected)}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(
                      `https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`,
                      "_blank",
                      "noopener,noreferrer",
                    )}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Maps
                  </Button>
                  <Button
                    type="button"
                    disabled={!hasFeature("job_management") || profile?.role === "technician"}
                    onClick={() => setShowBookJob(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Create Job
                  </Button>
                </div>
              </div>

              <Suspense fallback={<div className="h-[250px] rounded bg-slate-100 animate-pulse" />}>
                <PropertyLocationLookup
                  address={propertyAddress(selected)}
                  latitude={selected.latitude}
                  longitude={selected.longitude}
                  onLocationFound={updateSelectedCoordinates}
                />
              </Suspense>
            </Card>
          )}
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <Clock3 className="w-4 h-4" /> Previous Lookups
            </h2>
            {history.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => saveHistory([])}>
                Clear
              </Button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Select an address to keep it here for quick access later.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((property) => (
                <div
                  key={property.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    selected?.id === property.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <button type="button" className="text-left w-full" onClick={() => setSelected(property)}>
                    <p className="font-medium text-sm">{property.address_line1}</p>
                    <p className="text-xs text-muted-foreground">{[property.city, property.postcode].filter(Boolean).join(", ")}</p>
                  </button>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(property.looked_up_at).toLocaleDateString("en-GB")}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${property.address_line1}`}
                      onClick={() => removeHistoryItem(property)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <BookJobDialog
        open={showBookJob}
        onOpenChange={setShowBookJob}
        initialBookingPrefill={selected ? {
          address_line1: selected.address_line1,
          address_line2: selected.address_line2,
          city: selected.city,
          county: selected.county,
          customer_postcode: selected.postcode,
          latitude: selected.latitude,
          longitude: selected.longitude,
        } : undefined}
      />
    </div>
  );
}
