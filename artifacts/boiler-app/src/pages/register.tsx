import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, CheckCircle2, AlertCircle, Building2, ArrowLeft, ArrowRight, Check, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("code") ?? "";
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

  const { toast } = useToast();
  const [, navigate] = useLocation();

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
    const initial = getCodeFromUrl();
    if (initial) validateCode(initial);
  }, []);

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
          addon_ids: [...selectedAddons],
          addon_quantities: addonQuantities,
          company_type: companyType,
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

  const canAdvanceStep1 = (companyType === "sole_trader" || companyName.trim().length > 0) && fullName.trim().length > 0 && email.trim().length > 0;
  const canAdvanceStep2 = true; // add-on selection is optional

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
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
            s < step ? "bg-primary text-white" : s === step ? "bg-primary/10 text-primary border-2 border-primary" : "bg-slate-100 text-slate-400"
          }`}>
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < 3 && <div className={`w-8 h-0.5 ${s < step ? "bg-primary" : "bg-slate-200"}`} />}
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
                    <Input type="email" placeholder="jane@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone (optional)</Label>
                    <Input placeholder="07xxx" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full h-12 text-base mt-2" disabled={!canAdvanceStep1} onClick={() => setStep(2)}>
                  Next: Choose Add-ons <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Everyone starts with our Base Plan. Optionally add extras you need.
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
                          {(a as Record<string, unknown>).is_per_seat && selectedAddons.has(a.id) && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">Seats:</span>
                              <button
                                type="button"
                                className="w-6 h-6 rounded border text-xs font-bold"
                                onClick={(e) => { e.preventDefault(); setAddonQuantities(prev => ({ ...prev, [a.id]: Math.max(1, (prev[a.id] || 1) - 1) })); }}
                              >-</button>
                              <span className="text-xs font-medium w-6 text-center">{addonQuantities[a.id] || 1}</span>
                              <button
                                type="button"
                                className="w-6 h-6 rounded border text-xs font-bold"
                                onClick={(e) => { e.preventDefault(); setAddonQuantities(prev => ({ ...prev, [a.id]: (prev[a.id] || 1) + 1 })); }}
                              >+</button>
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-primary whitespace-nowrap">
                          +£{(Number(a.monthly_price) * ((a as Record<string, unknown>).is_per_seat ? (addonQuantities[a.id] || 1) : 1)).toFixed(2)}/mo
                          {(a as Record<string, unknown>).is_per_seat ? ' per seat' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No add-ons available yet. You can add them later from your billing page.</p>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button className="flex-1 h-12" disabled={!canAdvanceStep2} onClick={() => setStep(3)}>
                    Next: Credentials <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">Add-ons are optional and can be changed anytime.</p>
              </div>
            )}

            {step === 3 && (
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
                  <Button variant="outline" className="flex-1 h-12" type="button" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button type="submit" className="flex-1 h-12 text-base" disabled={loading}>
                    {loading ? "Setting up..." : "Start Free Trial"}
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">No credit card required. 14-day free trial.</p>
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
