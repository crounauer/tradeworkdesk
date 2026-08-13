import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { Redirect, Link, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff } from "lucide-react";

export default function PortalLogin() {
  const { session, isLoading } = usePortalAuth();
  const search = useSearch();
  const nextPath = new URLSearchParams(search).get("next") || "/portal";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestPostcode, setRequestPostcode] = useState("");
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestAccessMessage, setRequestAccessMessage] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-primary rounded-xl mb-4" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (session) return <Redirect to={nextPath} />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) {
        setError(authErr.message || "Invalid email or password");
        return;
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRequestAccessMessage("");

    if (!email.trim()) {
      setError("Enter your email first to request access.");
      return;
    }

    setRequestingAccess(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          postcode: requestPostcode.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not submit access request");
      }

      setRequestAccessMessage(
        "Request submitted. If your details match our records, your service provider will review and send an invite.",
      );
    } catch (requestErr) {
      setError(requestErr instanceof Error ? requestErr.message : "Could not submit access request");
    } finally {
      setRequestingAccess(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Portal</h1>
          <p className="text-slate-500 mt-1">Sign in to view your service records and property details</p>
        </div>

        <Card className="p-6 shadow-lg border-slate-200">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-900">Need portal access?</p>
            <p className="text-xs text-slate-500 mt-1">Request access and your service provider can approve and send your invite.</p>
            <form onSubmit={handleRequestAccess} className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="request-postcode">Postcode (optional)</Label>
                <Input
                  id="request-postcode"
                  value={requestPostcode}
                  onChange={(e) => setRequestPostcode(e.target.value.toUpperCase())}
                  placeholder="AB12 3CD"
                />
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={requestingAccess}>
                {requestingAccess ? "Submitting..." : "Request Access"}
              </Button>
            </form>
            {requestAccessMessage && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                {requestAccessMessage}
              </div>
            )}
          </div>
        </Card>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account? Contact your service provider for a portal invitation.
        </p>
      </div>
    </div>
  );
}
