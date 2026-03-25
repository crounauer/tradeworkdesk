import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import "@/lib/fetch-interceptor";

const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Customers = lazy(() => import("@/pages/customers"));
const CustomerDetail = lazy(() => import("@/pages/customer-detail"));
const Properties = lazy(() => import("@/pages/properties"));
const PropertyDetail = lazy(() => import("@/pages/property-detail"));
const Appliances = lazy(() => import("@/pages/appliances"));
const ApplianceDetail = lazy(() => import("@/pages/appliance-detail"));
const Jobs = lazy(() => import("@/pages/jobs"));
const JobDetail = lazy(() => import("@/pages/job-detail"));
const ServiceRecordForm = lazy(() => import("@/pages/service-record-form"));
const BreakdownReportForm = lazy(() => import("@/pages/breakdown-report-form"));
const CommissioningRecordForm = lazy(() => import("@/pages/commissioning-record-form"));
const OilTankInspectionForm = lazy(() => import("@/pages/oil-tank-inspection-form"));
const OilTankRiskAssessmentForm = lazy(() => import("@/pages/oil-tank-risk-assessment-form"));
const CombustionAnalysisForm = lazy(() => import("@/pages/combustion-analysis-form"));
const BurnerSetupForm = lazy(() => import("@/pages/burner-setup-form"));
const FireValveTestForm = lazy(() => import("@/pages/fire-valve-test-form"));
const OilLineVacuumTestForm = lazy(() => import("@/pages/oil-line-vacuum-test-form"));
const JobCompletionReportForm = lazy(() => import("@/pages/job-completion-report-form"));
const HeatPumpServiceForm = lazy(() => import("@/pages/heat-pump-service-form"));
const HeatPumpCommissioningForm = lazy(() => import("@/pages/heat-pump-commissioning-form"));
const JobFiles = lazy(() => import("@/pages/job-files"));
const JobSignatures = lazy(() => import("@/pages/job-signatures"));
const Reports = lazy(() => import("@/pages/reports"));
const SearchPage = lazy(() => import("@/pages/search"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminInviteCodes = lazy(() => import("@/pages/admin-invite-codes"));
const AdminLookupOptions = lazy(() => import("@/pages/admin-lookup-options"));
const AdminCompanySettings = lazy(() => import("@/pages/admin-company-settings"));
const AdminSocial = lazy(() => import("@/pages/admin-social"));
const AdminJobTypes = lazy(() => import("@/pages/admin-job-types"));
const Register = lazy(() => import("@/pages/register"));
const PlatformDashboard = lazy(() => import("@/pages/platform-dashboard"));
const PlatformTenants = lazy(() => import("@/pages/platform-tenants"));
const PlatformTenantDetail = lazy(() => import("@/pages/platform-tenant-detail"));
const PlatformPlans = lazy(() => import("@/pages/platform-plans"));
const PlatformAnnouncements = lazy(() => import("@/pages/platform-announcements"));
const PlatformAuditLog = lazy(() => import("@/pages/platform-audit-log"));
const QuickRecord = lazy(() => import("@/pages/quick-record"));
const Billing = lazy(() => import("@/pages/billing"));
const NotFound = lazy(() => import("@/pages/not-found"));

const HomePage = lazy(() => import("@/pages/marketing/home"));
const FeaturesPage = lazy(() => import("@/pages/marketing/features"));
const PricingPage = lazy(() => import("@/pages/marketing/pricing"));
const AboutPage = lazy(() => import("@/pages/marketing/about"));
const ContactPage = lazy(() => import("@/pages/marketing/contact"));
const TradeLandingPage = lazy(() => import("@/pages/marketing/trade-landing"));
const BlogIndex = lazy(() => import("@/pages/marketing/blog-index"));
const BlogPostPage = lazy(() => import("@/pages/marketing/blog-post"));
const PrivacyPolicyPage = lazy(() => import("@/pages/marketing/privacy-policy"));
const TermsOfServicePage = lazy(() => import("@/pages/marketing/terms-of-service"));

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
  const { session, isLoading, profile } = useAuth();

  if (isLoading) return <PageFallback />;
  if (!session) return <Redirect to="/login" />;

  if (roles && profile && !roles.includes(profile.role)) {
    return <Redirect to="/dashboard" />;
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
  const { session, isLoading } = useAuth();

  if (isLoading) return <PageFallback />;

  if (session) {
    return (
      <Layout>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <Dashboard />
        </Suspense>
      </Layout>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <HomePage />
    </Suspense>
  );
}

function AppRouter() {
  const { session } = useAuth();

  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/login">
          {session ? <Redirect to="/" /> : <Login />}
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

        <Route path="/quick-record" component={() => <ProtectedRoute component={QuickRecord} />} />
        <Route path="/search" component={() => <ProtectedRoute component={SearchPage} />} />
        <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />

        <Route path="/admin/company-settings" component={() => <ProtectedRoute component={AdminCompanySettings} />} />
        <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} />} />
        <Route path="/admin/invite-codes" component={() => <ProtectedRoute component={AdminInviteCodes} />} />
        <Route path="/admin/lookup-options" component={() => <ProtectedRoute component={AdminLookupOptions} />} />
        <Route path="/admin/social" component={() => <ProtectedRoute component={AdminSocial} roles={["admin", "super_admin"]} />} />
        <Route path="/admin/job-types" component={() => <ProtectedRoute component={AdminJobTypes} roles={["admin"]} />} />

        <Route path="/billing" component={() => <ProtectedRoute component={Billing} />} />

        <Route path="/platform" component={() => <ProtectedRoute component={PlatformDashboard} />} />
        <Route path="/platform/tenants/:id" component={() => <ProtectedRoute component={PlatformTenantDetail} />} />
        <Route path="/platform/tenants" component={() => <ProtectedRoute component={PlatformTenants} />} />
        <Route path="/platform/plans" component={() => <ProtectedRoute component={PlatformPlans} />} />
        <Route path="/platform/announcements" component={() => <ProtectedRoute component={PlatformAnnouncements} />} />
        <Route path="/platform/audit-log" component={() => <ProtectedRoute component={PlatformAuditLog} />} />

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
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
