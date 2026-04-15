import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings2, MapPin, Loader2, Check, Eye, EyeOff } from "lucide-react";

function PlatformSettingField({ settingKey, label, description, placeholder, helpContent }: {
  settingKey: string;
  label: string;
  description: string;
  placeholder: string;
  helpContent?: React.ReactNode;
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
          <MapPin className="w-4 h-4" />
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
    </div>
  );
}
