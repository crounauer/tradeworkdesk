import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { PortalLayout } from "./portal-layout";
import { Link, useParams } from "wouter";
import { ArrowLeft, Building2 } from "lucide-react";

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

      </div>
    </PortalLayout>
  );
}
