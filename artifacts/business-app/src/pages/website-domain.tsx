/**
 * Website Domain management page
 * - Add custom domain
 * - Show DNS setup instructions
 * - Show verification & SSL status
 * - Trigger re-verification
 * - Remove domain
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Globe, Trash2, RefreshCw, ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Copy } from "lucide-react";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  ttl: string;
}

interface Domain {
  id: string;
  domain: string;
  verification_status: "pending" | "verifying" | "verified" | "failed";
  ssl_status: "pending" | "provisioning" | "active" | "failed";
  is_active: boolean;
  is_platform_subdomain: boolean;
  verification_token: string | null;
  dns_instructions?: {
    records?: DnsRecord[];
    /** @deprecated */ cname: DnsRecord;
    /** @deprecated */ www: DnsRecord;
  } | null;
}

function StatusBadge({ status, type }: { status: string; type: "verification" | "ssl" }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
    verified: { label: "Verified", variant: "default", icon: CheckCircle },
    active: { label: "Active", variant: "default", icon: CheckCircle },
    pending: { label: "Pending", variant: "secondary", icon: Clock },
    verifying: { label: "Verifying…", variant: "outline", icon: Clock },
    provisioning: { label: "Provisioning…", variant: "outline", icon: Clock },
    failed: { label: "Failed", variant: "destructive", icon: XCircle },
  };

  const cfg = map[status] ?? { label: status, variant: "outline" as const, icon: Clock };
  const Icon = cfg.icon;

  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="w-3 h-3" /> {cfg.label}
    </Badge>
  );
}

function DnsRow({ record }: { record: DnsRecord }) {
  const { toast } = useToast();

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied!" }));
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 font-mono text-xs font-semibold">{record.type}</td>
      <td className="py-2 pr-4 font-mono text-xs">{record.name}</td>
      <td className="py-2 pr-4 font-mono text-xs max-w-xs break-all">{record.value}</td>
      <td className="py-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(record.value)}>
          <Copy className="w-3 h-3" />
        </Button>
      </td>
    </tr>
  );
}

export default function WebsiteDomain() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [deletingDomain, setDeletingDomain] = useState<Domain | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: domains = [], isLoading } = useQuery<Domain[]>({
    queryKey: ["/api/website/domains"],
    queryFn: () => apiFetch("/api/website/domains"),
  });

  const platformDomain = domains.find((d) => d.is_platform_subdomain);
  const customDomains = domains.filter((d) => !d.is_platform_subdomain);

  const addMutation = useMutation({
    mutationFn: (domain: string) =>
      apiFetch("/api/website/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/domains"] });
      setAdding(false);
      setNewDomain("");
      toast({ title: "Domain added", description: "Follow the DNS instructions below to verify your domain." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (domainId: string) =>
      apiFetch(`/api/website/domains/${domainId}/verify`, { method: "POST" }),
    onSuccess: (data: Domain) => {
      qc.invalidateQueries({ queryKey: ["/api/website/domains"] });
      if (data.is_active) {
        toast({ title: "Domain verified and active!", description: "SSL is provisioned. Your site is live." });
      } else {
        toast({ title: "Verification checked", description: "DNS may still be propagating. Check back in a few minutes." });
      }
    },
    onError: (e: Error) => toast({ title: "Verification failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (domainId: string) =>
      apiFetch(`/api/website/domains/${domainId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website/domains"] });
      setDeletingDomain(null);
      toast({ title: "Domain removed" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/website">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Website Domain</h1>
      </div>

      <p className="text-muted-foreground text-sm">
        Your site comes with a free address instantly. You can also connect your own domain (e.g. <code className="text-xs bg-muted px-1 rounded">www.myplumbingco.co.uk</code>) at any time.
      </p>

      {/* Free platform subdomain */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : platformDomain ? (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-1">Your free site address</p>
                <CardTitle className="text-base font-mono text-green-900">{platformDomain.domain}</CardTitle>
              </div>
              <Badge variant="default" className="bg-green-600 gap-1">
                <CheckCircle className="w-3 h-3" /> Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/website/preview" className="text-sm text-green-700 underline">
              Open preview
            </Link>
            <p className="text-xs text-green-700 mt-1">This address is always active — no setup needed.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Custom domains */}
      {!isLoading && customDomains.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom Domain</h2>
          {customDomains.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{d.domain}</CardTitle>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.verification_status} type="verification" />
                    <StatusBadge status={d.ssl_status} type="ssl" />
                    <Button
                      variant="outline" size="sm"
                      onClick={() => verifyMutation.mutate(d.id)}
                      disabled={verifyMutation.isPending}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Check Status
                    </Button>
                    <Button
                      variant="outline" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingDomain(d)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {d.dns_instructions && !d.is_active && (
                <CardContent>
                  <p className="text-sm font-medium mb-3">DNS Records to add at your domain registrar:</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground text-xs uppercase border-b">
                          <th className="py-1 pr-4 text-left">Type</th>
                          <th className="py-1 pr-4 text-left">Name</th>
                          <th className="py-1 pr-4 text-left">Value</th>
                          <th className="py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {(d.dns_instructions.records ?? [d.dns_instructions.cname, d.dns_instructions.www]).map((rec, i) => (
                          <DnsRow key={i} record={rec} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    DNS changes can take up to 24–48 hours to propagate. Click "Check Status" once you've added the records.
                  </p>
                </CardContent>
              )}

              {d.is_active && (
                <CardContent>
                  <p className="text-sm text-green-700 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Your site preview is available at <Link href="/website/preview" className="underline ml-1">/website/preview</Link>
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add custom domain (only when no custom domain exists yet) */}
      {customDomains.length === 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Connect Your Own Domain</h2>
          {!adding ? (
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Globe className="w-4 h-4 mr-2" /> Add Custom Domain
            </Button>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label>Domain</Label>
                  <Input
                    placeholder="www.myplumbingco.co.uk"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => addMutation.mutate(newDomain)}
                    disabled={!newDomain || addMutation.isPending}
                  >
                    {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Add Domain
                  </Button>
                  <Button variant="outline" onClick={() => { setAdding(false); setNewDomain(""); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={!!deletingDomain} onOpenChange={(o) => !o && setDeletingDomain(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deletingDomain?.domain}</strong> from your website. Your site will no longer be accessible at this address.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingDomain && deleteMutation.mutate(deletingDomain.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
