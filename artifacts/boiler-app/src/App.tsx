import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import "@/lib/fetch-interceptor";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import Properties from "@/pages/properties";
import PropertyDetail from "@/pages/property-detail";
import Appliances from "@/pages/appliances";
import ApplianceDetail from "@/pages/appliance-detail";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import ServiceRecordForm from "@/pages/service-record-form";
import BreakdownReportForm from "@/pages/breakdown-report-form";
import CommissioningRecordForm from "@/pages/commissioning-record-form";
import OilTankInspectionForm from "@/pages/oil-tank-inspection-form";
import OilTankRiskAssessmentForm from "@/pages/oil-tank-risk-assessment-form";
import CombustionAnalysisForm from "@/pages/combustion-analysis-form";
import BurnerSetupForm from "@/pages/burner-setup-form";
import FireValveTestForm from "@/pages/fire-valve-test-form";
import OilLineVacuumTestForm from "@/pages/oil-line-vacuum-test-form";
import JobCompletionReportForm from "@/pages/job-completion-report-form";
import HeatPumpServiceForm from "@/pages/heat-pump-service-form";
import HeatPumpCommissioningForm from "@/pages/heat-pump-commissioning-form";
import JobFiles from "@/pages/job-files";
import JobSignatures from "@/pages/job-signatures";
import Reports from "@/pages/reports";
import SearchPage from "@/pages/search";
import AdminUsers from "@/pages/admin-users";
import AdminInviteCodes from "@/pages/admin-invite-codes";
import AdminLookupOptions from "@/pages/admin-lookup-options";
import AdminCompanySettings from "@/pages/admin-company-settings";
import Register from "@/pages/register";
import PlatformDashboard from "@/pages/platform-dashboard";
import PlatformTenants from "@/pages/platform-tenants";
import PlatformTenantDetail from "@/pages/platform-tenant-detail";
import PlatformPlans from "@/pages/platform-plans";
import PlatformAnnouncements from "@/pages/platform-announcements";
import PlatformAuditLog from "@/pages/platform-audit-log";
import Billing from "@/pages/billing";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Global error handler — catches errors from background refetches of cached
    // queries that have no mounted observer, preventing unhandled rejections.
    onError: (_error) => {
      // Errors are handled per-component via isError state.
      // This handler prevents the error from bubbling as an unhandled rejection.
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry on 401/403 — retrying won't change the outcome
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-pulse flex flex-col items-center"><div className="w-12 h-12 bg-primary rounded-xl mb-4"></div><div className="h-4 w-32 bg-slate-200 rounded"></div></div></div>;
  if (!session) return <Redirect to="/login" />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AppRouter() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Switch>
      <Route path="/login">
        {session ? <Redirect to="/" /> : <Login />}
      </Route>

      <Route path="/register">
        {session ? <Redirect to="/" /> : <Register />}
      </Route>

      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />

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

      <Route path="/search" component={() => <ProtectedRoute component={SearchPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />

      <Route path="/admin/company-settings" component={() => <ProtectedRoute component={AdminCompanySettings} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} />} />
      <Route path="/admin/invite-codes" component={() => <ProtectedRoute component={AdminInviteCodes} />} />
      <Route path="/admin/lookup-options" component={() => <ProtectedRoute component={AdminLookupOptions} />} />

      <Route path="/billing" component={() => <ProtectedRoute component={Billing} />} />

      <Route path="/platform" component={() => <ProtectedRoute component={PlatformDashboard} />} />
      <Route path="/platform/tenants/:id" component={() => <ProtectedRoute component={PlatformTenantDetail} />} />
      <Route path="/platform/tenants" component={() => <ProtectedRoute component={PlatformTenants} />} />
      <Route path="/platform/plans" component={() => <ProtectedRoute component={PlatformPlans} />} />
      <Route path="/platform/announcements" component={() => <ProtectedRoute component={PlatformAnnouncements} />} />
      <Route path="/platform/audit-log" component={() => <ProtectedRoute component={PlatformAuditLog} />} />

      <Route component={() => session ? <Layout><NotFound /></Layout> : <Redirect to="/login" />} />
    </Switch>
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
