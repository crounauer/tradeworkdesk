import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useCompanySettings, useUploadCompanyLogo } from "@/hooks/use-company-settings";
import type { CompanySettings } from "@/hooks/use-company-settings";
import { useCompanyType, useUpgradeToCompany, useDowngradeToSoleTrader } from "@/hooks/use-company-type";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Building2, Phone, Mail, Globe, Shield, FileText, ExternalLink,
  Upload, Trash2, Save, Loader2, MapPin, BadgeCheck, PoundSterling,
  ArrowUpCircle, ArrowDownCircle, Users, AlertTriangle, CreditCard,
  Plus, X, Check, Clock, Star, Package, Pencil, CalendarSync, Wrench,
  Search
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AccountingIntegrations } from "@/components/accounting-integrations";

type FormValues = Omit<CompanySettings, "id" | "singleton_id" | "logo_url" | "logo_storage_path" | "created_at" | "updated_at">;

export default function AdminCompanySettings() {
  const { data: settings, isLoading } = useCompanySettings();
  const uploadLogo = useUploadCompanyLogo();
  const { toast } = useToast();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const { companyType, isSoleTrader, isCompany, hasTeamManagement, activeUserCount, isLoading: companyTypeLoading, isError: companyTypeError } = useCompanyType();
  const upgradeToCompany = useUpgradeToCompany();
  const downgradeToSoleTrader = useDowngradeToSoleTrader();
  const isAdmin = profile?.role === "admin";

  const { register, handleSubmit, reset, getValues, formState: { isDirty, dirtyFields } } = useForm<FormValues>();
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const formRef = useRef<HTMLFormElement | null>(null);
  const settingsLoadedRef = useRef(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!settings || settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    reset({
      name: settings.name ?? "",
      trading_name: settings.trading_name ?? "",
      address_line1: settings.address_line1 ?? "",
      address_line2: settings.address_line2 ?? "",
      city: settings.city ?? "",
      county: settings.county ?? "",
      postcode: settings.postcode ?? "",
      country: settings.country ?? "United Kingdom",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      website: settings.website ?? "",
      gas_safe_number: settings.gas_safe_number ?? "",
      oftec_number: settings.oftec_number ?? "",
      vat_number: settings.vat_number ?? "",
      company_number: settings.company_number ?? "",
      default_vat_rate: String(Number(settings.default_vat_rate ?? 20)),
      default_payment_terms_days: String(Number(settings.default_payment_terms_days ?? 30)),
      currency: settings.currency ?? "GBP",
      rates_url: settings.rates_url ?? "",
      trading_terms_url: settings.trading_terms_url ?? "",
      job_number_prefix: settings.job_number_prefix ?? "",
      google_calendar_enabled: settings.google_calendar_enabled ?? false,
      google_client_id: settings.google_client_id ?? "",
      google_client_secret: settings.google_client_secret ?? "",
    });
    if (settings.logo_url) setLogoPreview(settings.logo_url);
  }, [settings, reset]);

  const numericFields = new Set(["default_vat_rate", "default_payment_terms_days"]);
  const booleanFields = new Set(["google_calendar_enabled"]);

  const saveToServer = useCallback(async (values: Record<string, unknown>) => {
    const res = await fetch("/api/admin/company-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to save settings");
    }
  }, []);

  const doSave = useCallback(async (showToast = false) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    const values = getValues();
    const clean: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(values)) {
      if (booleanFields.has(k)) {
        clean[k] = Boolean(v);
      } else if (numericFields.has(k)) {
        clean[k] = v != null && v !== "" ? Number(v) : null;
      } else {
        clean[k] = (v as string)?.trim() || null;
      }
    }
    try {
      setAutoSaveStatus("saving");
      await saveToServer(clean);
      if (!isMountedRef.current) return;
      setAutoSaveStatus("saved");
      if (showToast) {
        toast({ title: "Settings saved", description: "Company information has been updated." });
      }
      setTimeout(() => { if (isMountedRef.current) setAutoSaveStatus("idle"); }, 2000);
    } catch (err) {
      if (!isMountedRef.current) return;
      setAutoSaveStatus("idle");
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      isSavingRef.current = false;
    }
  }, [getValues, saveToServer, toast]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => { doSave(); }, 1500);
    };
    form.addEventListener("input", handler);
    form.addEventListener("change", handler);
    return () => {
      form.removeEventListener("input", handler);
      form.removeEventListener("change", handler);
    };
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  const onSubmit = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await doSave(true);
  };

  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB.", variant: "destructive" });
      return;
    }
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
    try {
      await uploadLogo.mutateAsync(file);
      toast({ title: "Logo uploaded", description: "Company logo has been updated." });
    } catch (err) {
      setLogoPreview(settings?.logo_url ?? null);
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const res = await fetch("/api/admin/company-settings/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove logo");
      setLogoPreview(null);
      toast({ title: "Logo removed" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Company Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your company information. This appears on all generated PDFs and documents.
        </p>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company Logo
          </CardTitle>
          <CardDescription>
            Upload your company logo. Recommended: PNG with transparent background, at least 300×100px.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-slate-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleLogoFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {logoPreview ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={logoPreview}
                  alt="Company logo"
                  className="max-h-24 max-w-xs object-contain rounded"
                />
                <p className="text-sm text-muted-foreground">Click or drag to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-8 h-8" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs">PNG, JPG, SVG up to 5MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoFile(file);
              e.target.value = "";
            }}
          />
          {logoPreview && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleRemoveLogo}
              disabled={uploadLogo.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Logo
            </Button>
          )}
          {uploadLogo.isPending && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
            </p>
          )}
        </CardContent>
      </Card>

      {isAdmin && !companyTypeLoading && !companyTypeError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Business Mode
            </CardTitle>
            <CardDescription>
              {isSoleTrader
                ? "You're currently operating as a sole trader. Upgrade to company mode to unlock team features."
                : "You're operating as a company with team features enabled."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSoleTrader ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}>
                {isSoleTrader ? <Building2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-semibold text-sm">{isSoleTrader ? "Sole Trader" : "Company"}</p>
                <p className="text-xs text-muted-foreground">
                  {isSoleTrader
                    ? "Single user mode — jobs auto-assign to you"
                    : `Team mode — ${activeUserCount} active user${activeUserCount !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {isSoleTrader && (
              <>
                {hasTeamManagement ? (
                  <>
                    {!showUpgradeConfirm ? (
                      <Button onClick={() => setShowUpgradeConfirm(true)} className="gap-2">
                        <ArrowUpCircle className="w-4 h-4" />
                        Upgrade to Company
                      </Button>
                    ) : (
                      <div className="border border-primary/20 rounded-lg p-4 space-y-3 bg-primary/5">
                        <h4 className="font-semibold text-sm">Confirm Upgrade to Company Mode</h4>
                        <ul className="text-sm text-muted-foreground space-y-1.5">
                          <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">+</span> Team management and invite codes become available</li>
                          <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">+</span> Job assignment dropdown appears for assigning technicians</li>
                          <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">+</span> You can still be assigned jobs as the admin</li>
                        </ul>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => upgradeToCompany.mutate(undefined, { onSuccess: () => setShowUpgradeConfirm(false) })}
                            disabled={upgradeToCompany.isPending}
                          >
                            {upgradeToCompany.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Upgrading...</> : "Confirm Upgrade"}
                          </Button>
                          <Button variant="outline" onClick={() => setShowUpgradeConfirm(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800">Plan upgrade required</p>
                      <p className="text-amber-700 mt-1">Your current plan doesn't include team management. Upgrade your plan to unlock company mode.</p>
                      <Link href="/billing">
                        <Button size="sm" variant="outline" className="mt-2 gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" /> View Plans
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}

            {isCompany && (
              <>
                {!showDowngradeConfirm ? (
                  <Button variant="outline" onClick={() => setShowDowngradeConfirm(true)} className="gap-2 text-muted-foreground">
                    <ArrowDownCircle className="w-4 h-4" />
                    Switch to Sole Trader
                  </Button>
                ) : (
                  <div className="border border-amber-200 rounded-lg p-4 space-y-3 bg-amber-50">
                    <h4 className="font-semibold text-sm text-amber-800">Switch to Sole Trader Mode</h4>
                    {activeUserCount > 1 ? (
                      <div className="flex items-start gap-2 text-sm text-amber-700">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>You must remove all other team members before switching to sole trader mode. You currently have {activeUserCount - 1} other user{activeUserCount - 1 !== 1 ? "s" : ""}.</p>
                      </div>
                    ) : (
                      <>
                        <ul className="text-sm text-muted-foreground space-y-1.5">
                          <li className="flex items-start gap-2"><span className="text-amber-600 font-bold mt-0.5">-</span> Team management and invite codes will be deactivated</li>
                          <li className="flex items-start gap-2"><span className="text-amber-600 font-bold mt-0.5">-</span> Active invite codes will be revoked</li>
                          <li className="flex items-start gap-2"><span className="text-amber-600 font-bold mt-0.5">-</span> Jobs will auto-assign to you</li>
                        </ul>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            onClick={() => downgradeToSoleTrader.mutate(undefined, { onSuccess: () => setShowDowngradeConfirm(false) })}
                            disabled={downgradeToSoleTrader.isPending}
                          >
                            {downgradeToSoleTrader.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Switching...</> : "Confirm Switch"}
                          </Button>
                          <Button variant="outline" onClick={() => setShowDowngradeConfirm(false)}>Cancel</Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main form */}
      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Business Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">Company / Trading Name *</Label>
              <Input id="name" placeholder="e.g. Acme Heating Ltd" {...register("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trading_name">Alternative Trading Name</Label>
              <Input id="trading_name" placeholder="e.g. Acme Boiler Services" {...register("trading_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_number">Company Registration Number</Label>
              <Input id="company_number" placeholder="e.g. 12345678" {...register("company_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vat_number">VAT Number</Label>
              <Input id="vat_number" placeholder="e.g. GB123456789" {...register("vat_number")} />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Business Address
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input id="address_line1" placeholder="e.g. 10 High Street" {...register("address_line1")} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input id="address_line2" placeholder="e.g. Unit 5, Industrial Estate" {...register("address_line2")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Town / City</Label>
              <Input id="city" placeholder="e.g. Manchester" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="county">County</Label>
              <Input id="county" placeholder="e.g. Greater Manchester" {...register("county")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" placeholder="e.g. M1 1AA" {...register("postcode")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="United Kingdom" {...register("country")} />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone
              </Label>
              <Input id="phone" type="tel" placeholder="e.g. 0161 123 4567" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </Label>
              <Input id="email" type="email" placeholder="e.g. info@example.com" {...register("email")} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="website" className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Website
              </Label>
              <Input id="website" type="url" placeholder="e.g. https://www.example.com" {...register("website")} />
            </div>
          </CardContent>
        </Card>

        {/* Accounting Integrations */}
        <AccountingIntegrations />

        {/* Pricing & Invoicing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PoundSterling className="w-4 h-4" />
              Pricing & Invoicing
            </CardTitle>
            <CardDescription>
              Default rates used for invoice calculations. These can be overridden per job.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="default_vat_rate">Default VAT Rate (%)</Label>
              <Input id="default_vat_rate" type="number" step="0.01" min="0" max="100" placeholder="e.g. 20.00" {...register("default_vat_rate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default_payment_terms_days">Payment Terms (days)</Label>
              <Input id="default_payment_terms_days" type="number" step="1" min="0" placeholder="e.g. 30" {...register("default_payment_terms_days")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("currency")}>
                <option value="GBP">GBP - British Pound</option>
                <option value="EUR">EUR - Euro</option>
                <option value="USD">USD - US Dollar</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="job_number_prefix">Job Number Prefix</Label>
              <Input
                id="job_number_prefix"
                placeholder="e.g. NNE"
                maxLength={10}
                className="uppercase"
                {...register("job_number_prefix")}
              />
              <p className="text-xs text-muted-foreground">
                Set a prefix for your job numbers. For example, entering <span className="font-mono font-medium">NNE</span> will number jobs as <span className="font-mono font-medium">NNE0001</span>, <span className="font-mono font-medium">NNE0002</span>, etc. Leave blank to use the default <span className="font-mono">JOB-0001</span> format.
              </p>
            </div>
          </CardContent>
        </Card>

        <CalloutRatesSection />
        <ProductCatalogueSection />
        <ServiceCatalogueSection />

        {/* Registrations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" />
              Trade Registrations
            </CardTitle>
            <CardDescription>
              Registration numbers appear on relevant certificates and inspection documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="gas_safe_number" className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-yellow-600" />
                Gas Safe Registration Number
              </Label>
              <Input id="gas_safe_number" placeholder="e.g. 123456" {...register("gas_safe_number")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oftec_number" className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                OFTEC Registration Number
              </Label>
              <Input id="oftec_number" placeholder="e.g. C12345" {...register("oftec_number")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Customer Documents
            </CardTitle>
            <CardDescription>
              Links to your rates sheet and trading terms. When set, these are included in all customer-facing emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rates_url">Rates URL</Label>
              <Input id="rates_url" type="url" placeholder="e.g. https://www.example.com/rates" {...register("rates_url")} />
              <p className="text-xs text-muted-foreground">Link to your published rates / price list.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trading_terms_url">Trading Terms URL</Label>
              <Input id="trading_terms_url" type="url" placeholder="e.g. https://www.example.com/terms" {...register("trading_terms_url")} />
              <p className="text-xs text-muted-foreground">Link to your terms and conditions.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarSync className="w-4 h-4" />
              Google Calendar Sync
            </CardTitle>
            <CardDescription>
              Sync scheduled jobs to Google Calendar automatically. Enter your Google OAuth credentials to enable this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 space-y-2">
              <p className="font-medium">How to get your Google Calendar credentials:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
                <li>Create a project (or select an existing one)</li>
                <li>Enable the <strong>Google Calendar API</strong> under "APIs &amp; Services"</li>
                <li>Go to <strong>Credentials</strong> &rarr; <strong>Create Credentials</strong> &rarr; <strong>OAuth 2.0 Client ID</strong></li>
                <li>Set the application type to <strong>Web application</strong></li>
                <li>Add <code className="bg-blue-100 px-1 rounded">https://www.tradeworkdesk.co.uk/api/google/callback</code> as an authorised redirect URI</li>
                <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields below</li>
              </ol>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="google_calendar_enabled"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register("google_calendar_enabled")}
              />
              <Label htmlFor="google_calendar_enabled" className="cursor-pointer">
                Enable Google Calendar sync
              </Label>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="google_client_id">Google Client ID</Label>
                <Input id="google_client_id" placeholder="e.g. 123456789.apps.googleusercontent.com" {...register("google_client_id")} />
                <p className="text-xs text-muted-foreground">From your Google Cloud Console OAuth 2.0 credentials.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="google_client_secret">Google Client Secret</Label>
                <Input id="google_client_secret" type="password" placeholder="Enter client secret" {...register("google_client_secret")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public Directory Listing */}
        <PublicDirectoryCard />

        <div className="flex items-center justify-end gap-3 pt-2">
          {autoSaveStatus === "saving" && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
            </span>
          )}
          {autoSaveStatus === "saved" && !isDirty && (
            <span className="text-sm text-emerald-600 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {isDirty && (
            <Button type="button" variant="outline" onClick={() => reset()}>
              Discard Changes
            </Button>
          )}
          <Button type="submit" disabled={autoSaveStatus === "saving"}>
            {autoSaveStatus === "saving" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Settings</>
            )}
          </Button>
        </div>
      </form>

    </div>
  );
}

type CalloutRate = {
  id: string;
  name: string;
  amount: number;
  hourly_rate: number | null;
  day_type: string;
  time_from: string | null;
  time_to: string | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

const DAY_TYPE_LABELS: Record<string, string> = {
  weekday: "Weekday",
  weekend: "Weekend",
  after_hours: "After Hours",
  any: "Any Day",
};

function CalloutRatesSection() {
  const { toast } = useToast();
  const [rates, setRates] = useState<CalloutRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", hourly_rate: "", day_type: "weekday", time_from: "", time_to: "", is_default: false });
  const [submitting, setSubmitting] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`);
      setRates(Array.isArray(data) ? data as CalloutRate[] : []);
    } catch { setRates([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const resetForm = () => {
    setForm({ name: "", amount: "", hourly_rate: "", day_type: "weekday", time_from: "", time_to: "", is_default: false });
    setShowAdd(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        amount: Number(form.amount),
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        day_type: form.day_type,
        time_from: form.time_from || null,
        time_to: form.time_to || null,
        is_default: form.is_default,
      };
      if (editingId) {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Updated", description: "Callout rate updated" });
      } else {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Added", description: "Callout rate added" });
      }
      resetForm();
      fetchRates();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleEdit = (r: CalloutRate) => {
    setForm({
      name: r.name,
      amount: String(r.amount),
      hourly_rate: r.hourly_rate != null ? String(r.hourly_rate) : "",
      day_type: r.day_type,
      time_from: r.time_from || "",
      time_to: r.time_to || "",
      is_default: r.is_default,
    });
    setEditingId(r.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Callout rate removed" });
      fetchRates();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Callout Rate Tiers
            </CardTitle>
            <CardDescription>
              Different callout fees for weekdays, weekends, and after-hours. The system auto-selects based on the first time entry.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => { if (showAdd) resetForm(); else setShowAdd(true); }}>
            {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Rate</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekday Standard" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Callout Amount *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="65.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hourly Rate (after 1st hour)</Label>
                <Input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 45.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Day Type</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.day_type} onChange={e => setForm(f => ({ ...f, day_type: e.target.value }))}>
                  <option value="weekday">Weekday</option>
                  <option value="weekend">Weekend</option>
                  <option value="after_hours">After Hours</option>
                  <option value="any">Any Day</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From Time (optional)</Label>
                <Input type="time" value={form.time_from} onChange={e => setForm(f => ({ ...f, time_from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Time (optional)</Label>
                <Input type="time" value={form.time_to} onChange={e => setForm(f => ({ ...f, time_to: e.target.value }))} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded" />
                  <Star className="w-3.5 h-3.5 text-amber-500" /> Default rate
                </label>
              </div>
            </div>
            <Button size="sm" onClick={handleSave} disabled={submitting || !form.name.trim() || !form.amount}>
              <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No callout rates configured. The default call-out fee from Pricing above will be used.</p>
        ) : (
          <div className="space-y-2">
            {rates.map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  {r.is_default && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                  <div>
                    <span className="font-medium text-sm">{r.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {DAY_TYPE_LABELS[r.day_type] || r.day_type}
                      {r.time_from && r.time_to && ` (${r.time_from.substring(0,5)}-${r.time_to.substring(0,5)})`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-semibold text-sm">&pound;{Number(r.amount).toFixed(2)}</span>
                    {r.hourly_rate != null && (
                      <span className="text-xs text-muted-foreground ml-1.5">(£{Number(r.hourly_rate).toFixed(2)}/hr)</span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ProductItem = {
  id: string;
  name: string;
  default_price: number | null;
  is_active: boolean;
};

function ProductCatalogueSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", default_price: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/products`);
      setProducts(Array.isArray(data) ? data as ProductItem[] : []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetForm = () => { setForm({ name: "", default_price: "" }); setShowAdd(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const body = { name: form.name.trim(), default_price: form.default_price ? Number(form.default_price) : null };
      if (editingId) {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/products/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Updated", description: "Product updated" });
      } else {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/products`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Added", description: "Product added to catalogue" });
      }
      resetForm();
      fetchProducts();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleEdit = (p: ProductItem) => {
    setForm({ name: p.name, default_price: p.default_price != null ? String(p.default_price) : "" });
    setEditingId(p.id);
    setShowAdd(true);
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/products/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active }),
      });
      toast({ title: is_active ? "Reactivated" : "Deactivated", description: `Product ${is_active ? "reactivated" : "deactivated"}` });
      fetchProducts();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/products/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Product removed" });
      fetchProducts();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Product Catalogue
            </CardTitle>
            <CardDescription>
              Pre-defined parts and materials. Technicians can select these when adding parts to a job.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => { if (showAdd) resetForm(); else setShowAdd(true); }}>
            {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Product</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Product Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Grundfos UPS2 Pump" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default Price (optional)</Label>
                <Input type="number" step="0.01" min="0" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <Button size="sm" onClick={handleSave} disabled={submitting || !form.name.trim()}>
              <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products in catalogue. Add common parts and materials for quick selection on jobs.</p>
        ) : (
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${!p.is_active ? "opacity-50" : ""}`}>
                <div>
                  <span className="font-medium text-sm">{p.name}</span>
                  {!p.is_active && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                </div>
                <div className="flex items-center gap-3">
                  {p.default_price != null && <span className="text-sm text-muted-foreground">&pound;{Number(p.default_price).toFixed(2)}</span>}
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={p.is_active ? "text-amber-600 hover:text-amber-800" : "text-green-600 hover:text-green-800"}
                    onClick={() => handleToggleActive(p.id, !p.is_active)}
                    title={p.is_active ? "Deactivate" : "Reactivate"}
                  >
                    {p.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ServiceItem = {
  id: string;
  name: string;
  default_price: number | null;
  is_active: boolean;
};

function ServiceCatalogueSection() {
  const { toast } = useToast();
  const { hasAddon } = usePlanFeatures();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", default_price: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue`);
      setServices(Array.isArray(data) ? data as ServiceItem[] : []);
    } catch { setServices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (hasAddon("service_catalogue")) fetchServices(); else setLoading(false); }, [fetchServices, hasAddon]);

  const resetForm = () => { setForm({ name: "", default_price: "" }); setShowAdd(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const body = { name: form.name.trim(), default_price: form.default_price ? Number(form.default_price) : null };
      if (editingId) {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Updated", description: "Service updated" });
      } else {
        await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Added", description: "Service added to catalogue" });
      }
      resetForm();
      fetchServices();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleEdit = (s: ServiceItem) => {
    setForm({ name: s.name, default_price: s.default_price != null ? String(s.default_price) : "" });
    setEditingId(s.id);
    setShowAdd(true);
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active }),
      });
      toast({ title: is_active ? "Reactivated" : "Deactivated", description: `Service ${is_active ? "reactivated" : "deactivated"}` });
      fetchServices();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await customFetch(`${import.meta.env.BASE_URL}api/admin/service-catalogue/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Service removed" });
      fetchServices();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Service Catalogue
            </CardTitle>
            <CardDescription>
              Pre-defined services such as boiler services and gas safety checks with fixed prices. Technicians can select these when recording services on a job.
            </CardDescription>
          </div>
          {hasAddon("service_catalogue") && (
            <Button size="sm" variant="outline" onClick={() => { if (showAdd) resetForm(); else setShowAdd(true); }}>
              {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Service</>}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasAddon("service_catalogue") ? (
          <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-800">
            <span className="font-medium">Service Catalogue add-on required.</span>{" "}
            <a href="/settings/billing" className="underline hover:no-underline">Upgrade to unlock</a> this feature and pre-define recurring services with fixed prices.
          </div>
        ) : (
          <>
            {showAdd && (
              <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Service Name *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Annual Boiler Service" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Default Price (optional)</Label>
                    <Input type="number" step="0.01" min="0" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                <Button size="sm" onClick={handleSave} disabled={submitting || !form.name.trim()}>
                  <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : editingId ? "Update" : "Add"}
                </Button>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services in catalogue. Add recurring services for quick selection on jobs.</p>
            ) : (
              <div className="space-y-2">
                {services.map(s => (
                  <div key={s.id} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${!s.is_active ? "opacity-50" : ""}`}>
                    <div>
                      <span className="font-medium text-sm">{s.name}</span>
                      {!s.is_active && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {s.default_price != null && <span className="text-sm text-muted-foreground">&pound;{Number(s.default_price).toFixed(2)}</span>}
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={s.is_active ? "text-amber-600 hover:text-amber-800" : "text-green-600 hover:text-green-800"}
                        onClick={() => handleToggleActive(s.id, !s.is_active)}
                        title={s.is_active ? "Deactivate" : "Reactivate"}
                      >
                        {s.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Public Directory Listing Card (standalone, separate API call)
// ---------------------------------------------------------------------------
function PublicDirectoryCard() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [isListed, setIsListed] = useState(false);
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [tradeTypes, setTradeTypes] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    customFetch("/api/admin/directory-listing")
      .then((data: Record<string, unknown>) => {
        setIsListed(!!data.is_publicly_listed);
        setSlug((data.listing_slug as string) ?? "");
        setDescription((data.public_description as string) ?? "");
        setTradeTypes((data.trade_types as string) ?? "");
        setServiceArea((data.service_area as string) ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleSlugChange = (val: string) => {
    setSlug(val);
    setSlugStatus("idle");
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (!val.trim()) return;
    slugTimerRef.current = setTimeout(() => {
      setSlugStatus("checking");
      customFetch(`/api/admin/directory-check-slug/${encodeURIComponent(val.trim())}`)
        .then((d: Record<string, unknown>) => setSlugStatus(d.available ? "available" : "taken"))
        .catch(() => setSlugStatus("idle"));
    }, 500);
  };

  const handleSave = async () => {
    if (!slug.trim()) { toast({ title: "URL required", description: "Enter a URL slug before saving.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await customFetch("/api/admin/directory-listing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_publicly_listed: isListed, listing_slug: slug, public_description: description, trade_types: tradeTypes, service_area: serviceArea }),
      });
      toast({ title: "Directory listing saved", description: isListed ? "Your business is now publicly listed." : "Listing saved (not publicly visible)." });
      setSlugStatus("idle");
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  const normalisedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const previewUrl = normalisedSlug ? `tradeworkdesk.co.uk/find/${normalisedSlug}` : "tradeworkdesk.co.uk/find/your-slug";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="w-4 h-4" />
          Public Directory Listing
        </CardTitle>
        <CardDescription>
          Opt in to appear on the <a href="/find" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">/find directory</a> so potential customers can discover your business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Show my business in the public directory</p>
            <p className="text-xs text-muted-foreground mt-0.5">Free — anyone can find and contact you</p>
          </div>
          <Switch checked={isListed} onCheckedChange={setIsListed} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="listing_slug">Your public URL</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">tradeworkdesk.co.uk/find/</span>
            <div className="relative flex-1">
              <Input
                id="listing_slug"
                placeholder="e.g. john-smith-plumbing"
                value={slug}
                onChange={e => handleSlugChange(e.target.value)}
                className={slugStatus === "taken" ? "border-red-400" : slugStatus === "available" ? "border-green-400" : ""}
              />
            </div>
          </div>
          {slugStatus === "checking" && <p className="text-xs text-muted-foreground">Checking availability…</p>}
          {slugStatus === "taken" && <p className="text-xs text-red-500">This URL is already taken. Try another.</p>}
          {slugStatus === "available" && <p className="text-xs text-green-600">Available!</p>}
          {normalisedSlug && <p className="text-xs text-muted-foreground">Preview: {previewUrl}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="public_description">About your business</Label>
          <Textarea
            id="public_description"
            placeholder="Briefly describe what you do, your experience, and what makes you different…"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Shown on your profile page. Keep it under 250 characters for best results.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trade_types">Services offered</Label>
          <Input
            id="trade_types"
            placeholder="e.g. Boiler Service, Gas Engineer, Heat Pump Installation"
            value={tradeTypes}
            onChange={e => setTradeTypes(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Comma-separated list of your services. Used for search and filtering.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="service_area">Service area</Label>
          <Input
            id="service_area"
            placeholder="e.g. Edinburgh & Lothians, or Within 20 miles of EH1"
            value={serviceArea}
            onChange={e => setServiceArea(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Shown on your profile so customers know if you cover their area.</p>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Save className="w-4 h-4 mr-2" /> Save Listing</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
