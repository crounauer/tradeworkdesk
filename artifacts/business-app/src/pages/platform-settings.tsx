import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Settings2, MapPin, MessageSquare, Loader2, Check, Eye, EyeOff, CreditCard, Database, FlaskConical, CheckCircle2, XCircle, Play, RefreshCw, Clock, Globe, Download, Bell, Building2, Share2 } from "lucide-react";

type TenantOption = {
  id: string;
  company_name: string;
  contact_email?: string | null;
};

function PlatformFallbackTenantSetting() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("__auto__");
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}api/platform/settings/fallback_tenant_id`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch(`${import.meta.env.BASE_URL}api/platform/tenants`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
    ])
      .then(([settingData, tenantsData]) => {
        if (!mounted) return;
        const normalizedTenants = Array.isArray(tenantsData)
          ? tenantsData.map((t: Record<string, unknown>) => ({
              id: String(t.id || ""),
              company_name: String(t.company_name || "Unknown"),
              contact_email: t.contact_email ? String(t.contact_email) : null,
            })).filter((t: TenantOption) => t.id)
          : [];
        setTenants(normalizedTenants);

        const configured = typeof settingData?.value === "string" ? settingData.value.trim() : "";
        setSelectedTenantId(configured || "__auto__");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = selectedTenantId === "__auto__" ? null : selectedTenantId;
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/settings/fallback_tenant_id`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: payload }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save setting");

      toast({ title: "Saved", description: "Fallback tenant updated." });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save setting",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-20 animate-pulse bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Fallback Tenant for Deletes
        </CardTitle>
        <CardDescription>
          Choose where orphaned profiles are rehomed when tenant deletion cannot remove every auth user cleanly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-xl">
          <Label>Fallback tenant</Label>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Auto (system default behavior)</SelectItem>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.company_name}{tenant.contact_email ? ` (${tenant.contact_email})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Recommended: pick a stable internal tenant. Use Auto to let the platform choose fallback order.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PlatformSocialMarketingTenantSetting() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}api/platform/settings/social_marketing_tenant_id`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch(`${import.meta.env.BASE_URL}api/platform/tenants`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
    ])
      .then(([settingData, tenantsData]) => {
        if (!mounted) return;
        const normalizedTenants = Array.isArray(tenantsData)
          ? tenantsData.map((t: Record<string, unknown>) => ({
              id: String(t.id || ""),
              company_name: String(t.company_name || "Unknown"),
              contact_email: t.contact_email ? String(t.contact_email) : null,
            })).filter((t: TenantOption) => t.id)
          : [];
        setTenants(normalizedTenants);

        const configured = typeof settingData?.value === "string" ? settingData.value.trim() : "";
        setSelectedTenantId(configured);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!selectedTenantId) {
      toast({
        title: "Select tenant",
        description: "Choose the TradeWorkDesk marketing tenant before saving.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/settings/social_marketing_tenant_id`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: selectedTenantId }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save setting");

      toast({ title: "Saved", description: "Superadmin social marketing tenant updated." });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save setting",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-20 animate-pulse bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          Superadmin Social Marketing Tenant
        </CardTitle>
        <CardDescription>
          This tenant is the only data scope used by superadmin social media for TradeWorkDesk marketing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-xl">
          <Label>Marketing tenant</Label>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.company_name}{tenant.contact_email ? ` (${tenant.contact_email})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Set this to the TradeWorkDesk marketing tenant. Superadmin social endpoints require this setting.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PlatformSettingField({ settingKey, label, description, placeholder, helpContent, icon }: {
  settingKey: string;
  label: string;
  description: string;
  placeholder: string;
  helpContent?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/platform/settings/${settingKey}`, { credentials: "include" })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.value) setValue(data.value);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [settingKey]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/settings/${settingKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: value.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Saved", description: `${label} updated successfully` });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast({ title: "Error", description: "Failed to save setting", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-20 animate-pulse bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon ?? <MapPin className="w-4 h-4" />}
          {label}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {helpContent}
        <div className="space-y-1.5">
          <Label htmlFor={settingKey}>{label}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id={settingKey}
                type={showValue ? "text" : "password"}
                placeholder={placeholder}
                value={value}
                onChange={e => setValue(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowValue(!showValue)}
              >
                {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">This key is stored securely and used platform-wide for all tenants.</p>
        </div>
      </CardContent>
    </Card>
  );
}

type HealthNotificationConfig = {
  cooldown_minutes: number;
  notify_email: boolean;
  notify_sms: boolean;
};

function PlatformHealthNotificationSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [simulating, setSimulating] = useState<"degraded" | "down" | "healthy" | null>(null);
  const [config, setConfig] = useState<HealthNotificationConfig>({
    cooldown_minutes: 30,
    notify_email: true,
    notify_sms: true,
  });

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/platform/settings/platform_health_notification_config`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const value = (data?.value || {}) as Partial<HealthNotificationConfig>;
        setConfig({
          cooldown_minutes: Number.isFinite(Number(value.cooldown_minutes))
            ? Math.max(5, Math.min(1440, Number(value.cooldown_minutes)))
            : 30,
          notify_email: typeof value.notify_email === "boolean" ? value.notify_email : true,
          notify_sms: typeof value.notify_sms === "boolean" ? value.notify_sms : true,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const payload: HealthNotificationConfig = {
      cooldown_minutes: Math.max(5, Math.min(1440, Number(config.cooldown_minutes) || 30)),
      notify_email: !!config.notify_email,
      notify_sms: !!config.notify_sms,
    };
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/settings/platform_health_notification_config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: payload }),
      });
      if (!res.ok) throw new Error("Failed to save setting");
      setConfig(payload);
      toast({ title: "Saved", description: "Platform health notification settings updated." });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast({ title: "Error", description: "Failed to save setting", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runSimulation = async (status: "degraded" | "down" | "healthy") => {
    setSimulating(status);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/health/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Simulation failed");

      const title = status === "healthy"
        ? "Recovery simulation sent"
        : status === "down"
        ? "Outage simulation sent"
        : "Degraded simulation sent";
      toast({ title, description: "Monitoring alerts and announcements were triggered using test data." });
    } catch (error) {
      toast({
        title: "Simulation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSimulating(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-20 animate-pulse bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Platform Health Notifications
        </CardTitle>
        <CardDescription>
          Configure alert cooldown and delivery channels for Fly, Vercel and Supabase incident notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="platform-health-cooldown">Alert cooldown (minutes)</Label>
          <Input
            id="platform-health-cooldown"
            type="number"
            min={5}
            max={1440}
            value={config.cooldown_minutes}
            onChange={(e) => setConfig((prev) => ({
              ...prev,
              cooldown_minutes: Math.max(5, Math.min(1440, Number(e.target.value) || 30)),
            }))}
          />
          <p className="text-xs text-muted-foreground">Minimum 5 mins, maximum 24 hours.</p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Email alerts to super admins</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Sends incident emails when platform health degrades or goes down.</p>
          </div>
          <Switch
            checked={config.notify_email}
            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, notify_email: checked }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>SMS alerts to super admins</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Uses SMS Works credentials if configured in this settings page.</p>
          </div>
          <Switch
            checked={config.notify_sms}
            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, notify_sms: checked }))}
          />
        </div>

        <div className="pt-1">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : "Save"}
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Alert simulation</Label>
          <p className="text-xs text-muted-foreground">Trigger test incidents to validate dashboard announcements and superadmin notifications.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={simulating !== null}
              onClick={() => runSimulation("degraded")}
            >
              {simulating === "degraded" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simulate Degraded"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={simulating !== null}
              onClick={() => runSimulation("down")}
            >
              {simulating === "down" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simulate Outage"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={simulating !== null}
              onClick={() => runSimulation("healthy")}
            >
              {simulating === "healthy" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simulate Recovery"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformSettings() {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [indexNowSubmitting, setIndexNowSubmitting] = useState(false);
  const [indexNowSubmitted, setIndexNowSubmitted] = useState(false);
  const [lastSubmittedUrls, setLastSubmittedUrls] = useState<string[]>([]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: "Password updated", description: "Your superuser password has been changed." });
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      toast({
        title: "Password update failed",
        description: err instanceof Error ? err.message : "Could not update password.",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const submitIndexNow = async () => {
    setIndexNowSubmitting(true);
    setIndexNowSubmitted(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/indexnow/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; upstreamStatus?: number; upstreamBody?: string | null; submitted?: number; urls?: string[] };
      if (!res.ok) {
        const statusPart = data.upstreamStatus ? ` (upstream ${data.upstreamStatus})` : "";
        const bodyPart = data.upstreamBody ? `: ${String(data.upstreamBody).slice(0, 160)}` : "";
        throw new Error(`${data.error || "Failed to submit IndexNow"}${statusPart}${bodyPart}`);
      }
      const submittedUrls = Array.isArray(data.urls) ? data.urls : [];
      setLastSubmittedUrls(submittedUrls);
      toast({ title: "IndexNow submitted", description: `${data.submitted ?? submittedUrls.length} URLs submitted` });
      setIndexNowSubmitted(true);
      setTimeout(() => setIndexNowSubmitted(false), 5000);
    } catch (e) {
      toast({ title: "IndexNow failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIndexNowSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure platform-wide API keys and integrations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Superuser Password</CardTitle>
          <CardDescription>Change your own superuser account password without using reset email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="platform-new-password">New password</Label>
              <div className="relative">
                <Input
                  id="platform-new-password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="platform-confirm-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="platform-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
              </Button>
              <p className="text-xs text-muted-foreground">Use a strong password with 8+ characters.</p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="database">
        <TabsList className="mb-6">
          <TabsTrigger value="database" className="gap-2">
            <Database className="w-4 h-4" />
            Database
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="postcodes" className="gap-2">
            <MapPin className="w-4 h-4" />
            Postcodes
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-2">
            <Globe className="w-4 h-4" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2">
            <Bell className="w-4 h-4" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <PlatformSocialMarketingTenantSetting />
          <PlatformFallbackTenantSetting />
          <p className="text-sm text-muted-foreground">
            Credentials used by the daily automated backup job. Backups are stored in Cloudflare R2 and retained for 30 days.
            The GitHub Actions workflow fetches these at runtime — you only need <code className="bg-slate-100 px-1 rounded text-xs">CRON_SECRET</code> and <code className="bg-slate-100 px-1 rounded text-xs">PLATFORM_API_URL</code> as GitHub Secrets.
          </p>
          <PlatformSettingField
            settingKey="backup_supabase_db_url"
            label="Supabase Database URL"
            description="Direct PostgreSQL connection string. Found in Supabase → Settings → Database → Connection String → URI. Use the direct connection (port 5432), not the pooler."
            placeholder="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
            icon={<Database className="w-4 h-4" />}
            helpContent={
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 space-y-1">
                <p className="font-medium">Where to find this:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                  <li>Go to <strong>Supabase dashboard → Settings → Database</strong></li>
                  <li>Scroll to <strong>Connection string</strong> and select the <strong>URI</strong> tab</li>
                  <li>Copy the string — replace <code className="bg-blue-100 px-1 rounded">[YOUR-PASSWORD]</code> with your DB password</li>
                  <li>Use port <strong>5432</strong> (direct), not 6543 (pooler)</li>
                </ol>
              </div>
            }
          />
          <PlatformSettingField
            settingKey="backup_r2_account_id"
            label="Cloudflare Account ID"
            description="Your Cloudflare account ID. Found in the Cloudflare dashboard under your account name (top-right menu)."
            placeholder="a1b2c3d4e5f6..."
            icon={<Database className="w-4 h-4" />}
          />
          <PlatformSettingField
            settingKey="backup_r2_access_key_id"
            label="R2 Access Key ID"
            description="R2 API token Access Key ID. Create a token in Cloudflare → R2 → Manage R2 API Tokens with Object Read & Write permissions."
            placeholder="a1b2c3d4e5f6..."
            icon={<Database className="w-4 h-4" />}
          />
          <PlatformSettingField
            settingKey="backup_r2_secret_access_key"
            label="R2 Secret Access Key"
            description="R2 API token Secret Access Key. Shown only once when the token is created — store it here immediately."
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            icon={<Database className="w-4 h-4" />}
          />
          <PlatformSettingField
            settingKey="backup_r2_bucket_name"
            label="R2 Bucket Name"
            description="Name of the Cloudflare R2 bucket to store backups in (e.g. tradeworkdesk-backups). Create the bucket in Cloudflare → R2 → Create bucket."
            placeholder="tradeworkdesk-backups"
            icon={<Database className="w-4 h-4" />}
          />
          <PlatformSettingField
            settingKey="backup_github_repo"
            label="GitHub Repository"
            description="GitHub repository that contains the backup workflow (e.g. yourname/tradeworkdesk). Used to trigger manual backup runs."
            placeholder="owner/repo"
            icon={<Database className="w-4 h-4" />}
          />
          <PlatformSettingField
            settingKey="backup_github_pat"
            label="GitHub Personal Access Token"
            description="PAT with the 'workflow' scope to trigger workflow_dispatch runs. Create one at GitHub → Settings → Developer settings → Personal access tokens."
            placeholder="ghp_xxxx..."
            icon={<Database className="w-4 h-4" />}
          />
          <div className="pt-2 flex flex-wrap gap-3">
            <BackupTestButton />
            <BackupTriggerButton />
          </div>
          <BackupLogTable />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure platform-level credentials for payment integrations. These credentials are shared across all tenants — individual tenant connections are set up separately in each tenant's payment settings.
          </p>

          <div>
            <h3 className="text-base font-medium mb-3">Stripe</h3>
            <div className="space-y-4">
              <PlatformSettingField
                settingKey="stripe_secret_key"
                label="Stripe Secret Key"
                description="Your Stripe secret API key. Found in Stripe Dashboard → Developers → API keys. Use the live key (sk_live_...) for production."
                placeholder="sk_live_..."
                icon={<CreditCard className="w-4 h-4" />}
                helpContent={
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 space-y-2">
                    <p className="font-medium">How to find your Stripe Secret Key:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-violet-700">
                      <li>Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline font-medium">dashboard.stripe.com/apikeys</a></li>
                      <li>Copy the <strong>Secret key</strong> (starts with <code className="bg-violet-100 px-1 rounded">sk_live_</code>)</li>
                    </ol>
                  </div>
                }
              />
              <PlatformSettingField
                settingKey="stripe_webhook_secret"
                label="Stripe Webhook Secret"
                description="Webhook signing secret for validating Stripe billing events (subscription creation, payment success etc.)."
                placeholder="whsec_..."
                icon={<CreditCard className="w-4 h-4" />}
                helpContent={
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 space-y-2">
                    <p className="font-medium">Platform billing webhook:</p>
                    <p className="text-xs">Add this URL in Stripe Dashboard → Developers → Webhooks:</p>
                    <code className="block bg-violet-100 px-2 py-1 rounded text-xs break-all">{window.location.origin}/api/webhooks/stripe</code>
                    <p className="text-xs mt-1">Subscribe to: <code className="bg-violet-100 px-1 rounded">checkout.session.completed</code>, <code className="bg-violet-100 px-1 rounded">customer.subscription.updated</code>, <code className="bg-violet-100 px-1 rounded">invoice.payment_failed</code></p>
                  </div>
                }
              />
              <PlatformSettingField
                settingKey="stripe_connect_webhook_secret"
                label="Stripe Connect Webhook Secret"
                description="Webhook signing secret for Stripe Connect events (tenant invoice payments via card)."
                placeholder="whsec_..."
                icon={<CreditCard className="w-4 h-4" />}
                helpContent={
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 space-y-2">
                    <p className="font-medium">Connect webhook (for tenant card payments):</p>
                    <p className="text-xs">Add this URL in Stripe Dashboard → Developers → Webhooks:</p>
                    <code className="block bg-violet-100 px-2 py-1 rounded text-xs break-all">{window.location.origin}/api/webhooks/stripe-connect</code>
                    <p className="text-xs mt-1">Subscribe to: <code className="bg-violet-100 px-1 rounded">account.updated</code>, <code className="bg-violet-100 px-1 rounded">checkout.session.completed</code></p>
                  </div>
                }
              />
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">GoCardless</h3>
            <div className="space-y-4">
              <PlatformSettingField
                settingKey="gocardless_client_id"
                label="GoCardless Client ID"
                description="OAuth Client ID from your GoCardless developer app. Used to initiate the Connect OAuth flow for tenants."
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                icon={<CreditCard className="w-4 h-4" />}
                helpContent={
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 space-y-2">
                    <p className="font-medium">How to get your GoCardless credentials:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-orange-700">
                      <li>Go to <a href="https://developer.gocardless.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">developer.gocardless.com</a> and create a partner app</li>
                      <li>Set the redirect URI to <code className="bg-orange-100 px-1 rounded">{window.location.origin}/api/admin/gocardless/callback</code></li>
                      <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from your app settings</li>
                    </ol>
                  </div>
                }
              />
              <PlatformSettingField
                settingKey="gocardless_client_secret"
                label="GoCardless Client Secret"
                description="OAuth Client Secret from your GoCardless developer app."
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                icon={<CreditCard className="w-4 h-4" />}
              />
              <PlatformSettingField
                settingKey="gocardless_webhook_secret"
                label="GoCardless Webhook Secret"
                description="Webhook signing secret for validating GoCardless event notifications. Found in your GoCardless developer app under Webhooks."
                placeholder="whsec_xxxxxxxxxxxxxxxxxxxx"
                icon={<CreditCard className="w-4 h-4" />}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="postcodes" className="space-y-4">
          <PlatformSettingField
            settingKey="ideal_postcodes_api_key"
            label="Ideal Postcodes API Key"
            description="UK address lookup service — enter a postcode and get a list of addresses with precise coordinates accurate to ~1 metre. Used for property address lookup across all tenants."
            placeholder="ak_xxxxxxxxxxxxxxxxxxxx"
            helpContent={
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 space-y-2">
                <p className="font-medium">How to get your Ideal Postcodes API key:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                  <li>Go to <a href="https://ideal-postcodes.co.uk" target="_blank" rel="noopener noreferrer" className="underline font-medium">ideal-postcodes.co.uk</a> and create a free account</li>
                  <li>Navigate to your dashboard and find your <strong>API key</strong> (starts with <code className="bg-blue-100 px-1 rounded">ak_</code>)</li>
                  <li>The free tier includes your first lookups — after that it's ~£2.50 per 1,000 lookups</li>
                  <li>Paste your API key below</li>
                </ol>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="sms" className="space-y-4">
          <PlatformSettingField
            settingKey="sms_works_api_key"
            label="SMS Works Key"
            description="Your SMS Works API Key (the 'Key' UUID shown under Account → API Key)."
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            icon={<MessageSquare className="w-4 h-4" />}
            helpContent={
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-2">
                <p className="font-medium">How to set up SMS Works:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-green-700">
                  <li>Go to <a href="https://thesmsworks.co.uk" target="_blank" rel="noopener noreferrer" className="underline font-medium">thesmsworks.co.uk</a> and create an account</li>
                  <li>Sign in and go to <strong>Account → API Key</strong></li>
                  <li>Copy the <strong>Key</strong> UUID and paste it here</li>
                  <li>Copy the <strong>Secret</strong> and paste it in the field below</li>
                </ol>
              </div>
            }
          />
          <PlatformSettingField
            settingKey="sms_works_secret"
            label="SMS Works Secret"
            description="Your SMS Works API Secret (the 'Secret' value shown under Account → API Key)."
            placeholder="fe3aed49..."
            icon={<MessageSquare className="w-4 h-4" />}
          />
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                IndexNow - Search Engine Indexing
              </CardTitle>
              <CardDescription>
                Auto-submit runs on production startup/deploy. Use this for a manual re-submit of marketing and blog URLs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={submitIndexNow} disabled={indexNowSubmitting || indexNowSubmitted}>
                {indexNowSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                ) : indexNowSubmitted ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />Submitted!</>
                ) : (
                  <><Globe className="w-4 h-4 mr-2" />Manual Re-submit Marketing URLs</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">Uses the platform IndexNow key and submits URLs for www.tradeworkdesk.co.uk.</p>

              {lastSubmittedUrls.length > 0 && (
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">Last submitted URLs ({lastSubmittedUrls.length})</p>
                  <ul className="max-h-56 overflow-y-auto space-y-1 text-xs">
                    {lastSubmittedUrls.map((url) => (
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
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <PlatformHealthNotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackupTestButton() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ db: { ok: boolean; error: string }; r2: { ok: boolean; error: string } } | null>(null);
  const { toast } = useToast();

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/backup-test`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 422) {
        const body = await res.json();
        toast({ title: "Missing credentials", description: `Set these first: ${body.missing?.join(", ")}`, variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      toast({ title: "Test failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
        {testing ? "Testing…" : "Test Backup Config"}
      </Button>
      {result && (
        <div className="rounded-lg border p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {result.db.ok
              ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <span className={result.db.ok ? "text-green-700" : "text-red-600"}>
              Database: {result.db.ok ? "Connected successfully" : result.db.error || "Failed"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {result.r2.ok
              ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <span className={result.r2.ok ? "text-green-700" : "text-red-600"}>
              Cloudflare R2: {result.r2.ok ? "Bucket accessible" : result.r2.error || "Failed"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function BackupTriggerButton() {
  const [triggering, setTriggering] = useState(false);
  const { toast } = useToast();

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/backup-trigger`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 422) {
        const body = await res.json();
        toast({ title: "Not configured", description: body.error, variant: "destructive" });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const result = await res.json() as { ok: boolean; filename?: string; sizeBytes?: number };
      const desc = result.filename
        ? `${result.filename} (${result.sizeBytes ? (result.sizeBytes / 1024).toFixed(1) + " KB" : "done"})`
        : "Backup complete.";
      toast({ title: "Backup complete", description: desc });
    } catch (e) {
      toast({ title: "Failed to trigger backup", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleTrigger} disabled={triggering} className="gap-2">
      {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
      {triggering ? "Triggering…" : "Run Backup Now"}
    </Button>
  );
}

type BackupFile = { name: string; size: number; lastModified: string; downloadUrl?: string };

function formatBackupName(name: string): string {
  const m = name.match(/backup_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return name;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]} UTC`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BackupLogTable() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<BackupFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/platform/backup-logs`, {
        credentials: "include",
      });
      if (res.status === 422) {
        setError("R2 credentials not yet configured.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFiles((data as { files: BackupFile[] }).files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load backup log");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          Backup History
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1 h-7 text-xs">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {files === null ? "Load" : "Refresh"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {files !== null && files.length === 0 && (
        <p className="text-sm text-muted-foreground">No backups found yet.</p>
      )}
      {files !== null && files.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date / Time (UTC)</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Size</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.name} className="border-t">
                  <td className="px-3 py-2">{formatBackupName(f.name)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatFileSize(f.size)}</td>
                  <td className="px-3 py-2 text-right">
                    {f.downloadUrl && (
                      <a href={f.downloadUrl} download={f.name} title="Download backup" className="inline-flex items-center text-muted-foreground hover:text-foreground">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
