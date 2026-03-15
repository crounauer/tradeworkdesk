import { useState } from "react";
import { useGlobalSearch } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search as SearchIcon, Users, Home, Flame, Briefcase } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useGlobalSearch(
    { q: query },
    { query: { enabled: query.length >= 2 } }
  );

  const totalResults =
    (data?.customers?.length || 0) +
    (data?.properties?.length || 0) +
    (data?.appliances?.length || 0) +
    (data?.jobs?.length || 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">Search</h1>
        <p className="text-muted-foreground mt-1">Find customers, properties, appliances, and jobs</p>
      </div>

      <div className="flex items-center relative max-w-xl">
        <SearchIcon className="w-5 h-5 absolute left-3 text-muted-foreground" />
        <Input
          placeholder="Search by name, address, serial number..."
          className="pl-10 h-12 text-base"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.length >= 2 && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : totalResults === 0 ? (
            <p className="text-muted-foreground text-center py-12">No results found for "{query}"</p>
          ) : (
            <div className="space-y-8">
              {data?.customers && data.customers.length > 0 && (
                <div>
                  <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" /> Customers ({data.customers.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.customers.map((c: any) => (
                      <Link key={c.id} href={`/customers/${c.id}`}>
                        <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                          <p className="font-bold">{c.first_name} {c.last_name}</p>
                          <p className="text-sm text-muted-foreground">{c.phone || c.email || ""}</p>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data?.properties && data.properties.length > 0 && (
                <div>
                  <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Home className="w-5 h-5 text-emerald-500" /> Properties ({data.properties.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.properties.map((p: any) => (
                      <Link key={p.id} href={`/properties/${p.id}`}>
                        <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                          <p className="font-bold">{p.address_line1}</p>
                          <p className="text-sm text-muted-foreground">{p.city} {p.postcode}</p>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data?.appliances && data.appliances.length > 0 && (
                <div>
                  <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" /> Appliances ({data.appliances.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.appliances.map((a: any) => (
                      <Link key={a.id} href={`/appliances/${a.id}`}>
                        <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                          <p className="font-bold">{a.manufacturer} {a.model}</p>
                          <p className="text-sm text-muted-foreground font-mono">SN: {a.serial_number}</p>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data?.jobs && data.jobs.length > 0 && (
                <div>
                  <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-purple-500" /> Jobs ({data.jobs.length})
                  </h2>
                  <div className="space-y-3">
                    {data.jobs.map((j: any) => (
                      <Link key={j.id} href={`/jobs/${j.id}`}>
                        <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold">{j.customer_name}</p>
                              <p className="text-sm text-muted-foreground">{j.property_address}</p>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 capitalize">
                              {j.status?.replace("_", " ")}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
