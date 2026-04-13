import { Link, useLocation } from "wouter";
import { Home, Building2, Briefcase, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import type { ReactNode } from "react";

const navItems = [
  { label: "Dashboard", href: "/portal", icon: Home },
  { label: "Properties", href: "/portal/properties", icon: Building2 },
  { label: "Jobs", href: "/portal/jobs", icon: Briefcase },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { customerName, companyName, signOut } = usePortalAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/portal" className="flex items-center gap-2 text-primary font-bold text-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-primary" />
                </div>
                <span className="hidden sm:inline">{companyName || "Customer Portal"}</span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = location === item.href || (item.href !== "/portal" && location.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href}>
                      <button className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}>
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-slate-600">
                <User className="w-3.5 h-3.5 inline mr-1" />
                {customerName}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-slate-500 hover:text-slate-700">
                <LogOut className="w-4 h-4 mr-1" /> Sign Out
              </Button>
            </div>
          </div>
          <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/portal" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"}`}>
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
