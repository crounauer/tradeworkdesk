import { ReactNode, useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useInitData } from "@/hooks/use-init-data";
import { useHomepageData } from "@/hooks/use-homepage-data";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { 
  LayoutDashboard, Users, Home, Flame, CalendarDays,
  Briefcase, FileBarChart, Search, LogOut, Menu, X,
  ShieldCheck, UserPlus, Settings2, Building2,
  Globe, CreditCard, Megaphone, ScrollText, AlertTriangle, Info, AlertCircle, Share2, ListTree,
  Zap, MessageSquarePlus, MessageSquare, UserCog, FileText, WifiOff, Ticket, Lock, ClipboardList, HardDrive, CheckSquare, Receipt, RefreshCcw, HelpCircle, Wrench, Globe2, LayoutTemplate, CalendarCheck, Star, MailOpen, PhoneCall, ShieldPlus, Palette, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { OfflineBanner } from "./offline-indicator";
import { useOffline } from "@/contexts/offline-context";
import { useOfflineReferenceDataSync } from "@/hooks/use-offline-data";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("dismissed_announcements");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem("dismissed_announcements", JSON.stringify([...dismissedAnnouncements]));
  }, [dismissedAnnouncements]);

  const { isOnline, pendingMutations } = useOffline();
  // useOfflineReferenceDataSync();

  const supportTenantId = localStorage.getItem("superadmin_readonly_tenant_id");
  const isReadOnlySupportMode = profile?.role === "super_admin" && !!supportTenantId;
  const isSuperAdmin = profile?.role === "super_admin" && !isReadOnlySupportMode;
  const isAdmin = profile?.role === "admin" || isSuperAdmin || isReadOnlySupportMode;
  const { hasFeature, hasAddon } = usePlanFeatures();
  const { data: initData } = useInitData();
  const { data: companySettings } = useCompanySettings();
  const tenantInfo = initData?.tenant ?? null;

  // ── White-label: inject brand CSS variables ───────────────────────────────
  useEffect(() => {
    if (!companySettings?.white_label_enabled || !companySettings.primary_color) return;
    const hex = companySettings.primary_color;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    document.documentElement.style.setProperty('--primary', hsl);
    document.documentElement.style.setProperty('--ring', hsl);
    return () => {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--ring');
    };
  }, [companySettings?.primary_color, companySettings?.white_label_enabled]);

  // ── White-label: swap favicon ─────────────────────────────────────────────
  useEffect(() => {
    if (!companySettings?.white_label_enabled || !companySettings.favicon_url) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (link) link.href = companySettings.favicon_url;
  }, [companySettings?.favicon_url, companySettings?.white_label_enabled]);

  const enquiryCountData = { count: initData?.enquiriesCount ?? 0 };
  const overdueFollowUpsCount = initData?.overdueFollowUpsCount ?? 0;
  const activeFollowUpsCount = initData?.activeFollowUpsCount ?? 0;
  const todosCount = initData?.todosCount ?? 0;

  const announcements = initData?.announcements || [];
  const homepageData = undefined; // const { data: homepageData } = useHomepageData();

  const isTrial = tenantInfo?.status === "trial";
  const isTrialExpiredSuspended =
    tenantInfo?.status === "suspended" &&
    !!tenantInfo?.trial_ends_at &&
    new Date(tenantInfo.trial_ends_at).getTime() < Date.now();
  const isNoPaidPlanSuspended = tenantInfo?.status === "suspended" && !tenantInfo?.subscription;

  const trialDaysLeft = tenantInfo?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenantInfo.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const trialEndsOn = tenantInfo?.trial_ends_at
    ? new Date(tenantInfo.trial_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const accountSuspended = tenantInfo?.status === "suspended";
  const accountCancelled = tenantInfo?.status === "cancelled";
  const isLockedOut = !isSuperAdmin && !isReadOnlySupportMode && (accountSuspended || accountCancelled);
  const allowedLockedPaths = ["/billing", "/account"];
  const isOnAllowedPath = allowedLockedPaths.some(p => location === p || location.startsWith(p + "/"));

  const visibleAnnouncements = (announcements || []).filter(
    (a: { id: string }) => !dismissedAnnouncements.has(a.id)
  );

  const hasJobManagement = hasFeature("job_management");
  const hasWebsiteBuilder = hasFeature("website_builder");
  const supportHref = isSuperAdmin ? "/platform/support-tickets" : "/support";

  // ── Work: core day-to-day items ──────────────────────────────────────────
  const workNavItems = hasJobManagement ? [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    ...((profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin")
      ? [{ href: "/leave-holidays", label: "Leave & Holidays", icon: CalendarCheck }]
      : []),
    { href: "/enquiries", label: "Enquiries", icon: MessageSquarePlus },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    ...(companySettings?.invoicing_provider !== "external" ? [{ href: "/invoices", label: "Invoices", icon: Receipt }] : []),
    { href: "/follow-ups", label: "Follow-Ups", icon: ClipboardList },
    { href: "/todos", label: "To-Do List", icon: CheckSquare },
  ] : [];

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerNavItems = hasJobManagement ? [
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/properties", label: "Properties", icon: Home },
    { href: "/search", label: "Search", icon: Search },
  ] : [];

  // Legacy alias used in some render paths
  const navItems = workNavItems;

  const isCompanyType = tenantInfo?.company_type === "company";

  const adminNavItems = [
    { href: "/admin/company-settings", label: "Company Settings", icon: Building2 },
    { href: "/admin/branding", label: "Branding", icon: Palette },
    ...(isCompanyType ? [
      { href: "/admin/users", label: "Team", icon: ShieldCheck },
    ] : []),
    ...(hasJobManagement ? [{ href: "/admin/job-types", label: "Job Types", icon: ListTree }] : []),
    { href: "/billing", label: "Billing", icon: CreditCard },
  ];

  const platformNavItems = [
    { href: "/platform", label: "Overview", icon: Globe },
    { href: "/platform/tenants", label: "Companies", icon: Building2 },
    { href: "/platform/support-tickets", label: "Support Tickets", icon: MessageSquare },
    { href: "/platform/addons", label: "Add-ons", icon: Zap },
    { href: "/platform/plans", label: "Plans", icon: CreditCard },
    { href: "/platform/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/platform/settings", label: "Settings", icon: Settings2 },
    { href: "/platform/beta-invites", label: "Beta Invites", icon: Ticket },
    { href: "/platform/announcements", label: "Announcements", icon: Megaphone },
    { href: "/platform/audit-log", label: "Audit Log", icon: ScrollText },
  ];

  const websiteNavItems = hasWebsiteBuilder ? [
    { href: "/website", label: "My Website", icon: Globe2 },
      { href: "/booking", label: "Online Booking", icon: CalendarCheck },
      { href: "/review-requests", label: "Review Requests", icon: Star },
      { href: "/maintenance", label: "Maintenance Plans", icon: ShieldPlus },
      { href: "/campaigns", label: "Email Campaigns", icon: MailOpen },
      { href: "/missed-call", label: "Missed Call Text-Back", icon: PhoneCall },
  ] : [];

    const automationNavItems: typeof websiteNavItems = [];

  // All utility links moved to header bar
  const utilityNavItems: typeof workNavItems = [];

  const visibleNavItems = workNavItems; // kept for any remaining references
  const visibleUtilityItems = utilityNavItems;

  // Header bar: website link + reports/support/help for non-superadmin tenant users
  const tenantWebsiteUrl = companySettings?.website || null;
  const showHeaderBar = !isSuperAdmin;

  const openEnquiryCount = enquiryCountData?.count || 0;

  const renderNavLink = (item: { href: string; label: string; icon: React.ElementType }, onClick?: () => void, mobile?: boolean) => {
    const isActive = item.href === "/" 
      ? location === "/" 
      : location === item.href || location.startsWith(item.href + "/");
    const enquiryBadge = item.href === "/enquiries" && openEnquiryCount > 0 ? openEnquiryCount : null;
    const followUpBadge = item.href === "/follow-ups" && activeFollowUpsCount > 0 ? activeFollowUpsCount : null;
    const todoBadge = item.href === "/todos" && todosCount > 0 ? todosCount : null;
    const badge = enquiryBadge || followUpBadge || todoBadge;
    return (
      <Link key={item.href} href={item.href} onClick={onClick} className={cn(
        "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
        mobile ? "px-4 py-3 text-base" : "px-3 py-2.5",
        isActive 
          ? "bg-primary/10 text-primary" 
          : mobile ? "text-foreground" : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
      )}>
        <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "")} />
        <span className="flex-1">{item.label}</span>
        {badge !== null && (
          <span className={cn(
            "ml-auto px-1.5 py-0.5 text-xs font-bold rounded-full text-white min-w-[20px] text-center",
            followUpBadge ? "bg-red-500" : todoBadge ? "bg-orange-500" : "bg-orange-500"
          )}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
  };

  const renderStorageIndicator = (_mobile?: boolean) => {
    const storage = (homepageData as any)?.storage;
    if (!storage || !isAdmin || isSuperAdmin) return null;
    return (
      <div className={cn(mobile ? "pt-3 mt-2" : "pt-4 mt-3", "border-t border-border/50")}>
        <div className={cn("flex items-center gap-2.5 rounded-xl text-sm", mobile ? "px-4 py-2" : "px-3 py-2")}>
          <HardDrive className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Storage</p>
            <p className="text-sm font-semibold text-foreground">{formatBytes(storage.used_bytes)}</p>
          </div>
          <span className="text-xs text-muted-foreground">{storage.file_count} file{storage.file_count !== 1 ? "s" : ""}</span>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: typeof navItems, onClick?: () => void, mobile?: boolean) => (
    <div className={cn(mobile ? "pt-3 mt-2" : "pt-4 mt-3", "border-t border-border/50")}>
      <p className={cn("text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2", mobile ? "px-4" : "px-3")}>
        {title}
      </p>
      {items.map((item) => renderNavLink(item, onClick, mobile))}
    </div>
  );

  const severityIcon = (s: string) => {
    if (s === "critical") return <AlertCircle className="w-4 h-4 shrink-0" />;
    if (s === "warning") return <AlertTriangle className="w-4 h-4 shrink-0" />;
    return <Info className="w-4 h-4 shrink-0" />;
  };

  const severityClass = (s: string) => {
    if (s === "critical") return "bg-red-50 border-red-200 text-red-800";
    if (s === "warning") return "bg-amber-50 border-amber-200 text-amber-800";
    return "bg-blue-50 border-blue-200 text-blue-800";
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50 w-full">
      <aside className={cn("hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-card border-r border-border shadow-sm", isReadOnlySupportMode && "bg-red-50/50")}>
        <div className={cn("px-4 py-4 flex items-center gap-2.5 border-b border-border/50 min-h-[64px]", isReadOnlySupportMode && "border-red-200 bg-red-50")}>
          {isSuperAdmin && !isReadOnlySupportMode ? (
            // Super-admin always sees TradeWorkDesk platform branding
            <>
              <Flame className="w-5 h-5 text-primary shrink-0" />
              <span className="text-lg font-bold tracking-tight text-foreground">TradeWorkDesk</span>
            </>
          ) : isReadOnlySupportMode ? (
            // Read-only support mode — show prominent lock indicator
            <>
              <Lock className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-bold tracking-tight text-red-700">Support Mode</span>
              <Badge className="ml-auto bg-red-600 text-white text-xs px-1.5 py-0.5 h-fit">READ-ONLY</Badge>
            </>
          ) : isSuperAdmin ? (
            <>
              <Flame className="w-5 h-5 text-primary shrink-0" />
              <span className="text-lg font-bold tracking-tight text-foreground">TradeWorkDesk</span>
            </>
          ) : companySettings?.white_label_enabled && companySettings?.logo_url ? (
            // White-label enabled with logo — show company logo
            <img
              src={companySettings.logo_url}
              alt={companySettings.trading_name ?? companySettings.name ?? "Logo"}
              className="h-9 w-auto max-w-[168px] object-contain"
            />
          ) : companySettings?.white_label_enabled ? (
            // White-label enabled but no logo — show company name with initial badge
            <>
              {(companySettings?.trading_name ?? companySettings?.name) ? (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {(companySettings.trading_name ?? companySettings.name ?? "?").charAt(0).toUpperCase()}
                </div>
              ) : (
                <Flame className="w-5 h-5 text-primary shrink-0" />
              )}
              <span className="text-sm font-bold tracking-tight text-foreground truncate">
                {companySettings?.trading_name ?? companySettings?.name ?? "TradeWorkDesk"}
              </span>
            </>
          ) : (
            // White-label disabled — show TradeWorkDesk branding
            <>
              <Flame className="w-5 h-5 text-primary shrink-0" />
              <span className="text-lg font-bold tracking-tight text-foreground">TradeWorkDesk</span>
            </>
          )}
          {!isOnline && (
            <span className="ml-auto flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <WifiOff className="w-3 h-3" />
              Offline
            </span>
          )}
        </div>

        
        <div className="px-4 py-4 flex-1 overflow-y-auto space-y-1">
          {!isSuperAdmin && workNavItems.map((item) => renderNavLink(item))}

          {!isSuperAdmin && customerNavItems.length > 0 && renderSection("Customers", customerNavItems)}

          {!isSuperAdmin && websiteNavItems.length > 0 && renderSection("My Website", websiteNavItems)}

          {!isSuperAdmin && automationNavItems.length > 0 && renderSection("Grow", automationNavItems)}

          {isAdmin && !isSuperAdmin && renderSection("Admin", adminNavItems)}

          {isSuperAdmin && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 px-3">
                Platform
              </p>
              {platformNavItems.map((item) => renderNavLink(item))}
            </div>
          )}
        </div>

        {/* Utility footer: Reports, Tools, Help */}
        {!isSuperAdmin && (
          <div className="px-4 pb-2 pt-2 border-t border-border/30 space-y-0.5">
            {visibleUtilityItems.map((item) => renderNavLink(item))}
          </div>
        )}

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
          <Link href="/account">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground mb-1">
              <UserCog className="w-4 h-4 mr-2" />
              My Account
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground mb-1 text-xs"
            onClick={async () => {
              queryClient.clear();
              if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(n => caches.delete(n)));
              }
              if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) await reg.unregister();
              }
              window.location.reload();
            }}
            title="Clear cached data and reload"
          >
            <RefreshCcw className="w-3.5 h-3.5 mr-2" />
            Clear Cache
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          {isSuperAdmin ? (
            <>
              <Flame className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold tracking-tight text-foreground">TradeWorkDesk</span>
            </>
          ) : companySettings?.white_label_enabled && companySettings?.logo_url ? (
            <img
              src={companySettings.logo_url}
              alt={companySettings.trading_name ?? companySettings.name ?? "Logo"}
              className="h-8 w-auto max-w-[140px] object-contain"
            />
          ) : companySettings?.white_label_enabled ? (
            <>
              {(companySettings?.trading_name ?? companySettings?.name) ? (
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(companySettings.trading_name ?? companySettings.name ?? "?").charAt(0).toUpperCase()}
                </div>
              ) : (
                <Flame className="w-5 h-5 text-primary" />
              )}
              <span className="text-sm font-bold tracking-tight text-foreground truncate max-w-[160px]">
                {companySettings?.trading_name ?? companySettings?.name ?? "TradeWorkDesk"}
              </span>
            </>
          ) : (
            // White-label disabled — show TradeWorkDesk branding
            <>
              <Flame className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold tracking-tight text-foreground">TradeWorkDesk</span>
            </>
          )}
          {!isOnline && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <WifiOff className="w-3 h-3" />
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-16 overflow-y-auto">
          <div className="p-4 pb-16 space-y-2">
            {!isSuperAdmin && workNavItems.map((item) => renderNavLink(item, () => setIsMobileMenuOpen(false), true))}
            {!isSuperAdmin && customerNavItems.length > 0 && renderSection("Customers", customerNavItems, () => setIsMobileMenuOpen(false), true)}
            {!isSuperAdmin && websiteNavItems.length > 0 && renderSection("My Website", websiteNavItems, () => setIsMobileMenuOpen(false), true)}
            {!isSuperAdmin && automationNavItems.length > 0 && renderSection("Grow", automationNavItems, () => setIsMobileMenuOpen(false), true)}
            {isAdmin && !isSuperAdmin && renderSection("Admin", adminNavItems, () => setIsMobileMenuOpen(false), true)}
            {!isSuperAdmin && utilityNavItems.length > 0 && renderSection("More", utilityNavItems, () => setIsMobileMenuOpen(false), true)}
            {isSuperAdmin && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 px-4">
                  Platform
                </p>
                {platformNavItems.map((item) => renderNavLink(item, () => setIsMobileMenuOpen(false), true))}
              </div>
            )}
            <div className="pt-4 mt-4 border-t border-border space-y-2">
              <Button variant="ghost" className="w-full text-muted-foreground text-sm" onClick={async () => {
                queryClient.clear();
                if ('caches' in window) {
                  const names = await caches.keys();
                  await Promise.all(names.map(n => caches.delete(n)));
                }
                if ('serviceWorker' in navigator) {
                  const reg = await navigator.serviceWorker.getRegistration();
                  if (reg) await reg.unregister();
                }
                window.location.reload();
              }}>
                <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                Clear Cache
              </Button>
              <Link href="/account" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  <UserCog className="w-4 h-4 mr-2" />
                  My Account
                </Button>
              </Link>
              <Button variant="outline" className="w-full" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen flex flex-col min-w-0 w-full max-w-full">
        <OfflineBanner />

        {/* ── Tenant header bar ───────────────────────────────────────────── */}
        {showHeaderBar && (
          <div className="hidden md:flex items-center justify-center gap-1 px-6 py-2 border-b border-border/40 bg-card/60 text-sm">
            {hasWebsiteBuilder && tenantWebsiteUrl && (
              <a
                href={tenantWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Globe2 className="w-3.5 h-3.5" />
                My Website
              </a>
            )}
            {(profile?.role === 'admin' || profile?.role === 'office_staff') && (
              <Link href="/reports">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <FileBarChart className="w-3.5 h-3.5" />
                  Reports
                </button>
              </Link>
            )}
            <Link href={supportHref}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <MessageSquare className="w-3.5 h-3.5" />
                Support
              </button>
            </Link>
            <Link href="/tools">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <Wrench className="w-3.5 h-3.5" />
                Tools
              </button>
            </Link>
            <Link href="/help">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <HelpCircle className="w-3.5 h-3.5" />
                User Guide
              </button>
            </Link>
          </div>
        )}

        {isReadOnlySupportMode && (
          <div className="border-b-4 border-red-600 bg-red-50 px-4 py-3.5 flex flex-col gap-3 text-sm text-red-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold">
                <Lock className="w-5 h-5 shrink-0" />
                <span>⚠️ READ-ONLY SUPPORT MODE</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-red-300 hover:bg-red-100"
                onClick={() => {
                  localStorage.removeItem("superadmin_readonly_tenant_id");
                  queryClient.invalidateQueries({ queryKey: ["me-init"] });
                  queryClient.invalidateQueries({ queryKey: ["tenant-info"] });
                  window.location.href = "/platform";
                }}
              >
                Exit Support Mode
              </Button>
            </div>
            <div className="text-xs leading-relaxed">
              <p><strong>You are viewing {tenantInfo?.company_name || "a tenant"} for troubleshooting only.</strong></p>
              <p>No changes can be made. All write actions are blocked. Click "Exit" to return to platform admin.</p>
            </div>
          </div>
        )}

        {isTrial && trialDaysLeft !== null && !isSuperAdmin && (
          <div className={cn(
            "border-b px-4 py-3.5 flex flex-wrap items-center justify-center gap-3 text-sm",
            trialDaysLeft <= 7 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-blue-50 border-blue-200 text-blue-900"
          )}>
            {trialDaysLeft <= 7 ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
            <span className="font-medium">
              {trialDaysLeft > 0
                ? <>Free trial: <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong> left{trialEndsOn ? <> (ends {trialEndsOn})</> : null}.</>
                : <>Free trial has ended.</>}
            </span>
            <span className="text-xs opacity-90">
              When the trial ends, account access is locked until a paid plan is started.
            </span>
            {isAdmin && !isSuperAdmin && (
              <Link href="/billing">
                <Button size="sm" variant="default" className="h-7 text-xs">
                  <CreditCard className="w-3 h-3 mr-1" />
                  Start Paid Plan
                </Button>
              </Link>
            )}
          </div>
        )}

        {(isTrialExpiredSuspended || isNoPaidPlanSuspended) && !isTrial && !isSuperAdmin && (
          <div className="border-b border-amber-300 bg-amber-100/80 px-4 py-3.5 flex flex-wrap items-center justify-center gap-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-medium">Your free trial has ended. Account access is now locked.</span>
            <span className="text-xs opacity-90">Start a paid plan to restore full access.</span>
            {isAdmin && (
              <Link href="/billing">
                <Button size="sm" className="h-7 text-xs">
                  <CreditCard className="w-3 h-3 mr-1" />
                  Start Paid Plan
                </Button>
              </Link>
            )}
          </div>
        )}

        {(tenantInfo?.status === "payment_overdue" || tenantInfo?.status === "suspended") && !isSuperAdmin && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {(isTrialExpiredSuspended || isNoPaidPlanSuspended)
                ? <><strong>Trial ended.</strong> Start a paid plan to restore access.</>
                : tenantInfo.status === "payment_overdue"
                ? <><strong>Payment overdue.</strong> Please update your payment method to avoid service interruption.</>
                : <><strong>Account suspended.</strong> A payment may have failed. Please update your payment method to restore access.</>
              }
            </span>
            {isAdmin && (
              <Link href="/billing">
                <Button size="sm" variant="destructive" className="ml-2 h-7 text-xs">
                  <CreditCard className="w-3 h-3 mr-1" />
                  Update Payment
                </Button>
              </Link>
            )}
          </div>
        )}

        {!isSuperAdmin && visibleAnnouncements.map((a: { id: string; title: string; body: string; severity: string }) => (
          <div key={a.id} className={cn("border-b px-4 py-2.5 flex items-center gap-2 text-sm", severityClass(a.severity))}>
            {severityIcon(a.severity)}
            <span className="flex-1"><strong>{a.title}:</strong> {a.body}</span>
            <button
              onClick={() => setDismissedAnnouncements(prev => new Set(prev).add(a.id))}
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full min-w-0">
          {isLockedOut && !isOnAllowedPath ? (
            <LockedOutScreen
              accountSuspended={accountSuspended}
              accountCancelled={accountCancelled}
              trialExpired={isTrialExpiredSuspended || isNoPaidPlanSuspended}
              isAdmin={isAdmin}
              signOut={signOut}
            />
          ) : children}
        </div>
      </main>
    </div>
  );
}

function LockedOutScreen({ accountSuspended, accountCancelled, trialExpired, isAdmin, signOut }: {
  accountSuspended: boolean;
  accountCancelled: boolean;
  trialExpired: boolean;
  isAdmin: boolean;
  signOut: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6 p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {accountSuspended && (trialExpired ? "Trial ended" : "Account suspended")}
          {accountCancelled && "Account cancelled"}
        </h1>
        <p className="text-muted-foreground">
          {accountSuspended && (trialExpired
            ? "Your trial period has ended. Start a paid plan to restore access to the app."
            : "Your account has been suspended due to a payment issue. Please update your payment method to restore access.")}
          {accountCancelled && "This account has been cancelled. Please contact support if you believe this is an error."}
        </p>
        {isAdmin && accountSuspended && (
          <Link href="/billing">
            <Button size="lg" className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              {trialExpired ? "Start Paid Plan" : "Update Payment"}
            </Button>
          </Link>
        )}
        {!isAdmin && (
          <p className="text-sm text-muted-foreground">
            Please ask your company admin to upgrade the plan.
          </p>
        )}
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/account" className="text-sm text-primary hover:underline">
            Account Settings
          </Link>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:underline">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
