import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { PortalLayout } from "./portal-layout";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Building2, ChevronRight } from "lucide-react";

export default function PortalProperties() {
  const { session } = usePortalAuth();

  const { data: properties, isLoading } = useQuery({
    queryKey: ["portal-properties"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/properties`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load properties");
      return res.json();
    },
    enabled: !!session,
    staleTime: 60_000,
  });

  return (
    <PortalLayout>
      <div className="space-y-6 animate-in fade-in">
        <h1 className="text-2xl font-bold text-slate-900">Your Properties</h1>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-48 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-24" />
              </Card>
            ))}
          </div>
        ) : !properties?.length ? (
          <Card className="p-8 text-center border-dashed">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No properties on record.</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {properties.map((prop: any) => (
              <Link key={prop.id} href={`/portal/properties/${prop.id}`}>
                <Card className="p-5 border border-slate-200 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{prop.address_line1}</p>
                        <p className="text-sm text-slate-500">
                          {[prop.city, prop.postcode].filter(Boolean).join(", ")}
                        </p>
                        {prop.property_type && (
                          <span className="inline-block mt-1.5 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-600 capitalize">
                            {prop.property_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
