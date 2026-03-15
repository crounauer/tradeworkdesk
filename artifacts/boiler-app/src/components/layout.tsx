import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, Users, Home, Flame, 
  Briefcase, FileBarChart, Search, LogOut, Menu, X 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/properties", label: "Properties", icon: Home },
    { href: "/appliances", label: "Appliances", icon: Flame },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/search", label: "Search", icon: Search },
    { href: "/reports", label: "Reports", icon: FileBarChart, roles: ['admin', 'office_staff'] },
  ];

  const visibleNavItems = navItems.filter(item => 
    !item.roles || (profile && item.roles.includes(profile.role))
  );

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-card border-r border-border shadow-sm">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display font-bold">
            B
          </div>
          <span className="font-display font-bold text-lg">BoilerTech</span>
        </div>
        
        <div className="px-4 py-6 flex-1 overflow-y-auto space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "")} />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display font-bold">B</div>
          <span className="font-display font-bold">BoilerTech</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-16">
          <div className="p-4 space-y-2">
            {visibleNavItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium",
                location === item.href ? "bg-primary/10 text-primary" : "text-foreground"
              )}>
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t border-border">
              <Button variant="outline" className="w-full" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen flex flex-col">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
