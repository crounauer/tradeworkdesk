import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { PortalLayout } from "./portal-layout";
import { Card } from "@/components/ui/card";
import { Link, useParams } from "wouter";
import { ArrowLeft, Building2, Wrench, Calendar } from "lucide-react";

export default function PortalPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = usePortalAuth();

  const { data: properties } = useQuery({
    queryKey: ["portal-properties"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/properties`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!session,
    staleTime: 60_000,
  });

  const property = (properties || []).find((p: any) => p.id === id);

  const { data: appliances, isLoading } = useQuery({
    queryKey: ["portal-appliances", id],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/properties/${id}/appliances`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load appliances");
      return res.json();
    },
    enabled: !!session && !!id,
    staleTime: 60_000,
  });

  return (
    <PortalLayout>
      <div className="space-y-6 animate-in fade-in">
        <Link href="/portal/properties" className="inline-flex items-center text-sm text-slate-500 hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Properties
        </Link>

        {property ? (
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{property.address_line1}</h1>
              <p className="text-slate-500">
                {[property.address_line2, property.city, property.county, property.postcode].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-bold text-slate-900">Property Details</h1>
        )}

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Appliances</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i} className="p-5 animate-pulse">
                  <div className="h-5 bg-slate-200 rounded w-40 mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-64" />
                </Card>
              ))}
            </div>
          ) : !appliances?.length ? (
            <Card className="p-8 text-center border-dashed">
              <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No appliances recorded for this property.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {appliances.map((app: any) => (
                <Card key={app.id} className="p-5 border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg mt-0.5">
                      <Wrench className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {[app.manufacturer, app.model].filter(Boolean).join(" ") || "Appliance"}
                        </p>
                        {app.serial_number && (
                          <p className="text-xs text-slate-500">S/N: {app.serial_number}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {app.boiler_type && (
                          <span className="text-xs font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-600 capitalize">
                            {app.boiler_type}
                          </span>
                        )}
                        {app.fuel_type && (
                          <span className="text-xs font-medium bg-blue-50 px-2 py-0.5 rounded text-blue-600 capitalize">
                            {app.fuel_type}
                          </span>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2 text-sm">
                        {app.installation_date && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Installed: {new Date(app.installation_date + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
                          </div>
                        )}
                        {app.last_service_date && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Last service: {new Date(app.last_service_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        )}
                        {app.next_service_due && (
                          <div className={`flex items-center gap-1 font-medium ${new Date(app.next_service_due) < new Date() ? "text-red-600" : "text-emerald-600"}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Next due: {new Date(app.next_service_due + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
