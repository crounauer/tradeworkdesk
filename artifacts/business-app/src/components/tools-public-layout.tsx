import { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { MarketingLayout } from "@/components/marketing-layout";

export function ToolsPublicLayout({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  // Logged-in users get the standard app layout (no banner needed)
  if (session) return <>{children}</>;

  return (
    <MarketingLayout>
      {/* Tool content */}
      {children}

      {/* Save-to-job CTA — sits between tool content and marketing footer */}
      <div className="bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
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
        </div>
      </div>
    </MarketingLayout>
  );
}
