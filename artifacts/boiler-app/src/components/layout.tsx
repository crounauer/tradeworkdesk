import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useInitData } from "@/hooks/use-init-data";
import { useHomepageData } from "@/hooks/use-homepage-data";
import { 
  LayoutDashboard, Users, Home, Flame, 
  Briefcase, FileBarChart, Search, LogOut, Menu, X,
  ShieldCheck, UserPlus, Settings2, Building2,
  Globe, CreditCard, Megaphone, ScrollText, AlertTriangle, Info, AlertCircle, Share2, ListTree,
  Zap, MessageSquarePlus, UserCog, FileText, WifiOff, Ticket, Lock, ClipboardList, HardDrive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { OfflineBanner } from "./offline-indicator";
import { useOffline } from "@/contexts/offline-context";
import { useOfflineReferenceDataSync } from "@/hooks/use-offline-data";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut } = useAuth();
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
  useOfflineReferenceDataSync();

  const isSuperAdmin = profile?.role === "super_admin";
  const isAdmin = profile?.role === "admin" || isSuperAdmin;
  const { hasFeature, hasAddon, isFormsOnly } = usePlanFeatures();

  const { data: initData } = useInitData();
  const tenantInfo = initData?.tenant ?? null;

  const hasJobManagement = hasFeature("job_management");

  const enquiryCountData = { count: initData?.enquiriesCount ?? 0 };
  const overdueFollowUpsCount = initData?.overdueFollowUpsCount ?? 0;
  const activeFollowUpsCount = initData?.activeFollowUpsCount ?? 0;

  const announcements = initData?.announcements || [];
  const { data: homepageData } = useHomepageData();

  const isTrial = tenantInfo?.status === "trial";

  const trialDaysLeft = tenantInfo?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenantInfo.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const accountSuspended = tenantInfo?.status === "suspended";
  const accountCancelled = tenantInfo?.status === "cancelled";
  const isLockedOut = !isSuperAdmin && (accountSuspended || accountCancelled);
  const allowedLockedPaths = ["/billing", "/account"];
  const isOnAllowedPath = allowedLockedPaths.some(p => location === p || location.startsWith(p + "/"));

  const visibleAnnouncements = (announcements || []).filter(
    (a: { id: string }) => !dismissedAnnouncements.has(a.id)
  );

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/properties", label: "Properties", icon: Home },
    ...(isFormsOnly ? [
      { href: "/quick-record", label: "Quick Record", icon: Zap },
    ] : [
      ...(hasFeature("job_management") ? [{ href: "/enquiries", label: "Enquiries", icon: MessageSquarePlus }] : []),
      { href: "/jobs", label: "Jobs", icon: Briefcase },
      ...(hasFeature("job_management") ? [{ href: "/follow-ups", label: "Follow-Ups", icon: ClipboardList }] : []),
      { href: "/search", label: "Search", icon: Search },
    ]),
    ...(hasFeature("reports") ? [
      { href: "/reports", label: "Reports", icon: FileBarChart, roles: ['admin', 'office_staff', 'super_admin'] as string[] },
    ] : []),
  ];

  const isCompanyType = tenantInfo?.company_type === "company";

  const adminNavItems = [
    { href: "/billing", label: "Billing", icon: CreditCard, roles: ["admin"] },
    { href: "/admin/company-settings", label: "Company Settings", icon: Building2 },
    ...(hasFeature("team_management") && isCompanyType ? [
      { href: "/admin/users", label: "Team", icon: ShieldCheck },
      ...(hasAddon("additional_users") ? [
        { href: "/admin/invite-codes", label: "Invite Codes", icon: UserPlus },
      ] : []),
      { href: "/admin/reassign-jobs", label: "Reassign Jobs", icon: Briefcase },
    ] : []),
    { href: "/admin/job-types", label: "Job Types", icon: ListTree },
    { href: "/admin/invoice-log", label: "Invoice Log", icon: FileText },
    { href: "/admin/lookup-options", label: "Lookup Options", icon: Settings2 },
    ...(hasFeature("social_media") ? [
      { href: "/admin/social", label: "Social Media", icon: Share2 },
    ] : []),
  ];

  const platformNavItems = [
    { href: "/platform", label: "Overview", icon: Globe },
    { href: "/platform/tenants", label: "Companies", icon: Building2 },
    { href: "/platform/addons", label: "Add-ons", icon: Zap },
    { href: "/platform/settings", label: "Settings", icon: Settings2 },
    { href: "/platform/beta-invites", label: "Beta Invites", icon: Ticket },
    { href: "/platform/announcements", label: "Announcements", icon: Megaphone },
    { href: "/platform/audit-log", label: "Audit Log", icon: ScrollText },
  ];

  const visibleNavItems = navItems.filter(item => 
    !item.roles || (profile && item.roles.includes(profile.role))
  );

  const openEnquiryCount = enquiryCountData?.count || 0;

  const renderNavLink = (item: { href: string; label: string; icon: React.ElementType }, onClick?: () => void, mobile?: boolean) => {
    const isActive = item.href === "/" 
      ? location === "/" 
      : location === item.href || location.startsWith(item.href + "/");
    const enquiryBadge = item.href === "/enquiries" && openEnquiryCount > 0 ? openEnquiryCount : null;
    const followUpBadge = item.href === "/follow-ups" && activeFollowUpsCount > 0 ? activeFollowUpsCount : null;
    const badge = enquiryBadge || followUpBadge;
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
            followUpBadge ? "bg-blue-500" : "bg-orange-500"
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

  const renderStorageIndicator = (mobile?: boolean) => {
    const storage = homepageData?.storage;
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
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-card border-r border-border shadow-sm">
        <div className="px-6 py-5 flex items-center gap-2.5 border-b border-border/50">
          <Flame className="w-5 h-5 text-primary shrink-0" />
          <span className="text-lg font-bold tracking-tight text-foreground">TradeWorkDesk</span>
          {!isOnline && (
            <span className="ml-auto flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <WifiOff className="w-3 h-3" />
              Offline
            </span>
          )}
        </div>

        
        <div className="px-4 py-4 flex-1 overflow-y-auto space-y-1">
          {!isSuperAdmin && visibleNavItems.map((item) => renderNavLink(item))}

          {renderStorageIndicator()}

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
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-primary" />
          <span className="text-lg font-bold tracking-tight text-foreground">TradeWorkDesk</span>
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
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-16">
          <div className="p-4 space-y-2">
            {!isSuperAdmin && visibleNavItems.map((item) => renderNavLink(item, () => setIsMobileMenuOpen(false), true))}
            {renderStorageIndicator(true)}
            {isAdmin && !isSuperAdmin && renderSection("Admin", adminNavItems, () => setIsMobileMenuOpen(false), true)}
            {isSuperAdmin && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 px-4">
                  Platform
                </p>
                {platformNavItems.map((item) => renderNavLink(item, () => setIsMobileMenuOpen(false), true))}
              </div>
            )}
            <div className="pt-4 mt-4 border-t border-border space-y-2">
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

        {isTrial && trialDaysLeft !== null && trialDaysLeft > 0 && !isSuperAdmin && (
          <div className={cn(
            "border-b px-4 py-2.5 flex flex-wrap items-center justify-center gap-2 text-sm",
            trialDaysLeft <= 7 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-800"
          )}>
            {trialDaysLeft <= 7 ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
            <span>
              Your trial expires in <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong>.
            </span>
            {isAdmin && !isSuperAdmin && (
              <Link href="/billing">
                <Button size="sm" variant={trialDaysLeft <= 7 ? "default" : "outline"} className="h-7 text-xs">
                  <CreditCard className="w-3 h-3 mr-1" />
                  Upgrade Plan
                </Button>
              </Link>
            )}
          </div>
        )}

        {(tenantInfo?.status === "payment_overdue" || tenantInfo?.status === "suspended") && !isSuperAdmin && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {tenantInfo.status === "payment_overdue"
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
              isAdmin={isAdmin}
              signOut={signOut}
            />
          ) : children}
        </div>
      </main>
    </div>
  );
}

function LockedOutScreen({ accountSuspended, accountCancelled, isAdmin, signOut }: {
  accountSuspended: boolean;
  accountCancelled: boolean;
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
          {accountSuspended && "Account suspended"}
          {accountCancelled && "Account cancelled"}
        </h1>
        <p className="text-muted-foreground">
          {accountSuspended && "Your account has been suspended due to a payment issue. Please update your payment method to restore access."}
          {accountCancelled && "This account has been cancelled. Please contact support if you believe this is an error."}
        </p>
        {isAdmin && accountSuspended && (
          <Link href="/billing">
            <Button size="lg" className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              Update Payment
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
