import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("code") ?? "";
}

type ValidateResult = { valid: boolean; role: string } | null;
type RegisterMode = "invite" | "company";

export default function Register() {
  const [mode, setMode] = useState<RegisterMode>(() => getCodeFromUrl() ? "invite" : "company");

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
  const [selectedPlan, setSelectedPlan] = useState("");

  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans/public");
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
        toast({ title: "Welcome to BoilerTech!", description: "Your account is ready." });
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
    if (!companyName) { toast({ title: "Company name is required", variant: "destructive" }); return; }
    if (password !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          contact_name: fullName,
          contact_email: email,
          contact_phone: phone || undefined,
          password,
          plan_id: selectedPlan || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      toast({ title: "Company registered!", description: "Please sign in with your credentials." });
      navigate("/login");
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
          <h1 className="text-2xl font-display font-bold text-foreground">Join BoilerTech</h1>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "company" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
            onClick={() => setMode("company")}
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
          <form onSubmit={handleCompanySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input placeholder="Acme Heating Ltd" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Your Full Name</Label>
              <Input placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
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
            {plans && plans.length > 0 && (
              <div className="space-y-2">
                <Label>Plan</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  <option value="">Select a plan...</option>
                  {plans.filter((p: { is_active: boolean }) => p.is_active).map((p: { id: string; name: string; monthly_price: number }) => (
                    <option key={p.id} value={p.id}>{p.name} - £{Number(p.monthly_price).toFixed(2)}/mo</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full h-12 text-base mt-2" disabled={loading}>
              {loading ? "Setting up your company..." : "Start 14-Day Free Trial"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">No credit card required. 14-day free trial.</p>
          </form>
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
