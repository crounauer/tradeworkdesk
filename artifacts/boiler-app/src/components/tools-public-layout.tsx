import { ReactNode } from "react";
import { Link } from "wouter";
import { Flame, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function ToolsPublicLayout({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  // Logged-in users get the standard app layout (no banner needed)
  if (session) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky branded header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" />
            <span className="font-bold text-slate-900 tracking-tight">TradeWorkDesk</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-1.5 text-xs sm:text-sm">
                Start Free Trial <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Tool content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer CTA */}
      <footer className="bg-primary text-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-10 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-white/80" />
            <span className="font-bold text-lg tracking-tight">TradeWorkDesk</span>
          </div>
          <h2 className="text-xl font-semibold">Save results directly to your jobs</h2>
          <p className="text-primary-foreground/80 text-sm max-w-md mx-auto">
            TradeWorkDesk is the all-in-one platform for gas, oil, heat pump and plumbing engineers.
            Manage jobs, customers, digital forms, invoicing and compliance — from your phone.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/register">
              <Button variant="secondary" className="gap-2 font-semibold">
                Start Free Trial — 30 days free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
              Already have an account? Log in
            </Link>
          </div>
          <p className="text-xs text-white/50 pt-4">
            © {new Date().getFullYear()} TradeWorkDesk Ltd. All rights reserved. ·{" "}
            <Link href="/privacy" className="hover:text-white/80 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
