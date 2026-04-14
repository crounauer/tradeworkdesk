import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, CheckCircle2, AlertCircle, Building2, ArrowLeft, ArrowRight, Check, User, Loader2, Ticket } from "lucide-react";
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

function getStartOnFreeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("plan") === "free";
}

type ValidateResult = { valid: boolean; role: string } | null;
type RegisterMode = "invite" | "company";
type CompanyType = "sole_trader" | "company";

export default function Register() {
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
  const [companyType, setCompanyType] = useState<CompanyType>("company");
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});

  const [startOnFree, setStartOnFree] = useState(getStartOnFreeFromUrl);

  const [betaCode, setBetaCode] = useState(getBetaCodeFromUrl);
  const [betaValid, setBetaValid] = useState<boolean | null>(null);
  const [betaError, setBetaError] = useState("");
  const [betaValidating, setBetaValidating] = useState(false);
  const [betaLockedEmail, setBetaLockedEmail] = useState<string | null>(null);

  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: trialInfo } = useQuery({
    queryKey: ["trial-info"],
    queryFn: async () => {
      const res = await fetch("/api/platform/trial-info");
      if (!res.ok) return { trial_duration_days: 30 };
      return res.json();
    },
  });
  const trialDays = trialInfo?.trial_duration_days || 30;

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
    if (!betaValid) { toast({ title: "A valid beta invite code is required", variant: "destructive" }); return; }
    const effectiveCompanyName = companyType === "sole_trader" ? (companyName || fullName) : companyName;
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
          addon_ids: startOnFree ? [] : [...selectedAddons],
          addon_quantities: startOnFree ? {} : addonQuantities,
          company_type: companyType,
          beta_code: betaCode.trim().toUpperCase(),
          start_on_free: startOnFree,
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

  const canAdvanceStep1 = betaValid === true && (companyType === "sole_trader" || companyName.trim().length > 0) && fullName.trim().length > 0 && email.trim().length > 0;

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

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-5">
      {[1, 2].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
            s < step ? "bg-primary text-white" : s === step ? "bg-primary/10 text-primary border-2 border-primary" : "bg-slate-100 text-slate-400"
          }`}>
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < 2 && <div className={`w-8 h-0.5 ${s < step ? "bg-primary" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50">
      <img
        src={`${import.meta.env.BASE_URL}images/login-bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply"
      />

      <div className="w-full max-w-md p-8 glass-panel rounded-3xl relative z-10 m-4">
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
              onChange={(e) => { setBetaCode(e.target.value); setBetaValid(null); setBetaError(""); }}
              onBlur={() => validateBetaCode(betaCode)}
              placeholder="e.g. BETA-A1B2C3D4"
              className={`font-mono uppercase pr-10 ${betaValid === true ? "border-emerald-400 focus-visible:ring-emerald-300" : betaError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
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
            Join with Invite
          </button>
        </div>

        {mode === "company" && (
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${companyType === "sole_trader" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              onClick={() => setCompanyType("sole_trader")}
            >
              <User className="w-4 h-4 inline mr-1.5 -mt-0.5" />Sole Trader
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${companyType === "company" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              onClick={() => setCompanyType("company")}
            >
              <Building2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />Company
            </button>
          </div>
        )}

        {mode === "invite" ? (
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Invite Code</Label>
              <div className="relative">
                <Input
                  value={code}
                  onChange={e => { setCode(e.target.value); setCodeResult(null); setCodeError(""); }}
                  onBlur={() => validateCode(code)}
                  placeholder="e.g. A1B2C3D4E5"
                  className={`font-mono uppercase pr-10 ${codeResult?.valid ? "border-emerald-400 focus-visible:ring-emerald-300" : codeError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
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
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
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
                <p className="text-sm text-muted-foreground text-center">
                  {companyType === "sole_trader" ? "Your details" : "Company & contact details"}
                </p>
                <div className="space-y-2">
                  <Label>Your Full Name</Label>
                  <Input placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                {companyType === "company" ? (
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input placeholder="Acme Heating Ltd" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Trading Name <span className="text-xs text-muted-foreground">(optional — defaults to your name)</span></Label>
                    <Input placeholder={fullName || "e.g. Smith Plumbing"} value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" placeholder="jane@company.com" value={email} onChange={e => setEmail(e.target.value)} required readOnly={!!betaLockedEmail} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone (optional)</Label>
                    <Input placeholder="07xxx" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border mt-2">
                  <input
                    type="checkbox"
                    id="start-on-free"
                    checked={startOnFree}
                    onChange={(e) => setStartOnFree(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="start-on-free" className="text-sm text-muted-foreground cursor-pointer">
                    Start on the <strong>Free plan</strong> instead (1 user, 5 jobs/month, skip the trial)
                  </label>
                </div>
                <Button className="w-full h-12 text-base mt-2" disabled={!canAdvanceStep1} onClick={() => setStep(2)}>
                  Next: Credentials <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">Set your login credentials</p>
                <div className="p-3 rounded-lg bg-slate-50 border text-sm">
                  <p className="font-medium">{companyType === "sole_trader" ? (companyName || fullName) : companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {companyType === "sole_trader" && <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded mr-1.5">Sole Trader</span>}
                    {fullName} &middot; {email}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" type="button" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button type="submit" className="flex-1 h-12 text-base" disabled={loading}>
                    {loading ? "Setting up..." : startOnFree ? "Start Free Plan" : `Start ${trialDays}-Day Trial`}
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  {startOnFree ? "Free plan — 1 user, 5 jobs/month. Upgrade anytime." : "No credit card required. Full access to all features during your trial."}
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
  );
}
