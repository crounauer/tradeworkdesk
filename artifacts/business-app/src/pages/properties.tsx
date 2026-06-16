import { useListProperties } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search, Home, MapPin, Building } from "lucide-react";
import { useState } from "react";

export default function Properties() {
  const [search, setSearch] = useState("");
  const { data: properties, isLoading } = useListProperties({ search: search || undefined });

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Properties</h1>
          <p className="text-muted-foreground mt-1">All service locations</p>
        </div>
      </div>

      <div className="flex items-center relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 text-muted-foreground" />
        <Input 
          placeholder="Search address or postcode..." 
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties?.map(prop => (
            <Link key={prop.id} href={`/properties/${prop.id}`}>
              <Card className="p-5 border border-border/50 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <Building className="w-6 h-6" />
                  </div>
                  {prop.property_type && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                      {prop.property_type}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-lg mb-1">{prop.address_line1}</h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" /> {prop.city}, {prop.postcode}
                </div>
                {prop.customer_name && (
                  <div className="mt-4 pt-4 border-t border-border/50 text-sm">
                    <span className="text-muted-foreground">Owner: </span>
                    <span className="font-medium text-foreground">{prop.customer_name}</span>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
