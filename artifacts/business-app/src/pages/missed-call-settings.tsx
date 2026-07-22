/**
 * Missed Call Text-Back — configure automatic SMS replies to missed calls
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Phone, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface MissedCallSettings {
  is_enabled: boolean;
  business_number: string | null;
  sender_id: string | null;
  message_template: string;
  delay_seconds: number;
  business_hours_only: boolean;
  business_start: string;
  business_end: string;
  provider: string;
}

interface MissedCallLog {
  id: string;
  caller_number: string;
  received_at: string;
  response_sent: boolean;
  response_at: string | null;
  message_sent: string | null;
  suppressed: boolean;
  suppression_reason: string | null;
  customer: { first_name: string | null; last_name: string | null; phone: string } | null;
}

const DEFAULT_SETTINGS: MissedCallSettings = {
  is_enabled: false,
  business_number: null,
  sender_id: null,
  message_template: "Hi, sorry we missed your call. We'll be in touch shortly. - {{company_name}}",
  delay_seconds: 30,
  business_hours_only: true,
  business_start: "08:00",
  business_end: "18:00",
  provider: "smsworks",
};

export default function MissedCallSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<MissedCallSettings>(DEFAULT_SETTINGS);

  const { data: fetchedSettings, isLoading: settingsLoading } = useQuery<MissedCallSettings>({
    queryKey: ["/api/missed-call/settings"],
    queryFn: () => apiFetch("/api/missed-call/settings"),
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<MissedCallLog[]>({
    queryKey: ["/api/missed-call/logs"],
    queryFn: () => apiFetch("/api/missed-call/logs?limit=50"),
  });

  useEffect(() => {
    if (fetchedSettings && Object.keys(fetchedSettings).length > 0) {
      setSettings({ ...DEFAULT_SETTINGS, ...fetchedSettings });
    }
  }, [fetchedSettings]);

  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/api/missed-call/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/missed-call/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (settingsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const respondedCount = logs.filter((l) => l.response_sent).length;
  const suppressedCount = logs.filter((l) => l.suppressed).length;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Phone className="w-5 h-5 text-purple-600" />
        <h1 className="text-2xl font-bold">Missed Call Text-Back</h1>
        <Badge variant={settings.is_enabled ? "default" : "secondary"}>
          {settings.is_enabled ? "Active" : "Disabled"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Missed Calls</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{respondedCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Texts Sent</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{suppressedCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Suppressed</p>
        </CardContent></Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable missed call text-back</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically send an SMS when a call goes unanswered</p>
            </div>
            <Switch checked={settings.is_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, is_enabled: v }))} />
          </div>
          <Separator />

          <div className="space-y-1">
            <Label className="text-xs">Your business phone number (E.164 format)</Label>
            <Input value={settings.business_number ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, business_number: e.target.value || null }))}
              placeholder="+447700900000" />
            <p className="text-xs text-muted-foreground">This is the number customers call. Must match your SMS Works / Twilio number.</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">SMS Sender ID (name shown to recipient)</Label>
            <Input value={settings.sender_id ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, sender_id: e.target.value || null }))}
              placeholder="YourBusiness (max 11 chars)" maxLength={11} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select value={settings.provider}
              onValueChange={(v) => setSettings((s) => ({ ...s, provider: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smsworks">SMS Works</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Response delay (seconds)</Label>
            <Select value={String(settings.delay_seconds)}
              onValueChange={(v) => setSettings((s) => ({ ...s, delay_seconds: parseInt(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Immediately</SelectItem>
                <SelectItem value="15">15 seconds</SelectItem>
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">1 minute</SelectItem>
                <SelectItem value="300">5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Message template</Label>
            <Textarea value={settings.message_template}
              onChange={(e) => setSettings((s) => ({ ...s, message_template: e.target.value }))}
              rows={3} />
            <p className="text-xs text-muted-foreground">Variable: <code>{"{{company_name}}"}</code></p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Business hours only</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Suppress texts outside your working hours</p>
            </div>
            <Switch checked={settings.business_hours_only}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, business_hours_only: v }))} />
          </div>

          {settings.business_hours_only && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Business start</Label>
                <Input type="time" value={settings.business_start}
                  onChange={(e) => setSettings((s) => ({ ...s, business_start: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Business end</Label>
                <Input type="time" value={settings.business_end}
                  onChange={(e) => setSettings((s) => ({ ...s, business_end: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook instructions */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Webhook Setup</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Configure your SMS provider to POST missed call events to:</p>
          <code className="block bg-muted p-2 rounded text-xs font-mono break-all">
            POST /api/public/missed-call/webhook
          </code>
          <p className="font-medium text-foreground">SMS Works:</p>
          <p>In your SMS Works dashboard, set the "Missed Call Webhook" URL to the above endpoint.</p>
          <p className="font-medium text-foreground">Twilio:</p>
          <p>Set the Status Callback URL on your Twilio phone number to the above endpoint. Set HTTP method to POST.</p>
        </CardContent>
      </Card>

      {/* Log */}
      <div className="space-y-2">
        <h2 className="font-semibold text-base">Recent Missed Calls</h2>
        {logsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missed calls logged yet.</p>
        ) : (
          logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-3 flex items-center gap-3">
                {log.response_sent
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : log.suppressed
                    ? <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{log.caller_number}</p>
                    {log.customer && (
                      <span className="text-xs text-muted-foreground">
                        ({log.customer.first_name ?? ""} {log.customer.last_name ?? ""})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.received_at), "d MMM yyyy HH:mm")}
                    {log.suppressed && log.suppression_reason && ` · Suppressed: ${log.suppression_reason.replace(/_/g, " ")}`}
                    {log.response_sent && log.response_at && ` · Replied ${format(new Date(log.response_at), "HH:mm")}`}
                  </p>
                </div>
                <Badge variant={log.response_sent ? "default" : log.suppressed ? "secondary" : "destructive"} className="text-[10px] flex-shrink-0">
                  {log.response_sent ? "sent" : log.suppressed ? "suppressed" : "failed"}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
