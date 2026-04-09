import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useCompanySettings, useUpdateCompanySettings, useUploadCompanyLogo } from "@/hooks/use-company-settings";
import type { CompanySettings } from "@/hooks/use-company-settings";
import { useCompanyType, useUpgradeToCompany, useDowngradeToSoleTrader } from "@/hooks/use-company-type";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Building2, Phone, Mail, Globe, Shield, FileText, ExternalLink,
  Upload, Trash2, Save, Loader2, MapPin, BadgeCheck, PoundSterling,
  ArrowUpCircle, ArrowDownCircle, Users, AlertTriangle, CreditCard,
  Plus, X, Check, Clock, Star, Package, Pencil
} from "lucide-react";
import { AccountingIntegrations } from "@/components/accounting-integrations";

type FormValues = Omit<CompanySettings, "id" | "singleton_id" | "logo_url" | "logo_storage_path" | "created_at" | "updated_at">;

export default function AdminCompanySettings() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
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

  const { register, handleSubmit, reset, watch, getValues, formState: { isDirty, dirtyFields } } = useForm<FormValues>();
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (settings) {
      if (!initialLoadRef.current && Object.keys(dirtyRef.current).length > 0) return;
      initialLoadRef.current = false;
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
        default_hourly_rate: String(settings.default_hourly_rate ?? 0),
        call_out_fee: String(settings.call_out_fee ?? 0),
        default_vat_rate: String(settings.default_vat_rate ?? 20),
        default_payment_terms_days: String(settings.default_payment_terms_days ?? 30),
        currency: settings.currency ?? "GBP",
        rates_url: settings.rates_url ?? "",
        trading_terms_url: settings.trading_terms_url ?? "",
      });
      if (settings.logo_url) setLogoPreview(settings.logo_url);
    }
  }, [settings, reset]);

  const numericFields = new Set(["default_hourly_rate", "call_out_fee", "default_vat_rate", "default_payment_terms_days"]);

  const cleanValues = useCallback((values: FormValues) => {
    const clean: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(values)) {
      if (numericFields.has(k)) {
        clean[k] = v != null && v !== "" ? Number(v) : null;
      } else {
        clean[k] = (v as string)?.trim() || null;
      }
    }
    return clean;
  }, []);

  const saveVersionRef = useRef(0);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const performSave = useCallback(async (values: FormValues, showToast = false) => {
    const version = ++saveVersionRef.current;
    const clean = cleanValues(values);
    isSavingRef.current = true;
    try {
      setAutoSaveStatus("saving");
      await updateSettings.mutateAsync(clean as Partial<CompanySettings>);
      if (!isMountedRef.current) return;
      if (saveVersionRef.current === version) {
        reset(values);
        setAutoSaveStatus("saved");
        if (showToast) {
          toast({ title: "Settings saved", description: "Company information has been updated." });
        }
        setTimeout(() => {
          if (isMountedRef.current) setAutoSaveStatus("idle");
        }, 2000);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setAutoSaveStatus("idle");
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current && isMountedRef.current) {
        pendingSaveRef.current = false;
        if (Object.keys(dirtyRef.current).length > 0) {
          performSave(getValues());
        }
      }
    }
  }, [cleanValues, updateSettings, reset, toast, getValues]);

  const dirtyRef = useRef(dirtyFields);
  dirtyRef.current = dirtyFields;

  useEffect(() => {
    const subscription = watch(() => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        if (Object.keys(dirtyRef.current).length === 0) return;
        if (isSavingRef.current) {
          pendingSaveRef.current = true;
          return;
        }
        const current = getValues();
        performSave(current);
      }, 1500);
    });
    return () => {
      subscription.unsubscribe();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [watch, getValues, performSave]);

  useEffect(() => {
    return () => {
      if (Object.keys(dirtyRef.current).length > 0) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        const current = getValues();
        const clean = cleanValues(current);
        updateSettings.mutate(clean as Partial<CompanySettings>);
      }
    };
  }, [getValues, cleanValues, updateSettings]);

  const onSubmit = async (values: FormValues) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await performSave(values, true);
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              <Label htmlFor="default_hourly_rate">Default Hourly Labour Rate</Label>
              <Input id="default_hourly_rate" type="number" step="0.01" min="0" placeholder="e.g. 55.00" {...register("default_hourly_rate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call_out_fee">Call-out Fee</Label>
              <Input id="call_out_fee" type="number" step="0.01" min="0" placeholder="e.g. 65.00" {...register("call_out_fee")} />
              <p className="text-xs text-muted-foreground">Fixed fee covering the first hour. Additional time billed at the hourly rate.</p>
            </div>
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
          </CardContent>
        </Card>

        <CalloutRatesSection />
        <ProductCatalogueSection />

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
          <Button type="submit" disabled={updateSettings.isPending || autoSaveStatus === "saving"}>
            {updateSettings.isPending ? (
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
