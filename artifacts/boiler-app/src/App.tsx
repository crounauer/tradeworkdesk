import { lazy, Suspense, Component as ReactComponent } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { PortalAuthProvider, usePortalAuth } from "@/hooks/use-portal-auth";
import { Layout } from "@/components/layout";
import { OfflineProvider } from "@/contexts/offline-context";

function lazyRetry(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    importFn().catch(() => {
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        window.location.reload();
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
    if (error.message?.includes("Loading chunk") || error.message?.includes("Failed to fetch") || error.message?.includes("dynamically imported module")) {
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        window.location.reload();
      }
      sessionStorage.removeItem("chunk_reload");
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
import Dashboard from "@/pages/dashboard";
const Customers = lazyRetry(() => import("@/pages/customers"));
const CustomerDetail = lazyRetry(() => import("@/pages/customer-detail"));
const Properties = lazyRetry(() => import("@/pages/properties"));
const PropertyDetail = lazyRetry(() => import("@/pages/property-detail"));
const Appliances = lazyRetry(() => import("@/pages/appliances"));
const ApplianceDetail = lazyRetry(() => import("@/pages/appliance-detail"));
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
const AdminSocial = lazyRetry(() => import("@/pages/admin-social"));
const AdminJobTypes = lazyRetry(() => import("@/pages/admin-job-types"));
const AdminReassignJobs = lazyRetry(() => import("@/pages/admin-reassign-jobs"));
const AdminInvoiceLog = lazyRetry(() => import("@/pages/admin-invoice-log"));
const Register = lazyRetry(() => import("@/pages/register"));
const PlatformDashboard = lazyRetry(() => import("@/pages/platform-dashboard"));
const PlatformTenants = lazyRetry(() => import("@/pages/platform-tenants"));
const PlatformTenantDetail = lazyRetry(() => import("@/pages/platform-tenant-detail"));
const PlatformAnnouncements = lazyRetry(() => import("@/pages/platform-announcements"));
const PlatformAuditLog = lazyRetry(() => import("@/pages/platform-audit-log"));
const PlatformAddons = lazyRetry(() => import("@/pages/platform-addons"));
const QuickRecord = lazyRetry(() => import("@/pages/quick-record"));
const Enquiries = lazyRetry(() => import("@/pages/enquiries"));
const EnquiryDetail = lazyRetry(() => import("@/pages/enquiry-detail"));
const Billing = lazyRetry(() => import("@/pages/billing"));
const AccountSettings = lazyRetry(() => import("@/pages/account-settings"));
const NotFound = lazyRetry(() => import("@/pages/not-found"));

const PortalLogin = lazyRetry(() => import("@/pages/portal/portal-login"));
const PortalRegister = lazyRetry(() => import("@/pages/portal/portal-register"));
const PortalDashboard = lazyRetry(() => import("@/pages/portal/portal-dashboard"));
const PortalProperties = lazyRetry(() => import("@/pages/portal/portal-properties"));
const PortalPropertyDetail = lazyRetry(() => import("@/pages/portal/portal-property-detail"));
const PortalJobs = lazyRetry(() => import("@/pages/portal/portal-jobs"));
const PortalJobDetail = lazyRetry(() => import("@/pages/portal/portal-job-detail"));

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
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
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

function PublicPage<P extends Record<string, unknown>>({ component: Component, ...props }: { component: React.ComponentType<P> } & P) {
  return (
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

function PortalRoutes() {
  return (
    <PortalAuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/portal/login" component={() => <Suspense fallback={<PageFallback />}><PortalLogin /></Suspense>} />
          <Route path="/portal/register" component={() => <Suspense fallback={<PageFallback />}><PortalRegister /></Suspense>} />
          <Route path="/portal" component={() => <PortalProtectedRoute component={PortalDashboard} />} />
          <Route path="/portal/properties" component={() => <PortalProtectedRoute component={PortalProperties} />} />
          <Route path="/portal/properties/:id" component={() => <PortalProtectedRoute component={PortalPropertyDetail} />} />
          <Route path="/portal/jobs" component={() => <PortalProtectedRoute component={PortalJobs} />} />
          <Route path="/portal/jobs/:id" component={() => <PortalProtectedRoute component={PortalJobDetail} />} />
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
        <Route path="/portal/:rest*" component={PortalRoutes} />

        <Route path="/login">
          {session && !mfaPending ? <Redirect to="/" /> : <Login />}
        </Route>

        <Route path="/register">
          {session ? <Redirect to="/" /> : <Register />}
        </Route>

        <Route path="/" component={RootRoute} />

        <Route path="/features" component={() => <PublicPage component={FeaturesPage} />} />
        <Route path="/pricing" component={() => <PublicPage component={PricingPage} />} />
        <Route path="/about" component={() => <PublicPage component={AboutPage} />} />
        <Route path="/contact" component={() => <PublicPage component={ContactPage} />} />
        <Route path="/blog" component={() => <PublicPage component={BlogIndex} />} />
        <Route path="/blog/:slug" component={() => <PublicPage component={BlogPostPage} />} />
        <Route path="/gas-engineer-software" component={() => <PublicPage component={TradeLandingPage} slug="gas-engineer-software" />} />
        <Route path="/boiler-service-management-software" component={() => <PublicPage component={TradeLandingPage} slug="boiler-service-management-software" />} />
        <Route path="/job-management-software-heating-engineers" component={() => <PublicPage component={TradeLandingPage} slug="job-management-software-heating-engineers" />} />
        <Route path="/oil-engineer-software" component={() => <PublicPage component={TradeLandingPage} slug="oil-engineer-software" />} />
        <Route path="/heat-pump-engineer-software" component={() => <PublicPage component={TradeLandingPage} slug="heat-pump-engineer-software" />} />
        <Route path="/plumber-software" component={() => <PublicPage component={TradeLandingPage} slug="plumber-software" />} />
        <Route path="/landlord-gas-safety-software" component={() => <PublicPage component={TradeLandingPage} slug="landlord-gas-safety-software" />} />
        <Route path="/sole-trader-software" component={() => <PublicPage component={TradeLandingPage} slug="sole-trader-software" />} />
        <Route path="/heating-company-software" component={() => <PublicPage component={TradeLandingPage} slug="heating-company-software" />} />
        <Route path="/industries" component={() => <PublicPage component={IndustriesPage} />} />
        <Route path="/alternatives" component={() => <PublicPage component={AlternativesPage} />} />
        <Route path="/privacy-policy" component={() => <PublicPage component={PrivacyPolicyPage} />} />
        <Route path="/terms-of-service" component={() => <PublicPage component={TermsOfServicePage} />} />

        <Route path="/customers" component={() => <ProtectedRoute component={Customers} />} />
        <Route path="/customers/:id" component={() => <ProtectedRoute component={CustomerDetail} />} />

        <Route path="/properties" component={() => <ProtectedRoute component={Properties} />} />
        <Route path="/properties/:id" component={() => <ProtectedRoute component={PropertyDetail} />} />

        <Route path="/appliances" component={() => <ProtectedRoute component={Appliances} />} />
        <Route path="/appliances/:id" component={() => <ProtectedRoute component={ApplianceDetail} />} />

        <Route path="/jobs" component={() => <ProtectedRoute component={Jobs} />} />
        <Route path="/jobs/:id" component={() => <ProtectedRoute component={JobDetail} />} />
        <Route path="/jobs/:jobId/service-record" component={() => <ProtectedRoute component={ServiceRecordForm} />} />
        <Route path="/jobs/:jobId/breakdown-report" component={() => <ProtectedRoute component={BreakdownReportForm} />} />
        <Route path="/jobs/:jobId/commissioning" component={() => <ProtectedRoute component={CommissioningRecordForm} />} />
        <Route path="/jobs/:jobId/oil-tank-inspection" component={() => <ProtectedRoute component={OilTankInspectionForm} />} />
        <Route path="/jobs/:jobId/oil-tank-risk-assessment" component={() => <ProtectedRoute component={OilTankRiskAssessmentForm} />} />
        <Route path="/jobs/:jobId/combustion-analysis" component={() => <ProtectedRoute component={CombustionAnalysisForm} />} />
        <Route path="/jobs/:jobId/burner-setup" component={() => <ProtectedRoute component={BurnerSetupForm} />} />
        <Route path="/jobs/:jobId/fire-valve-test" component={() => <ProtectedRoute component={FireValveTestForm} />} />
        <Route path="/jobs/:jobId/oil-line-vacuum-test" component={() => <ProtectedRoute component={OilLineVacuumTestForm} />} />
        <Route path="/jobs/:jobId/job-completion" component={() => <ProtectedRoute component={JobCompletionReportForm} />} />
        <Route path="/jobs/:jobId/heat-pump-service" component={() => <ProtectedRoute component={HeatPumpServiceForm} />} />
        <Route path="/jobs/:jobId/heat-pump-commissioning" component={() => <ProtectedRoute component={HeatPumpCommissioningForm} />} />
        <Route path="/jobs/:jobId/files" component={() => <ProtectedRoute component={JobFiles} />} />
        <Route path="/jobs/:jobId/signatures" component={() => <ProtectedRoute component={JobSignatures} />} />

        <Route path="/enquiries" component={() => <ProtectedRoute component={Enquiries} />} />
        <Route path="/enquiries/:id" component={() => <ProtectedRoute component={EnquiryDetail} />} />
        <Route path="/quick-record" component={() => <ProtectedRoute component={QuickRecord} />} />
        <Route path="/search" component={() => <ProtectedRoute component={SearchPage} />} />
        <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />

        <Route path="/admin/company-settings" component={() => <ProtectedRoute component={AdminCompanySettings} />} />
        <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} />} />
        <Route path="/admin/invite-codes" component={() => <ProtectedRoute component={AdminInviteCodes} />} />
        <Route path="/admin/lookup-options" component={() => <ProtectedRoute component={AdminLookupOptions} />} />
        <Route path="/admin/social" component={() => <ProtectedRoute component={AdminSocial} roles={["admin", "super_admin"]} />} />
        <Route path="/admin/reassign-jobs" component={() => <ProtectedRoute component={AdminReassignJobs} roles={["admin"]} />} />
        <Route path="/admin/job-types" component={() => <ProtectedRoute component={AdminJobTypes} roles={["admin"]} />} />
        <Route path="/admin/invoice-log" component={() => <ProtectedRoute component={AdminInvoiceLog} roles={["admin", "office_staff"]} />} />

        <Route path="/billing" component={() => <ProtectedRoute component={Billing} />} />
        <Route path="/account" component={() => <ProtectedRoute component={AccountSettings} />} />

        <Route path="/platform" component={() => <ProtectedRoute component={PlatformDashboard} roles={["super_admin"]} />} />
        <Route path="/platform/tenants/:id" component={() => <ProtectedRoute component={PlatformTenantDetail} roles={["super_admin"]} />} />
        <Route path="/platform/tenants" component={() => <ProtectedRoute component={PlatformTenants} roles={["super_admin"]} />} />
        <Route path="/platform/addons" component={() => <ProtectedRoute component={PlatformAddons} roles={["super_admin"]} />} />
        <Route path="/platform/announcements" component={() => <ProtectedRoute component={PlatformAnnouncements} roles={["super_admin"]} />} />
        <Route path="/platform/audit-log" component={() => <ProtectedRoute component={PlatformAuditLog} roles={["super_admin"]} />} />

        <Route component={() => (
          <Suspense fallback={<PageFallback />}>
            <NotFound />
          </Suspense>
        )} />
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
