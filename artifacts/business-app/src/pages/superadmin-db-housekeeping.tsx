import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, Database, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type HousekeepingRow = {
  id: number;
  table_schema: string;
  table_name: string;
  column_name: string;
  confidence: "high" | "medium" | "low";
  source: string;
  evidence: string | null;
  protected: boolean;
  notes: string | null;
  detected_at: string;
  resolved_at: string | null;
};

type HousekeepingResponse = {
  configured: boolean;
  message?: string;
  sqlTemplate: string;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  data: HousekeepingRow[];
};

function confidenceVariant(confidence: HousekeepingRow["confidence"]): "default" | "secondary" | "outline" | "destructive" {
  if (confidence === "high") return "destructive";
  if (confidence === "medium") return "default";
  return "secondary";
}

export default function SuperadminDbHousekeepingPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery<HousekeepingResponse>({
    queryKey: ["superadmin-db-housekeeping-unused-columns"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/db-housekeeping/unused-columns`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load DB housekeeping data");
      return body as HousekeepingResponse;
    },
  });

  const handleCopySql = async () => {
    if (!data?.sqlTemplate) return;
    try {
      await navigator.clipboard.writeText(data.sqlTemplate);
      setCopied(true);
      toast({ title: "SQL copied", description: "Paste it into Supabase SQL Editor and run it." });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Could not copy SQL to clipboard", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-7 w-7" />
            DB Housekeeping
          </h1>
          <p className="text-muted-foreground mt-1">Unused-column audit output for Superadmin review</p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Separator />

      {!isLoading && !data?.configured && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle>Setup required</AlertTitle>
          <AlertDescription>
            {data?.message || "Run the SQL template first, then refresh this page."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>SQL Template</CardTitle>
            <CardDescription>
              Run this once in Supabase SQL Editor to create the audit table and bootstrap query.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopySql} disabled={!data?.sqlTemplate}>
            <Copy className="h-4 w-4 mr-2" />
            {copied ? "Copied" : "Copy SQL"}
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[420px] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
            {data?.sqlTemplate || "Loading..."}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open Candidates</CardTitle>
          <CardDescription>
            Columns currently marked as likely unused and not resolved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Total: {data?.summary.total ?? 0}</Badge>
            <Badge variant="destructive">High: {data?.summary.high ?? 0}</Badge>
            <Badge>Medium: {data?.summary.medium ?? 0}</Badge>
            <Badge variant="secondary">Low: {data?.summary.low ?? 0}</Badge>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No open candidates yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Column</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Protected</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.table_schema}.{row.table_name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.column_name}</TableCell>
                      <TableCell>
                        <Badge variant={confidenceVariant(row.confidence)}>{row.confidence}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.source}</TableCell>
                      <TableCell>{row.protected ? "yes" : "no"}</TableCell>
                      <TableCell className="text-xs">{new Date(row.detected_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.notes || row.evidence || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}