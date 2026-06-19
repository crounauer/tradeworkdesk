import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, CheckCircle2, AlertCircle, Building2, ArrowLeft, ArrowRight, Check, Loader2, Ticket, Wrench, Globe, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("code") ?? "";
}

function getBetaCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("beta") ?? "";
}

type ValidateResult = { valid: boolean; role: string } | null;
type RegisterMode = "invite" | "company";
type Product = "tradeworkdesk" | "tradesite" | "bundle";

interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users?: number;
  sort_order?: number;
  is_active?: boolean;
}

export default function Register() {
  type FieldKey = "betaCode" | "inviteCode" | "fullName" | "email" | "password" | "confirmPassword";

  const [mode, setMode] = useState<RegisterMode>(() => getCodeFromUrl() ? "invite" : "company");
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState(getCodeFromUrl);
  const [validating, setValidating] = useState(false);
  const [codeResult, setCodeResult] = useState<ValidateResult>(null);
  const [codeError, setCodeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});

  const [signupPath, setSignupPath] = useState<"trial" | "subscribe">("trial");
  const [product, setProduct] = useState<Product>("tradeworkdesk");

  const [betaCode, setBetaCode] = useState(getBetaCodeFromUrl);
  const [betaValid, setBetaValid] = useState<boolean | null>(null);
  const [betaError, setBetaError] = useState("");
  const [betaValidating, setBetaValidating] = useState(false);
  const [betaLockedEmail, setBetaLockedEmail] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const { toast } = useToast();
  const [, navigate] = useLocation();

  const setFieldError = (field: FieldKey, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const clearFieldError = (field: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const showMissingFieldsToast = (fields: string[]) => {
    toast({
      title: "Please complete required fields",
      description: fields.join(", "),
      variant: "destructive",
    });
  };

  const { data: trialInfo } = useQuery({
    queryKey: ["trial-info"],
    queryFn: async () => {
      const res = await fetch("/api/platform/trial-info");
      if (!res.ok) return { trial_duration_days: 30 };
      return res.json();
    },
  });
  const trialDays = trialInfo?.trial_duration_days || 30;

  const { data: publicPlans = [] } = useQuery<PublicPlan[]>({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans/public");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === "company",
    staleTime: 60_000,
  });

  const { data: addons } = useQuery({
    queryKey: ["public-addons"],
    queryFn: async () => {
      const res = await fetch("/api/platform/addons/public");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === "company",
  });

  useEffect(() => {
    if (addons && addons.length > 0 && selectedAddons.size === 0) {
      setSelectedAddons(new Set(addons.map((a: { id: string }) => a.id)));
    }
  }, [addons]);

  useEffect(() => {
    const initial = getCodeFromUrl();
    if (initial) validateCode(initial);
  }, []);

  useEffect(() => {
    const initial = getBetaCodeFromUrl();
    if (initial) validateBetaCode(initial);
  }, []);

  async function validateBetaCode(c: string) {
    const trimmed = c.trim().toUpperCase();
    if (!trimmed) { setBetaValid(null); setBetaError(""); return; }
    setBetaValidating(true);
    setBetaError("");
    setBetaValid(null);
    try {
      const res = await fetch("/api/auth/validate-beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (data.valid) {
        setBetaValid(true);
        if (data.email) {
          setBetaLockedEmail(data.email);
          setEmail(data.email);
        }
      } else {
        setBetaValid(false);
        setBetaError(data.error || "Invalid beta code");
      }
    } catch {
      setBetaError("Could not validate beta code.");
    } finally {
      setBetaValidating(false);
    }
  }

  async function validateCode(c: string) {
    const trimmed = c.trim().toUpperCase();
    if (!trimmed) { setCodeResult(null); setCodeError(""); return; }
    setValidating(true);
    setCodeError("");
    setCodeResult(null);
    try {
      const res = await fetch("/api/auth/validate-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error ?? "Invalid code"); }
      else setCodeResult(data);
    } catch {
      setCodeError("Could not validate code.");
    } finally {
      setValidating(false);
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!code.trim()) {
      missing.push("Invite Code");
      setFieldError("inviteCode", "Invite code is required.");
    }
    if (!fullName.trim()) {
      missing.push("Full Name");
      setFieldError("fullName", "Full name is required.");
    }
    if (!email.trim()) {
      missing.push("Email Address");
      setFieldError("email", "Email address is required.");
    }
    if (!password) {
      missing.push("Password");
      setFieldError("password", "Password is required.");
    }
    if (!confirmPassword) {
      missing.push("Confirm Password");
      setFieldError("confirmPassword", "Please confirm your password.");
    }
    if (missing.length > 0) {
      showMissingFieldsToast(missing);
      return;
    }

    if (!codeResult?.valid) { toast({ title: "Valid invite code required", variant: "destructive" }); return; }
    if (password !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (signUpError) throw signUpError;

      const session = authData.session;

      if (session) {
        const inviteRes = await fetch("/api/auth/use-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code: code.trim().toUpperCase() }),
        });
        if (!inviteRes.ok) {
          const err = await inviteRes.json();
          throw new Error(err.error ?? "Failed to apply invite code");
        }
        toast({ title: "Welcome to TradeWorkDesk!", description: "Your account is ready." });
        navigate("/");
      } else {
        localStorage.setItem("pending_invite_code", code.trim().toUpperCase());
        setDone(true);
      }
    } catch (err) {
      toast({ title: "Registration failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!betaCode.trim()) {
      missing.push("Beta Invite Code");
      setFieldError("betaCode", "Beta invite code is required.");
    }
    if (!fullName.trim()) {
      missing.push("Your Full Name");
      setFieldError("fullName", "Full name is required.");
    }
    if (!email.trim()) {
      missing.push("Email Address");
      setFieldError("email", "Email address is required.");
    }
    if (!password) {
      missing.push("Password");
      setFieldError("password", "Password is required.");
    }
    if (!confirmPassword) {
      missing.push("Confirm Password");
      setFieldError("confirmPassword", "Please confirm your password.");
    }
    if (missing.length > 0) {
      showMissingFieldsToast(missing);
      return;
    }

    if (!betaValid) { toast({ title: "Beta Invite Code is invalid", variant: "destructive" }); return; }
    const effectiveCompanyName = companyName || fullName;
    if (!effectiveCompanyName) { toast({ title: "Company name is required", variant: "destructive" }); return; }
    if (password !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: effectiveCompanyName,
          contact_name: fullName,
          contact_email: email,
          contact_phone: phone || undefined,
          password,
          product,
          addon_ids: signupPath === "trial" ? [] : [...selectedAddons],
          addon_quantities: signupPath === "trial" ? {} : addonQuantities,
          beta_code: betaCode.trim().toUpperCase(),
          start_on_free: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      setDone(true);
    } catch (err) {
      toast({ title: "Registration failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    office_staff: "Office Staff",
    technician: "Technician",
  };

  const validateCompanyDetailsStep = () => {
    const missing: string[] = [];
    if (!betaCode.trim()) {
      missing.push("Beta Invite Code");
      setFieldError("betaCode", "Beta invite code is required.");
    }
    if (!fullName.trim()) {
      missing.push("Your Full Name");
      setFieldError("fullName", "Full name is required.");
    }
    if (!email.trim()) {
      missing.push("Email Address");
      setFieldError("email", "Email address is required.");
    }
    if (missing.length > 0) {
      showMissingFieldsToast(missing);
      return false;
    }
    if (!betaValid) {
      toast({ title: "Beta Invite Code is invalid", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateCompanyProductStep = () => {
    if (!betaCode.trim()) {
      setFieldError("betaCode", "Beta invite code is required.");
      showMissingFieldsToast(["Beta Invite Code"]);
      return false;
    }
    return true;
  };

  const PRODUCT_META: Record<Product, { icon: React.ReactNode; defaultLabel: string; tagline: string; features: string[] }> = {
    tradeworkdesk: {
      icon: <Wrench className="w-6 h-6" />,
      defaultLabel: "TradeWorkDesk",
      tagline: "Job management software",
      features: ["Jobs & scheduling", "Invoicing", "Compliance forms", "Customer records"],
    },
    tradesite: {
      icon: <Globe className="w-6 h-6" />,
      defaultLabel: "Website Builder",
      tagline: "Website builder",
      features: ["Custom domain", "Blog & gallery", "Contact forms", "SEO tools"],
    },
    bundle: {
      icon: <Layers className="w-6 h-6" />,
      defaultLabel: "Bundle",
      tagline: "Both products — best value",
      features: ["Everything in TradeWorkDesk", "Everything in Website Builder", "Discounted price", "Single login"],
    },
  };

  const resolveProductFromPlan = (name: string): Product => {
    const n = name.toLowerCase();
    if (n.includes("bundle") || n.includes("both")) return "bundle";
    if (n.includes("website") || n.includes("site")) return "tradesite";
    return "tradeworkdesk";
  };

  const formatMonthlyPrice = (price: number) => `£${Number(price || 0).toFixed(0)}/mo`;

  const productsByKey = new Map<Product, { key: Product; label: string; tagline: string; price: string; icon: React.ReactNode; features: string[] }>();
  for (const plan of publicPlans) {
    if (!(plan.is_active ?? true)) continue;
    if (Number(plan.monthly_price || 0) <= 0) continue;

    const key = resolveProductFromPlan(plan.name || "");
    if (productsByKey.has(key)) continue;
    const meta = PRODUCT_META[key];
    productsByKey.set(key, {
      key,
      label: plan.name || meta.defaultLabel,
      tagline: meta.tagline,
      price: formatMonthlyPrice(Number(plan.monthly_price || 0)),
      icon: meta.icon,
      features: meta.features,
    });
  }

  const PRODUCTS: { key: Product; label: string; tagline: string; price: string; icon: React.ReactNode; features: string[] }[] =
    productsByKey.size > 0
      ? (["tradeworkdesk", "tradesite", "bundle"] as Product[])
          .map((key) => productsByKey.get(key))
          .filter((value): value is { key: Product; label: string; tagline: string; price: string; icon: React.ReactNode; features: string[] } => Boolean(value))
      : [
          {
            key: "tradeworkdesk",
            label: PRODUCT_META.tradeworkdesk.defaultLabel,
            tagline: PRODUCT_META.tradeworkdesk.tagline,
            price: "£25/mo",
            icon: PRODUCT_META.tradeworkdesk.icon,
            features: PRODUCT_META.tradeworkdesk.features,
          },
          {
            key: "tradesite",
            label: PRODUCT_META.tradesite.defaultLabel,
            tagline: PRODUCT_META.tradesite.tagline,
            price: "£20/mo",
            icon: PRODUCT_META.tradesite.icon,
            features: PRODUCT_META.tradesite.features,
          },
          {
            key: "bundle",
            label: PRODUCT_META.bundle.defaultLabel,
            tagline: PRODUCT_META.bundle.tagline,
            price: "£40/mo",
            icon: PRODUCT_META.bundle.icon,
            features: PRODUCT_META.bundle.features,
          },
        ];

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md p-8 bg-card rounded-3xl shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-display font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
          </p>
          <Button className="w-full mt-2" onClick={() => navigate("/login")}>Go to Sign In</Button>
        </div>
      </div>
    );
  }

  const totalSteps = signupPath === "trial" ? 3 : 4;
  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-5">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
            s < step ? "bg-primary text-white" : s === step ? "bg-primary/10 text-primary border-2 border-primary" : "bg-slate-100 text-slate-400"
          }`}>
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < totalSteps && <div className={`w-8 h-0.5 ${s < step ? "bg-primary" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-y-auto bg-slate-50">
      <img
        src={`${import.meta.env.BASE_URL}images/login-bg.png`}
        alt=""
        className="fixed inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply"
      />

      <div className="relative z-10 flex min-h-screen items-start justify-center px-4 py-6 sm:items-center sm:py-8">
        <div className="w-full max-w-md p-8 glass-panel rounded-3xl">
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Join TradeWorkDesk</h1>
        </div>

        <div className="space-y-2 mb-5">
          <Label className="flex items-center gap-1.5">
            <Ticket className="w-4 h-4" />
            Beta Invite Code
          </Label>
          <div className="relative">
            <Input
              value={betaCode}
              onChange={(e) => { setBetaCode(e.target.value); setBetaValid(null); setBetaError(""); clearFieldError("betaCode"); }}
              onBlur={() => validateBetaCode(betaCode)}
              placeholder="e.g. BETA-A1B2C3D4"
              className={`font-mono uppercase pr-10 ${(betaValid === true ? "border-emerald-400 focus-visible:ring-emerald-300" : betaError ? "border-destructive focus-visible:ring-destructive/30" : "")} ${fieldErrors.betaCode ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              required
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {betaValidating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {betaValid === true && !betaValidating && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {betaError && !betaValidating && <AlertCircle className="w-4 h-4 text-destructive" />}
            </div>
          </div>
          {betaValid === true && (
            <p className="text-xs text-emerald-600 font-medium">
              Valid beta code{betaLockedEmail ? ` — locked to ${betaLockedEmail}` : ""}
            </p>
          )}
          {fieldErrors.betaCode && <p className="text-xs text-destructive">{fieldErrors.betaCode}</p>}
          {betaError && <p className="text-xs text-destructive">{betaError}</p>}
          {betaValid === null && !betaError && !betaValidating && (
            <p className="text-xs text-muted-foreground">
              TradeWorkDesk is in private beta. Enter your invite code to continue.
            </p>
          )}
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "company" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
            onClick={() => { setMode("company"); setStep(1); }}
          >
            <Building2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />New Company
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "invite" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
            onClick={() => setMode("invite")}
          >
            Join Existing Company
          </button>
        </div>

        {mode === "invite" && (
          <p className="text-xs text-muted-foreground text-center mb-4">
            Use this if your employer has invited you to join their existing company workspace.
          </p>
        )}

        {mode === "invite" ? (
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Invite Code</Label>
              <div className="relative">
                <Input
                  value={code}
                  onChange={e => { setCode(e.target.value); setCodeResult(null); setCodeError(""); clearFieldError("inviteCode"); }}
                  onBlur={() => validateCode(code)}
                  placeholder="e.g. A1B2C3D4E5"
                  className={`font-mono uppercase pr-10 ${(codeResult?.valid ? "border-emerald-400 focus-visible:ring-emerald-300" : codeError ? "border-destructive focus-visible:ring-destructive/30" : "")} ${fieldErrors.inviteCode ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validating && <div className="w-4 h-4 border-2 border-primary/50 border-t-primary rounded-full animate-spin" />}
                  {codeResult?.valid && !validating && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {codeError && !validating && <AlertCircle className="w-4 h-4 text-destructive" />}
                </div>
              </div>
              {codeResult?.valid && (
                <p className="text-xs text-emerald-600 font-medium">Valid — you'll be registered as <strong>{ROLE_LABELS[codeResult.role] ?? codeResult.role}</strong></p>
              )}
              {fieldErrors.inviteCode && <p className="text-xs text-destructive">{fieldErrors.inviteCode}</p>}
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="Jane Smith" value={fullName} onChange={e => { setFullName(e.target.value); clearFieldError("fullName"); }} className={fieldErrors.fullName ? "border-destructive focus-visible:ring-destructive/30" : ""} required />
              {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" placeholder="jane@example.com" value={email} onChange={e => { setEmail(e.target.value); clearFieldError("email"); }} className={fieldErrors.email ? "border-destructive focus-visible:ring-destructive/30" : ""} required />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Min. 8 characters" value={password} onChange={e => { setPassword(e.target.value); clearFieldError("password"); }} className={fieldErrors.password ? "border-destructive focus-visible:ring-destructive/30" : ""} required />
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }} className={fieldErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive/30" : ""} required />
              {fieldErrors.confirmPassword && <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>}
            </div>
            <Button type="submit" className="w-full h-12 text-base mt-2" disabled={loading || !codeResult?.valid}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        ) : (
          <>
            {stepIndicator}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center font-medium">What would you like to sign up for?</p>
                <div className="space-y-2">
                  {PRODUCTS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setProduct(p.key)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        product === p.key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${product === p.key ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
                          {p.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{p.label}</span>
                            <span className="text-sm font-bold text-primary">{p.price}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{p.tagline}</p>
                        </div>
                      </div>
                      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 pl-12">
                        {p.features.map((f) => (
                          <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground">All plans include a {trialDays}-day free trial. No credit card required.</p>
                <Button
                  className="w-full h-12 text-base mt-2"
                  onClick={() => {
                    if (!validateCompanyProductStep()) return;
                    setStep(2);
                  }}
                >
                  Next: Your Details <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Company and contact details
                </p>
                <div className="space-y-2">
                  <Label>Your Full Name</Label>
                  <Input placeholder="Jane Smith" value={fullName} onChange={e => { setFullName(e.target.value); clearFieldError("fullName"); }} className={fieldErrors.fullName ? "border-destructive focus-visible:ring-destructive/30" : ""} required />
                  {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Business / Trading Name <span className="text-xs text-muted-foreground">(defaults to your name if left blank)</span></Label>
                  <Input placeholder={fullName || "e.g. Smith Plumbing"} value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" placeholder="jane@company.com" value={email} onChange={e => { setEmail(e.target.value); clearFieldError("email"); }} className={fieldErrors.email ? "border-destructive focus-visible:ring-destructive/30" : ""} required readOnly={!!betaLockedEmail} />
                    {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Phone (optional)</Label>
                    <Input placeholder="07xxx" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" type="button" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button className="flex-1 h-12 text-base" onClick={() => {
                    if (!validateCompanyDetailsStep()) return;
                    setStep(signupPath === "subscribe" ? 3 : 3);
                  }}>
                    Next: Credentials <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && signupPath === "subscribe" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Choose the add-ons you need. You can change these anytime.
                </p>
                {addons && addons.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {addons.map((a: { id: string; name: string; description?: string; monthly_price: number }) => (
                      <label
                        key={a.id}
                        className={`flex items-center gap-3 w-full p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                          selectedAddons.has(a.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAddons.has(a.id)}
                          onChange={() => {
                            setSelectedAddons(prev => {
                              const next = new Set(prev);
                              if (next.has(a.id)) next.delete(a.id);
                              else next.add(a.id);
                              return next;
                            });
                          }}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{a.name}</span>
                          {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                        </div>
                        <span className="text-sm font-semibold text-primary whitespace-nowrap">
                          +£{Number(a.monthly_price).toFixed(2)}/mo
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No add-ons available yet.</p>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button className="flex-1 h-12" onClick={() => setStep(4)}>
                    Next: Credentials <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">Add-ons are optional and can be changed anytime.</p>
              </div>
            )}

            {((step === 3 && signupPath === "trial") || (step === 4 && signupPath === "subscribe")) && (
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">Set your login credentials</p>
                <div className="p-3 rounded-lg bg-slate-50 border text-sm">
                  <p className="font-medium">{companyName || fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {fullName} &middot; {email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Product: <span className="font-medium capitalize">{PRODUCTS.find(p => p.key === product)?.label}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" placeholder="Min. 8 characters" value={password} onChange={e => { setPassword(e.target.value); clearFieldError("password"); }} className={fieldErrors.password ? "border-destructive focus-visible:ring-destructive/30" : ""} required />
                  {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }} className={fieldErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive/30" : ""} required />
                  {fieldErrors.confirmPassword && <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" type="button" onClick={() => setStep(signupPath === "trial" ? 2 : 3)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button type="submit" className="flex-1 h-12 text-base" disabled={loading}>
                    {loading ? "Setting up..." : `Start ${trialDays}-Day Trial`}
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  No credit card required. Full access during your trial.
                </p>
              </form>
            )}
          </>
        )}

          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <button type="button" onClick={() => navigate("/login")} className="text-primary font-medium hover:underline">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
