import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

const EVENT_COLORS: Record<string, string> = {
  company_registered: "bg-green-100 text-green-700",
  tenant_updated: "bg-blue-100 text-blue-700",
  plan_created: "bg-purple-100 text-purple-700",
  plan_updated: "bg-purple-100 text-purple-700",
};

export default function PlatformAuditLog() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["platform-audit-log"],
    queryFn: async () => {
      const res = await fetch("/api/platform/audit-log?limit=100");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Platform activity history</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Card key={i}><CardContent className="p-3"><div className="h-8 bg-slate-100 rounded animate-pulse" /></CardContent></Card>)}</div>
      ) : !entries || entries.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No audit entries yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: { id: string; event_type: string; actor_email: string | null; entity_type: string | null; entity_id: string | null; detail: Record<string, unknown> | null; created_at: string }) => (
            <Card key={entry.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={EVENT_COLORS[entry.event_type] || "bg-slate-100 text-slate-700"}>
                      {entry.event_type.replace(/_/g, " ")}
                    </Badge>
                    {entry.entity_type && (
                      <span className="text-xs text-muted-foreground">{entry.entity_type}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.actor_email || "System"} &middot; {new Date(entry.created_at).toLocaleString()}
                    {entry.detail && Object.keys(entry.detail).length > 0 && (
                      <span className="ml-2">{JSON.stringify(entry.detail).substring(0, 80)}</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
