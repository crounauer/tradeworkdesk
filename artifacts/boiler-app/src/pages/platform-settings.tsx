import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings2, MapPin, MessageSquare, Loader2, Check, Eye, EyeOff, CreditCard, Database, FlaskConical, CheckCircle2, XCircle } from "lucide-react";

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

export default function PlatformSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure platform-wide API keys and integrations.</p>
      </div>

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

      <div className="mt-2">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5" />
          SMS Messaging
        </h2>
        <div className="space-y-4">
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
        </div>
      </div>

      <div className="mt-2">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5" />
          Payment Providers
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure platform-level credentials for payment integrations. These credentials are shared across all tenants — individual tenant connections are set up separately in each tenant's payment settings.
        </p>
        <div className="space-y-6">

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

        </div>
      </div>

      <div className="mt-2">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Database className="w-5 h-5" />
          Database Backup
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Credentials used by the daily automated backup job. Backups are stored in Cloudflare R2 and retained for 30 days.
          The GitHub Actions workflow fetches these at runtime — you only need <code className="bg-slate-100 px-1 rounded text-xs">CRON_SECRET</code> and <code className="bg-slate-100 px-1 rounded text-xs">PLATFORM_API_URL</code> as GitHub Secrets.
        </p>
        <div className="space-y-4">
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
          <BackupTestButton />
        </div>
      </div>
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
    <div className="pt-2 space-y-3">
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
