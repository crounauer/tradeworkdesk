import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Menu, X, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function MarketingLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { session } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-sm">
                B
              </div>
              <span className="font-display font-bold text-lg text-slate-900">BoilerTech</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    location === link.href || location.startsWith(link.href + "/")
                      ? "text-primary bg-primary/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {session ? (
                <Link href="/">
                  <Button size="sm">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">Log in</Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm">Start Free Trial</Button>
                  </Link>
                </>
              )}
            </div>

            <button
              className="md:hidden p-2 text-slate-600"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-lg text-base font-medium",
                  location === link.href ? "text-primary bg-primary/5" : "text-slate-700"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              {session ? (
                <Link href="/" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-display font-bold text-sm">
                  B
                </div>
                <span className="font-display font-bold text-lg text-white">BoilerTech</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                The all-in-one platform for boiler service companies. Manage jobs, customers, and compliance from one place.
              </p>
            </div>

            <div>
              <h4 className="font-display font-semibold text-white mb-4 text-sm">Product</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/gas-engineer-software" className="hover:text-white transition-colors">Gas Engineer Software</Link></li>
                <li><Link href="/boiler-service-management-software" className="hover:text-white transition-colors">Boiler Service Software</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-semibold text-white mb-4 text-sm">Resources</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-semibold text-white mb-4 text-sm">Legal</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} BoilerTech Ltd. All rights reserved.
            </p>
            <p className="text-sm text-slate-500">
              Registered in England & Wales. Made for heating engineers, by heating engineers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
