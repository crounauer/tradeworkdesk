import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Globe, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type TenantIndexNowResult = {
  host: string;
  submitted: number;
  upstreamStatus: number;
  success: boolean;
  upstreamBody: string | null;
};

type TenantIndexNowResponse = {
  success: boolean;
  submitted: number;
  urls: string[];
  hostsSucceeded: number;
  hostsFailed: number;
  results: TenantIndexNowResult[];
  error?: string;
};

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

const LS_KEY = "indexnow_last_result";

export default function WebsiteIndexNow() {
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<TenantIndexNowResponse | null>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? JSON.parse(stored) as TenantIndexNowResponse : null;
    } catch {
      return null;
    }
  });

  const { data: website } = useQuery<{ id: string } | null>({
    queryKey: ["/api/website", "indexnow-check"],
    queryFn: async () => {
      try {
        return await apiFetch<{ id: string }>("/api/website");
      } catch {
        return null;
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => apiFetch<TenantIndexNowResponse>("/api/indexnow/submit-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    onSuccess: (data) => {
      setLastResult(data);
      try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
      toast({
        title: "IndexNow submitted",
        description: `${data.submitted} URLs submitted across ${data.results.length} domain(s)`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "IndexNow failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/website">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">IndexNow</h1>
          <p className="text-sm text-muted-foreground">Auto-submit is enabled for publish and URL changes. Use the button for a manual re-submit anytime.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Tenant Website Indexing
          </CardTitle>
          <CardDescription>
            Sends all published pages and published blog posts for one domain: active custom domain (preferred), otherwise platform subdomain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !website}
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              <><Globe className="w-4 h-4 mr-2" />Manual Re-submit Website URLs</>
            )}
          </Button>
          {!website && (
            <p className="text-sm text-amber-700">
              You need to create and publish your website before submitting URLs.
            </p>
          )}
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Submission</CardTitle>
            <CardDescription>
              {lastResult.submitted} URLs submitted. {lastResult.hostsSucceeded} domain(s) succeeded, {lastResult.hostsFailed} failed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastResult.results.map((item) => (
              <div key={item.host} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.host}</p>
                  <p className="text-xs text-muted-foreground">{item.submitted} URLs • upstream {item.upstreamStatus}</p>
                </div>
                {item.success ? (
                  <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="w-4 h-4" />Success</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-700"><XCircle className="w-4 h-4" />Failed</span>
                )}
              </div>
            ))}

            {lastResult.urls.length > 0 && (
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Last submitted URLs ({lastResult.urls.length})</p>
                <ul className="max-h-56 overflow-y-auto space-y-1 text-xs">
                  {lastResult.urls.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline break-all">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
