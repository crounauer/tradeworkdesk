import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCompanySettings, useUpdateCompanySettings, useUploadCompanyLogo } from "@/hooks/use-company-settings";
import type { CompanySettings } from "@/hooks/use-company-settings";
import { useCompanyType, useUpgradeToCompany, useDowngradeToSoleTrader } from "@/hooks/use-company-type";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Building2, Phone, Mail, Globe, Shield, FileText,
  Upload, Trash2, Save, Loader2, MapPin, BadgeCheck, PoundSterling,
  ArrowUpCircle, ArrowDownCircle, Users, AlertTriangle, CreditCard
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

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<FormValues>();

  useEffect(() => {
    if (settings) {
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
        default_hourly_rate: settings.default_hourly_rate ?? 0,
        call_out_fee: settings.call_out_fee ?? 0,
        default_vat_rate: settings.default_vat_rate ?? 20,
        default_payment_terms_days: settings.default_payment_terms_days ?? 30,
        currency: settings.currency ?? "GBP",
      });
      if (settings.logo_url) setLogoPreview(settings.logo_url);
    }
  }, [settings, reset]);

  const numericFields = new Set(["default_hourly_rate", "call_out_fee", "default_vat_rate", "default_payment_terms_days"]);

  const onSubmit = async (values: FormValues) => {
    const clean: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(values)) {
      if (numericFields.has(k)) {
        clean[k] = v != null && v !== "" ? Number(v) : null;
      } else {
        clean[k] = (v as string)?.trim() || null;
      }
    }
    try {
      await updateSettings.mutateAsync(clean as Partial<CompanySettings>);
      toast({ title: "Settings saved", description: "Company information has been updated." });
      reset(values);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
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

        <div className="flex justify-end gap-3 pt-2">
          {isDirty && (
            <Button type="button" variant="outline" onClick={() => reset()}>
              Discard Changes
            </Button>
          )}
          <Button type="submit" disabled={updateSettings.isPending}>
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
