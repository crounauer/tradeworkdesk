import { lazy, Suspense, Component as ReactComponent } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { PortalAuthProvider, usePortalAuth } from "@/hooks/use-portal-auth";
import { Layout } from "@/components/layout";
import { ToolsPublicLayout } from "@/components/tools-public-layout";
import { OfflineProvider } from "@/contexts/offline-context";

async function clearSwAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      // Also clear all caches so stale precache entries are purged
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (_) {
    // Ignore — still reload even if SW unregister fails
  }
  window.location.reload();
}

function lazyRetry(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    importFn().catch(async () => {
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        await clearSwAndReload();
        // clearSwAndReload navigates away, so this line is a fallback
        return importFn();
      }
      sessionStorage.removeItem("chunk_reload");
      return importFn();
    })
  );
}

class ChunkErrorBoundary extends ReactComponent<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (error.message?.includes("Loading chunk") || error.message?.includes("Failed to fetch") || error.message?.includes("dynamically imported module") || error.message?.includes("MIME type")) {
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        clearSwAndReload();
      } else {
        sessionStorage.removeItem("chunk_reload");
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">Something went wrong loading this page.</p>
            <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm" onClick={() => window.location.reload()}>Reload Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Login = lazyRetry(() => import("@/pages/login"));
const Dashboard = lazyRetry(() => import("@/pages/dashboard"));
const Customers = lazyRetry(() => import("@/pages/customers"));
const CustomerDetail = lazyRetry(() => import("@/pages/customer-detail"));
const Properties = lazyRetry(() => import("@/pages/properties"));
const PropertyDetail = lazyRetry(() => import("@/pages/property-detail"));
const Jobs = lazyRetry(() => import("@/pages/jobs"));
const JobDetail = lazyRetry(() => import("@/pages/job-detail"));
const ServiceRecordForm = lazyRetry(() => import("@/pages/service-record-form"));
const BreakdownReportForm = lazyRetry(() => import("@/pages/breakdown-report-form"));
const CommissioningRecordForm = lazyRetry(() => import("@/pages/commissioning-record-form"));
const OilTankInspectionForm = lazyRetry(() => import("@/pages/oil-tank-inspection-form"));
const OilTankRiskAssessmentForm = lazyRetry(() => import("@/pages/oil-tank-risk-assessment-form"));
const CombustionAnalysisForm = lazyRetry(() => import("@/pages/combustion-analysis-form"));
const BurnerSetupForm = lazyRetry(() => import("@/pages/burner-setup-form"));
const FireValveTestForm = lazyRetry(() => import("@/pages/fire-valve-test-form"));
const OilLineVacuumTestForm = lazyRetry(() => import("@/pages/oil-line-vacuum-test-form"));
const JobCompletionReportForm = lazyRetry(() => import("@/pages/job-completion-report-form"));
const HeatPumpServiceForm = lazyRetry(() => import("@/pages/heat-pump-service-form"));
const HeatPumpCommissioningForm = lazyRetry(() => import("@/pages/heat-pump-commissioning-form"));
const JobFiles = lazyRetry(() => import("@/pages/job-files"));
const JobSignatures = lazyRetry(() => import("@/pages/job-signatures"));
const Reports = lazyRetry(() => import("@/pages/reports"));
const SearchPage = lazyRetry(() => import("@/pages/search"));
const AdminUsers = lazyRetry(() => import("@/pages/admin-users"));
const AdminInviteCodes = lazyRetry(() => import("@/pages/admin-invite-codes"));
const AdminLookupOptions = lazyRetry(() => import("@/pages/admin-lookup-options"));
const AdminCompanySettings = lazyRetry(() => import("@/pages/admin-company-settings"));
const AdminBranding = lazyRetry(() => import("@/pages/admin-branding"));
const AdminSocial = lazyRetry(() => import("@/pages/admin-social"));
const AdminJobTypes = lazyRetry(() => import("@/pages/admin-job-types"));
const AdminSmsTemplates = lazyRetry(() => import("@/pages/admin-sms-templates"));
const AdminReassignJobs = lazyRetry(() => import("@/pages/admin-reassign-jobs"));
const AdminInvoiceLog = lazyRetry(() => import("@/pages/admin-invoice-log"));
const AdminStripeConnect = lazyRetry(() => import("@/pages/admin-stripe-connect"));
const AdminPaymentProviders = lazyRetry(() => import("@/pages/admin-payment-providers"));
const Register = lazyRetry(() => import("@/pages/register"));
const PlatformDashboard = lazyRetry(() => import("@/pages/platform-dashboard"));
const PlatformTenants = lazyRetry(() => import("@/pages/platform-tenants"));
const PlatformTenantDetail = lazyRetry(() => import("@/pages/platform-tenant-detail"));
const PlatformAnnouncements = lazyRetry(() => import("@/pages/platform-announcements"));
const PlatformAuditLog = lazyRetry(() => import("@/pages/platform-audit-log"));
const PlatformBetaInvites = lazyRetry(() => import("@/pages/platform-beta-invites"));
const PlatformAddons = lazyRetry(() => import("@/pages/platform-addons"));
const PlatformPlans = lazyRetry(() => import("@/pages/platform-plans"));
const PlatformSettingsPage = lazyRetry(() => import("@/pages/platform-settings"));
const PlatformTemplatesPage = lazyRetry(() => import("@/pages/platform-templates"));
const QuickRecord = lazyRetry(() => import("@/pages/quick-record"));
const Enquiries = lazyRetry(() => import("@/pages/enquiries"));
const EnquiryDetail = lazyRetry(() => import("@/pages/enquiry-detail"));
const FollowUps = lazyRetry(() => import("@/pages/follow-ups"));
const SchedulePage = lazyRetry(() => import("@/pages/schedule"));
const Billing = lazyRetry(() => import("@/pages/billing"));
const AccountSettings = lazyRetry(() => import("@/pages/account-settings"));
const NotFound = lazyRetry(() => import("@/pages/not-found"));
const Todos = lazyRetry(() => import("@/pages/todos"));
const Invoices = lazyRetry(() => import("@/pages/invoices"));
const InvoiceDetail = lazyRetry(() => import("@/pages/invoice-detail"));
const HelpPage = lazyRetry(() => import("@/pages/help"));

const WebsiteSetup = lazyRetry(() => import("@/pages/website-setup"));
const WebsitePages = lazyRetry(() => import("@/pages/website-pages"));
const WebsitePageEditor = lazyRetry(() => import("@/pages/website-page-editor"));
const WebsiteDomain = lazyRetry(() => import("@/pages/website-domain"));
const WebsiteSettings = lazyRetry(() => import("@/pages/website-settings"));
const WebsiteBlog = lazyRetry(() => import("@/pages/website-blog"));
const WebsitePreview = lazyRetry(() => import("@/pages/website-preview"));

const Bookings = lazyRetry(() => import("@/pages/bookings"));
const BookingSetup = lazyRetry(() => import("@/pages/booking-setup"));
const ReviewRequests = lazyRetry(() => import("@/pages/review-requests"));
const MaintenancePlans = lazyRetry(() => import("@/pages/maintenance-plans"));
const EmailCampaigns = lazyRetry(() => import("@/pages/email-campaigns"));
const MissedCallSettings = lazyRetry(() => import("@/pages/missed-call-settings"));

const ToolsIndex = lazyRetry(() => import("@/pages/tools/index"));
const RadiatorSizing = lazyRetry(() => import("@/pages/tools/radiator-sizing"));
const OilTankLocation = lazyRetry(() => import("@/pages/tools/oil-tank-location"));
const VentilationCalculator = lazyRetry(() => import("@/pages/tools/ventilation-calculator"));
const FlueSiting = lazyRetry(() => import("@/pages/tools/flue-siting"));
const GasFlueSiting = lazyRetry(() => import("@/pages/tools/gas-flue-siting"));
const CondensatePipe = lazyRetry(() => import("@/pages/tools/condensate-pipe"));
const ExpansionVessel = lazyRetry(() => import("@/pages/tools/expansion-vessel"));
const PumpHead = lazyRetry(() => import("@/pages/tools/pump-head"));

const PortalLogin = lazyRetry(() => import("@/pages/portal/portal-login"));
const PortalRegister = lazyRetry(() => import("@/pages/portal/portal-register"));
const PortalDashboard = lazyRetry(() => import("@/pages/portal/portal-dashboard"));
const PortalProperties = lazyRetry(() => import("@/pages/portal/portal-properties"));
const PortalPropertyDetail = lazyRetry(() => import("@/pages/portal/portal-property-detail"));
const PortalJobs = lazyRetry(() => import("@/pages/portal/portal-jobs"));
const PortalJobDetail = lazyRetry(() => import("@/pages/portal/portal-job-detail"));
const PortalInvoices = lazyRetry(() => import("@/pages/portal/portal-invoices"));

const HomePage = lazyRetry(() => import("@/pages/marketing/home"));
const FeaturesPage = lazyRetry(() => import("@/pages/marketing/features"));
const PricingPage = lazyRetry(() => import("@/pages/marketing/pricing"));
const AboutPage = lazyRetry(() => import("@/pages/marketing/about"));
const ContactPage = lazyRetry(() => import("@/pages/marketing/contact"));
const TradeLandingPage = lazyRetry(() => import("@/pages/marketing/trade-landing"));
const IndustriesPage = lazyRetry(() => import("@/pages/marketing/industries"));
const AlternativesPage = lazyRetry(() => import("@/pages/marketing/alternatives"));
const BlogIndex = lazyRetry(() => import("@/pages/marketing/blog-index"));
const BlogPostPage = lazyRetry(() => import("@/pages/marketing/blog-post"));
const PrivacyPolicyPage = lazyRetry(() => import("@/pages/marketing/privacy-policy"));
const TermsOfServicePage = lazyRetry(() => import("@/pages/marketing/terms-of-service"));
const DirectoryPage = lazyRetry(() => import("@/pages/marketing/directory"));
const BusinessProfilePage = lazyRetry(() => import("@/pages/marketing/business-profile"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (_error) => {},
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 30,
    },
  },
});

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="animate-pulse flex flex-col items-center">
      <div className="w-12 h-12 bg-primary rounded-xl mb-4" />
      <div className="h-4 w-32 bg-slate-200 rounded" />
    </div>
  </div>
);

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { session, isLoading, profile, mfaPending } = useAuth();

  if (isLoading) return <PageFallback />;
  if (!session) return <Redirect to="/login" />;
  if (mfaPending) return <Redirect to="/login" />;

  if (roles) {
    if (!profile) return <PageFallback />;
    if (!roles.includes(profile.role)) return <Redirect to="/dashboard" />;
  }

  return (
    <Layout>
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        <Component />
      </Suspense>
    </Layout>
  );
}

function PublicToolRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, isLoading } = useAuth();
  if (isLoading) return <PageFallback />;
  if (session) {
    return (
      <Layout>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <Component />
        </Suspense>
      </Layout>
    );
  }
  return (
    <ToolsPublicLayout>
      <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        <Component />
      </Suspense>
    </ToolsPublicLayout>
  );
}

function PublicPage<P extends Record<string, unknown>>({ component: Component, ...props }: { component: React.ComponentType<P> } & P) {  return (
    <Suspense fallback={<PageFallback />}>
      <Component {...(props as P)} />
    </Suspense>
  );
}

function RootRoute() {
  const { session, isLoading, mfaPending, profile, profileReady } = useAuth();

  if (isLoading) return <PageFallback />;
  if (mfaPending) return <Redirect to="/login" />;

  if (session && !profileReady) return <PageFallback />;

  if (session && profile?.role === "super_admin") {
    return <Redirect to="/platform" />;
  }

  if (session) {
    return (
      <Layout>
        <Dashboard />
      </Layout>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <HomePage />
    </Suspense>
  );
}

function PortalProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, isLoading } = usePortalAuth();

  if (isLoading) return <PageFallback />;
  if (!session) return <Redirect to="/portal/login" />;

  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <Component />
    </Suspense>
  );
}

// ─── Stable module-level route components ────────────────────────────────────
// Inline arrow functions like `() => <ProtectedRoute component={X} />` inside
// AppRouter create a new component type on every render, causing React to
// unmount and remount the page (resetting all local state). Defining wrappers
// here gives every route a permanent stable identity.

function protect(C: React.ComponentType, roles?: string[]) {
  return function ProtectedPage() { return <ProtectedRoute component={C} roles={roles} />; };
}
function pub(C: React.ComponentType, extra?: Record<string, unknown>) {
  return function PublicPageRoute() { return <PublicPage component={C} {...(extra as Record<string, unknown>)} />; };
}
function tool(C: React.ComponentType) {
  return function ToolRoute() { return <PublicToolRoute component={C} />; };
}
function portalPage(C: React.ComponentType) {
  return function PortalRoute() { return <PortalProtectedRoute component={C} />; };
}

const PortalLoginRoute = () => <Suspense fallback={<PageFallback />}><PortalLogin /></Suspense>;
const PortalRegisterRoute = () => <Suspense fallback={<PageFallback />}><PortalRegister /></Suspense>;
const PortalDashboardRoute = portalPage(PortalDashboard);
const PortalPropertiesRoute = portalPage(PortalProperties);
const PortalPropertyDetailRoute = portalPage(PortalPropertyDetail);
const PortalJobsRoute = portalPage(PortalJobs);
const PortalJobDetailRoute = portalPage(PortalJobDetail);
const PortalInvoicesRoute = portalPage(PortalInvoices);

const FeaturesRoute = pub(FeaturesPage);
const PricingRoute = pub(PricingPage);
const AboutRoute = pub(AboutPage);
const ContactRoute = pub(ContactPage);
const BlogRoute = pub(BlogIndex);
const BlogPostRoute = pub(BlogPostPage);
const GasEngineerRoute = pub(TradeLandingPage, { slug: "gas-engineer-software" });
const BoilerServiceRoute = pub(TradeLandingPage, { slug: "boiler-service-management-software" });
const JobMgmtHeatingRoute = pub(TradeLandingPage, { slug: "job-management-software-heating-engineers" });
const OilEngineerRoute = pub(TradeLandingPage, { slug: "oil-engineer-software" });
const HeatPumpEngineerRoute = pub(TradeLandingPage, { slug: "heat-pump-engineer-software" });
const PlumberRoute = pub(TradeLandingPage, { slug: "plumber-software" });
const LandlordGasRoute = pub(TradeLandingPage, { slug: "landlord-gas-safety-software" });
const SoleTraderRoute = pub(TradeLandingPage, { slug: "sole-trader-software" });
const HeatingCompanyRoute = pub(TradeLandingPage, { slug: "heating-company-software" });
const IndustriesRoute = pub(IndustriesPage);
const AlternativesRoute = pub(AlternativesPage);
const FindRoute = pub(DirectoryPage);
const FindSlugRoute = pub(BusinessProfilePage);
const PrivacyRoute = pub(PrivacyPolicyPage);
const TermsRoute = pub(TermsOfServicePage);

const CustomersRoute = protect(Customers);
const CustomerDetailRoute = protect(CustomerDetail);
const PropertiesRoute = protect(Properties);
const PropertyDetailRoute = protect(PropertyDetail);
const JobsRoute = protect(Jobs);
const JobDetailRoute = protect(JobDetail);
const ServiceRecordRoute = protect(ServiceRecordForm);
const BreakdownReportRoute = protect(BreakdownReportForm);
const CommissioningRoute = protect(CommissioningRecordForm);
const OilTankInspectionRoute = protect(OilTankInspectionForm);
const OilTankRiskAssessmentRoute = protect(OilTankRiskAssessmentForm);
const CombustionAnalysisRoute = protect(CombustionAnalysisForm);
const BurnerSetupRoute = protect(BurnerSetupForm);
const FireValveTestRoute = protect(FireValveTestForm);
const OilLineVacuumTestRoute = protect(OilLineVacuumTestForm);
const JobCompletionRoute = protect(JobCompletionReportForm);
const HeatPumpServiceRoute = protect(HeatPumpServiceForm);
const HeatPumpCommissioningRoute = protect(HeatPumpCommissioningForm);
const JobFilesRoute = protect(JobFiles);
const JobSignaturesRoute = protect(JobSignatures);
const ScheduleRoute = protect(SchedulePage);
const FollowUpsRoute = protect(FollowUps);
const EnquiriesRoute = protect(Enquiries);
const EnquiryDetailRoute = protect(EnquiryDetail);
const QuickRecordRoute = protect(QuickRecord);
const SearchRoute = protect(SearchPage);
const ReportsRoute = protect(Reports);
const AdminCompanySettingsRoute = protect(AdminCompanySettings);
const AdminBrandingRoute = protect(AdminBranding);
const AdminUsersRoute = protect(AdminUsers);
const AdminInviteCodesRoute = protect(AdminInviteCodes);
const AdminLookupOptionsRoute = protect(AdminLookupOptions);
const AdminSocialRoute = protect(AdminSocial, ["admin", "super_admin"]);
const AdminSmsTemplatesRoute = protect(AdminSmsTemplates, ["admin", "super_admin"]);
const AdminReassignJobsRoute = protect(AdminReassignJobs, ["admin"]);
const AdminJobTypesRoute = protect(AdminJobTypes, ["admin"]);
const AdminInvoiceLogRoute = protect(AdminInvoiceLog, ["admin", "office_staff"]);
const AdminStripeConnectRoute = protect(AdminStripeConnect, ["admin"]);
const AdminPaymentProvidersRoute = protect(AdminPaymentProviders, ["admin"]);
const BillingRoute = protect(Billing);
const AccountRoute = protect(AccountSettings);
const TodosRoute = protect(Todos);
const InvoicesRoute = protect(Invoices);
const InvoiceDetailRoute = protect(InvoiceDetail);
const HelpRoute = protect(HelpPage);
const WebsiteSetupRoute = protect(WebsiteSetup);
const WebsitePagesRoute = protect(WebsitePages);
const WebsitePageEditorRoute = protect(WebsitePageEditor);
const WebsiteDomainRoute = protect(WebsiteDomain);
const WebsiteSettingsRoute = protect(WebsiteSettings);
const WebsiteBlogRoute = protect(WebsiteBlog);
const WebsitePreviewRoute = protect(WebsitePreview);
const BookingsRoute = protect(Bookings);
const BookingSetupRoute = protect(BookingSetup);
const ReviewRequestsRoute = protect(ReviewRequests);
const MaintenancePlansRoute = protect(MaintenancePlans);
const EmailCampaignsRoute = protect(EmailCampaigns);
const MissedCallRoute = protect(MissedCallSettings);
const ToolsIndexRoute = tool(ToolsIndex);
const RadiatorSizingRoute = tool(RadiatorSizing);
const OilTankLocationRoute = tool(OilTankLocation);
const VentilationCalculatorRoute = tool(VentilationCalculator);
const FlueSitingRoute = tool(FlueSiting);
const GasFlueSitingRoute = tool(GasFlueSiting);
const CondensatePipeRoute = tool(CondensatePipe);
const ExpansionVesselRoute = tool(ExpansionVessel);
const PumpHeadRoute = tool(PumpHead);
const PlatformDashboardRoute = protect(PlatformDashboard, ["super_admin"]);
const PlatformTenantDetailRoute = protect(PlatformTenantDetail, ["super_admin"]);
const PlatformTenantsRoute = protect(PlatformTenants, ["super_admin"]);
const PlatformAddonsRoute = protect(PlatformAddons, ["super_admin"]);
const PlatformPlansRoute = protect(PlatformPlans, ["super_admin"]);
const PlatformAnnouncementsRoute = protect(PlatformAnnouncements, ["super_admin"]);
const PlatformBetaInvitesRoute = protect(PlatformBetaInvites, ["super_admin"]);
const PlatformAuditLogRoute = protect(PlatformAuditLog, ["super_admin"]);
const PlatformSettingsRoute = protect(PlatformSettingsPage, ["super_admin"]);
const PlatformTemplatesRoute = protect(PlatformTemplatesPage, ["super_admin"]);
const NotFoundRoute = () => <Suspense fallback={<PageFallback />}><NotFound /></Suspense>;

function PortalRoutes() {
  return (
    <PortalAuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/portal/login" component={PortalLoginRoute} />
          <Route path="/portal/register" component={PortalRegisterRoute} />
          <Route path="/portal" component={PortalDashboardRoute} />
          <Route path="/portal/properties" component={PortalPropertiesRoute} />
          <Route path="/portal/properties/:id" component={PortalPropertyDetailRoute} />
          <Route path="/portal/jobs" component={PortalJobsRoute} />
          <Route path="/portal/jobs/:id" component={PortalJobDetailRoute} />
          <Route path="/portal/invoices" component={PortalInvoicesRoute} />
        </Switch>
      </Suspense>
    </PortalAuthProvider>
  );
}

function AppRouter() {
  const { session, mfaPending } = useAuth();

  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/portal" component={PortalRoutes} />
        <Route path="/portal/:rest*" component={PortalRoutes} />

        <Route path="/login">
          {session && !mfaPending ? <Redirect to="/" /> : <Login />}
        </Route>

        <Route path="/register">
          {session ? <Redirect to="/" /> : <Register />}
        </Route>

        <Route path="/" component={RootRoute} />

        <Route path="/features" component={FeaturesRoute} />
        <Route path="/pricing" component={PricingRoute} />
        <Route path="/about" component={AboutRoute} />
        <Route path="/contact" component={ContactRoute} />
        <Route path="/blog" component={BlogRoute} />
        <Route path="/blog/:slug" component={BlogPostRoute} />
        <Route path="/gas-engineer-software" component={GasEngineerRoute} />
        <Route path="/boiler-service-management-software" component={BoilerServiceRoute} />
        <Route path="/job-management-software-heating-engineers" component={JobMgmtHeatingRoute} />
        <Route path="/oil-engineer-software" component={OilEngineerRoute} />
        <Route path="/heat-pump-engineer-software" component={HeatPumpEngineerRoute} />
        <Route path="/plumber-software" component={PlumberRoute} />
        <Route path="/landlord-gas-safety-software" component={LandlordGasRoute} />
        <Route path="/sole-trader-software" component={SoleTraderRoute} />
        <Route path="/heating-company-software" component={HeatingCompanyRoute} />
        <Route path="/industries" component={IndustriesRoute} />
        <Route path="/alternatives" component={AlternativesRoute} />
        <Route path="/find" component={FindRoute} />
        <Route path="/find/:slug" component={FindSlugRoute} />
        <Route path="/privacy-policy" component={PrivacyRoute} />
        <Route path="/terms-of-service" component={TermsRoute} />

        <Route path="/customers" component={CustomersRoute} />
        <Route path="/customers/:id" component={CustomerDetailRoute} />

        <Route path="/properties" component={PropertiesRoute} />
        <Route path="/properties/:id" component={PropertyDetailRoute} />

        <Route path="/jobs" component={JobsRoute} />
        <Route path="/jobs/:id" component={JobDetailRoute} />
        <Route path="/jobs/:jobId/service-record" component={ServiceRecordRoute} />
        <Route path="/jobs/:jobId/breakdown-report" component={BreakdownReportRoute} />
        <Route path="/jobs/:jobId/commissioning" component={CommissioningRoute} />
        <Route path="/jobs/:jobId/oil-tank-inspection" component={OilTankInspectionRoute} />
        <Route path="/jobs/:jobId/oil-tank-risk-assessment" component={OilTankRiskAssessmentRoute} />
        <Route path="/jobs/:jobId/combustion-analysis" component={CombustionAnalysisRoute} />
        <Route path="/jobs/:jobId/burner-setup" component={BurnerSetupRoute} />
        <Route path="/jobs/:jobId/fire-valve-test" component={FireValveTestRoute} />
        <Route path="/jobs/:jobId/oil-line-vacuum-test" component={OilLineVacuumTestRoute} />
        <Route path="/jobs/:jobId/job-completion" component={JobCompletionRoute} />
        <Route path="/jobs/:jobId/heat-pump-service" component={HeatPumpServiceRoute} />
        <Route path="/jobs/:jobId/heat-pump-commissioning" component={HeatPumpCommissioningRoute} />
        <Route path="/jobs/:jobId/files" component={JobFilesRoute} />
        <Route path="/jobs/:jobId/signatures" component={JobSignaturesRoute} />

        <Route path="/schedule" component={ScheduleRoute} />
        <Route path="/follow-ups" component={FollowUpsRoute} />
        <Route path="/enquiries" component={EnquiriesRoute} />
        <Route path="/enquiries/:id" component={EnquiryDetailRoute} />
        <Route path="/quick-record" component={QuickRecordRoute} />
        <Route path="/search" component={SearchRoute} />
        <Route path="/reports" component={ReportsRoute} />

        <Route path="/admin/company-settings" component={AdminCompanySettingsRoute} />
        <Route path="/admin/branding" component={AdminBrandingRoute} />
        <Route path="/admin/users" component={AdminUsersRoute} />
        <Route path="/admin/invite-codes" component={AdminInviteCodesRoute} />
        <Route path="/admin/lookup-options" component={AdminLookupOptionsRoute} />
        <Route path="/admin/social" component={AdminSocialRoute} />
        <Route path="/admin/sms-templates" component={AdminSmsTemplatesRoute} />
        <Route path="/admin/reassign-jobs" component={AdminReassignJobsRoute} />
        <Route path="/admin/job-types" component={AdminJobTypesRoute} />
        <Route path="/admin/invoice-log" component={AdminInvoiceLogRoute} />
        <Route path="/admin/stripe-connect" component={AdminStripeConnectRoute} />
        <Route path="/admin/payment-providers" component={AdminPaymentProvidersRoute} />

        <Route path="/billing" component={BillingRoute} />
        <Route path="/account" component={AccountRoute} />
        <Route path="/todos" component={TodosRoute} />
        <Route path="/invoices" component={InvoicesRoute} />
        <Route path="/invoices/:id" component={InvoiceDetailRoute} />
        <Route path="/help" component={HelpRoute} />

        <Route path="/website" component={WebsiteSetupRoute} />
        <Route path="/website/preview" component={WebsitePreviewRoute} />
        <Route path="/website/pages" component={WebsitePagesRoute} />
        <Route path="/website/pages/:pageId" component={WebsitePageEditorRoute} />
        <Route path="/website/domain" component={WebsiteDomainRoute} />
        <Route path="/website/settings" component={WebsiteSettingsRoute} />
        <Route path="/website/blog" component={WebsiteBlogRoute} />

        <Route path="/booking" component={BookingsRoute} />
        <Route path="/booking/setup" component={BookingSetupRoute} />
        <Route path="/review-requests" component={ReviewRequestsRoute} />

        <Route path="/maintenance" component={MaintenancePlansRoute} />
        <Route path="/campaigns" component={EmailCampaignsRoute} />
        <Route path="/missed-call" component={MissedCallRoute} />

        <Route path="/tools" component={ToolsIndexRoute} />
        <Route path="/tools/radiator-sizing" component={RadiatorSizingRoute} />
        <Route path="/tools/oil-tank-location" component={OilTankLocationRoute} />
        <Route path="/tools/ventilation-calculator" component={VentilationCalculatorRoute} />
        <Route path="/tools/flue-siting" component={FlueSitingRoute} />
        <Route path="/tools/gas-flue-siting" component={GasFlueSitingRoute} />
        <Route path="/tools/condensate-pipe" component={CondensatePipeRoute} />
        <Route path="/tools/expansion-vessel" component={ExpansionVesselRoute} />
        <Route path="/tools/pump-head" component={PumpHeadRoute} />

        <Route path="/platform" component={PlatformDashboardRoute} />
        <Route path="/platform/tenants/:id" component={PlatformTenantDetailRoute} />
        <Route path="/platform/tenants" component={PlatformTenantsRoute} />
        <Route path="/platform/addons" component={PlatformAddonsRoute} />
        <Route path="/platform/plans" component={PlatformPlansRoute} />
        <Route path="/platform/announcements" component={PlatformAnnouncementsRoute} />
        <Route path="/platform/beta-invites" component={PlatformBetaInvitesRoute} />
        <Route path="/platform/audit-log" component={PlatformAuditLogRoute} />
        <Route path="/platform/settings" component={PlatformSettingsRoute} />
        <Route path="/platform/templates" component={PlatformTemplatesRoute} />

        <Route component={NotFoundRoute} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OfflineProvider>
          <TooltipProvider>
            <ChunkErrorBoundary>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AppRouter />
              </WouterRouter>
            </ChunkErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </OfflineProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
