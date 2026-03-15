import { useListAppliances } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search, Flame, Settings } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

export default function Appliances() {
  const [search, setSearch] = useState("");
  const { data: appliances, isLoading } = useListAppliances({ search: search || undefined });

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Appliances</h1>
          <p className="text-muted-foreground mt-1">Boiler and equipment database</p>
        </div>
      </div>

      <div className="flex items-center relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 text-muted-foreground" />
        <Input 
          placeholder="Search by manufacturer, model, or serial..." 
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appliances?.map(app => (
            <Link key={app.id} href={`/appliances/${app.id}`}>
              <Card className="p-5 border border-border/50 hover:shadow-md hover:border-orange-500/30 transition-all cursor-pointer h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{app.manufacturer || 'Unknown Make'}</h3>
                    <p className="text-sm font-medium text-muted-foreground">{app.model || 'Unknown Model'}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">Serial No.</span>
                    <span className="font-mono">{app.serial_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">Fuel</span>
                    <span className="capitalize">{app.fuel_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Service</span>
                    <span className={`font-medium ${new Date(app.next_service_due || '') < new Date() ? 'text-destructive' : 'text-emerald-600'}`}>
                      {formatDate(app.next_service_due)}
                    </span>
                  </div>
                </div>
                
                {app.property_address && (
                  <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
                    <Settings className="w-3 h-3" /> Installed at: {app.property_address}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
