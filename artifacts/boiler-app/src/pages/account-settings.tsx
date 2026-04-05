import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Shield, ShieldCheck, ShieldOff, Loader2, QrCode } from "lucide-react";
import QRCode from "qrcode";

type MfaFactor = { id: string; friendly_name?: string; factor_type: string; status: string };

export default function AccountSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [enrollFactorId, setEnrollFactorId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [disableFactorId, setDisableFactorId] = useState("");

  const loadFactors = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setLoading(false);
        return;
      }
      const result = await Promise.race([
        supabase.auth.mfa.listFactors(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (result && "data" in result && result.data) {
        setFactors(result.data.totp || []);
      } else if (result && "error" in result && result.error) {
        console.error("MFA listFactors error:", result.error);
      }
    } catch (err) {
      console.error("MFA loadFactors exception:", err);
    }
    setLoading(false);
  };

  useEffect(() => { loadFactors(); }, []);

  const verifiedFactors = factors.filter(f => f.status === "verified");
  const has2FA = verifiedFactors.length > 0;

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (error) throw error;
      setEnrollFactorId(data.id);

      const secret = extractSecretFromUri(data.totp.uri);
      setTotpSecret(secret);

      const brandedUri = rebrandTotpUri(data.totp.uri);
      const dataUrl = await QRCode.toDataURL(brandedUri, { width: 200, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to start enrollment", variant: "destructive" });
      setEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      toast({ title: "2FA Enabled", description: "Two-factor authentication is now active on your account." });
      setTotpSecret("");
      setQrDataUrl("");
      setEnrollFactorId("");
      setVerifyCode("");
      setEnrolling(false);
      await loadFactors();
    } catch (err) {
      toast({ title: "Verification Failed", description: err instanceof Error ? err.message : "Invalid code. Please try again.", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (enrollFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: enrollFactorId });
    }
    setTotpSecret("");
    setQrDataUrl("");
    setEnrollFactorId("");
    setVerifyCode("");
    setEnrolling(false);
  };

  const startDisable = (factorId: string) => {
    setDisableFactorId(factorId);
    setDisableCode("");
    setShowDisable(true);
  };

  const handleDisable = async () => {
    if (disableCode.length !== 6) return;
    setUnenrolling(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: disableFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: disableFactorId,
        challengeId: challengeData.id,
        code: disableCode,
      });
      if (verifyError) throw verifyError;

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: disableFactorId,
      });
      if (unenrollError) throw unenrollError;

      toast({ title: "2FA Disabled", description: "Two-factor authentication has been removed from your account." });
      setShowDisable(false);
      setDisableCode("");
      setDisableFactorId("");
      await loadFactors();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to disable 2FA. Check your code.", variant: "destructive" });
    } finally {
      setUnenrolling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">My Account</h1>
        <p className="text-muted-foreground mt-1">Manage your account and security settings.</p>
      </div>

      <Card className="p-6 border border-border/50 shadow-sm">
        <h2 className="font-bold text-lg mb-1">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{profile?.full_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{profile?.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="font-medium capitalize">{profile?.role?.replace("_", " ") || "—"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-border/50 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-xl ${has2FA ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Two-Factor Authentication</h2>
            <p className="text-sm text-muted-foreground">
              {has2FA ? "Your account is protected with 2FA." : "Add an extra layer of security to your account."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : has2FA && !enrolling ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">2FA is active</p>
                <p className="text-xs text-emerald-600">Your account is secured with an authenticator app.</p>
              </div>
            </div>
            {!showDisable ? (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => startDisable(verifiedFactors[0].id)}>
                <ShieldOff className="w-4 h-4 mr-1.5" /> Disable 2FA
              </Button>
            ) : (
              <div className="border rounded-lg p-4 space-y-3 bg-red-50/50">
                <p className="text-sm font-medium">Enter your authenticator code to confirm disabling 2FA:</p>
                <InputOTP maxLength={6} value={disableCode} onChange={setDisableCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleDisable} disabled={unenrolling || disableCode.length !== 6}>
                    {unenrolling ? "Disabling..." : "Confirm Disable"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowDisable(false); setDisableCode(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : enrolling && qrDataUrl ? (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-white">
              <p className="text-sm font-medium mb-3">1. Scan this QR code with your authenticator app:</p>
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img src={qrDataUrl} alt="2FA QR Code" className="w-48 h-48" />
              </div>
              {totpSecret && (
                <p className="text-xs text-muted-foreground mt-2 text-center break-all">
                  Or enter this key manually: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">{totpSecret}</code>
                </p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium mb-2">2. Enter the 6-digit code from your app:</p>
              <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleVerifyEnrollment} disabled={verifying || verifyCode.length !== 6}>
                {verifying ? "Verifying..." : "Verify & Enable 2FA"}
              </Button>
              <Button variant="outline" onClick={handleCancelEnroll}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Use an authenticator app like Google Authenticator, Authy, or 1Password to generate time-based verification codes.
            </p>
            <Button onClick={handleEnroll} disabled={enrolling}>
              <QrCode className="w-4 h-4 mr-1.5" /> {enrolling ? "Setting up..." : "Enable 2FA"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function extractSecretFromUri(uri: string): string {
  try {
    const url = new URL(uri);
    return url.searchParams.get("secret") || "";
  } catch {
    return "";
  }
}

function rebrandTotpUri(uri: string): string {
  try {
    const url = new URL(uri);
    url.searchParams.set("issuer", "TradeWorkDesk");
    const path = url.pathname;
    const labelMatch = path.match(/^\/([^:]*):(.+)$/);
    if (labelMatch) {
      const account = labelMatch[2];
      url.pathname = `/TradeWorkDesk:${account}`;
    }
    return url.toString();
  } catch {
    return uri;
  }
}
