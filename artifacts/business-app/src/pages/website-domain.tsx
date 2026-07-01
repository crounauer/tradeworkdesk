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
  note?: string;
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
    advanced_records?: DnsRecord[];
    strategy?: "simple_cname" | "apex_advanced";
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

function DomainSetupSteps({ domain, records }: { domain: string; records: DnsRecord[] }) {
  const apexDomain = domain.replace(/^www\./, "");
  const primaryCnameTarget = records.find((r) => r.type.toUpperCase() === "CNAME")?.value;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p><strong>Scenario 1 (free subdomain):</strong> your TradeWorkDesk site address is already live and needs no tenant DNS setup.</p>
        <p className="mt-1"><strong>Scenario 2 (custom domain):</strong> tenant adds one DNS record only: <strong>CNAME www</strong> to the value shown below.</p>
        <p className="mt-1"><strong>Platform one-time setup:</strong> in the <strong>tradeworkdesk.co.uk</strong> zone, keep <strong>CNAME sites</strong> and <strong>CNAME *</strong> pointing to {primaryCnameTarget || "the Fly renderer target"}.</p>
        <p className="mt-1"><strong>Optional apex/root:</strong> forward the root domain to <strong>www</strong> at the registrar if needed.</p>
      </div>
      <p className="font-medium">Follow these steps exactly, in order:</p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Open your DNS provider for <strong>{apexDomain}</strong> (GoDaddy, Cloudflare, 123-Reg, Namecheap, etc.).</li>
        <li>Remove old records for the same hostnames if they point somewhere else (for example old Vercel, Wix, Squarespace, Shopify, or another host).</li>
        <li>Add the DNS records below exactly as shown.</li>
        <li>For the easiest setup, connect <strong>www</strong> first with a single CNAME record.</li>
        <li>Save DNS changes in your registrar panel.</li>
        <li>Wait for DNS propagation. Most updates are quick, but some registrars can take up to 24-48 hours.</li>
        <li>Return here and click <strong>Check Status</strong>.</li>
        <li>When verification and SSL are active, your custom domain is live.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Tip: If your provider asks for “Host”, use the values in the <strong>Name</strong> column below (for example <code className="text-xs bg-muted px-1 rounded">@</code> or <code className="text-xs bg-muted px-1 rounded">www</code>).
      </p>
      {records.length > 0 && (
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          Recommended setup: add exactly {records.length} record{records.length > 1 ? "s" : ""}.
        </div>
      )}
    </div>
  );
}

function ProviderWalkthroughs({ records }: { records: DnsRecord[] }) {
  const hasApexA = records.some((r) => r.type.toUpperCase() === "A" && r.name === "@");
  const hasApexAAAA = records.some((r) => r.type.toUpperCase() === "AAAA" && r.name === "@");
  const hasWwwCname = records.some((r) => r.type.toUpperCase() === "CNAME" && (r.name === "www" || r.name.startsWith("www.")));

  return (
    <div className="mt-4 rounded-md border p-3">
      <p className="text-sm font-medium mb-2">Registrar-specific quick steps</p>
      <div className="space-y-2 text-xs text-muted-foreground">
        <details>
          <summary className="cursor-pointer font-medium text-foreground">Cloudflare</summary>
          <p className="mt-1">Open DNS, delete conflicting records, then add each record from the table exactly. Keep Proxy set to DNS only until verification is active.</p>
        </details>
        <details>
          <summary className="cursor-pointer font-medium text-foreground">GoDaddy</summary>
          <p className="mt-1">Go to Manage DNS, remove old A/CNAME for the same host, then add records from the table. Use Host @ for apex A record and Host www for www CNAME.</p>
        </details>
        <details>
          <summary className="cursor-pointer font-medium text-foreground">123-Reg</summary>
          <p className="mt-1">Go to Manage DNS and Advanced DNS, replace conflicting records, add exact Type/Name/Value rows from the table, then save.</p>
        </details>
        <details>
          <summary className="cursor-pointer font-medium text-foreground">Namecheap</summary>
          <p className="mt-1">Open Domain List and Advanced DNS, then in Host Records add table values exactly. Use @ for root and www for subdomain where listed.</p>
        </details>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Custom-domain expected setup: {hasWwwCname ? "www CNAME" : "CNAME"}{hasApexA || hasApexAAAA ? " (apex records are configured via advanced setup)" : ""}.
      </p>
    </div>
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
    onSuccess: (data: { setup_hint?: string | null }) => {
      qc.invalidateQueries({ queryKey: ["/api/website/domains"] });
      setAdding(false);
      setNewDomain("");
      toast({
        title: "Domain added",
        description: data?.setup_hint || "Follow the DNS instructions below to verify your domain.",
      });
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
              Open preview (edit mode)
            </Link>
            <p className="text-xs text-green-700 mt-1">Use preview mode to edit safely before sharing the free site address.</p>
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

              {d.dns_instructions && (
                <CardContent className="space-y-3">
                  {d.is_active && (
                    <p className="text-sm text-green-700 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Your site is live at <a href={`https://${d.domain}?twd_edit=1`} target="_blank" rel="noopener noreferrer" className="underline ml-1">{d.domain}</a>
                    </p>
                  )}

                  {(() => {
                    const records = (d.dns_instructions.records ?? [d.dns_instructions.cname, d.dns_instructions.www]).filter(Boolean);
                    const advancedRecords = (d.dns_instructions.advanced_records ?? []).filter(Boolean);
                    return (
                      <details className="rounded-md border bg-muted/20 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-foreground">
                          DNS advice {d.is_active ? "(expand to review)" : "(expand to set up)"}
                        </summary>
                        <div className="mt-4 space-y-4">
                          <div className="rounded-md border bg-green-50 p-3 text-xs text-green-800">
                            Recommended: connect <strong>www</strong> first using one CNAME record.
                          </div>
                          <DomainSetupSteps domain={d.domain} records={records} />
                          <ProviderWalkthroughs records={records} />
                          <div>
                            <p className="text-sm font-medium mt-1 mb-3">DNS records to add:</p>
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
                                  {records.map((rec, i) => (
                                    <DnsRow key={i} record={rec} />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          {advancedRecords.length > 0 && (
                            <details className="rounded-md border p-3">
                              <summary className="cursor-pointer text-sm font-medium">Advanced: root domain (apex) setup</summary>
                              <p className="text-xs text-muted-foreground mt-2 mb-3">
                                Only use this if you need the bare domain (for example <strong>example.co.uk</strong>) to resolve directly.
                              </p>
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
                                    {advancedRecords.map((rec, i) => (
                                      <DnsRow key={`advanced-${i}`} record={rec} />
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )}
                        </div>
                      </details>
                    );
                  })()}
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
