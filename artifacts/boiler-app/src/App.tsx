import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import JobFiles from "@/pages/job-files";
import JobSignatures from "@/pages/job-signatures";
import Reports from "@/pages/reports";
import SearchPage from "@/pages/search";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
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
      <Route path="/jobs/:jobId/files" component={() => <ProtectedRoute component={JobFiles} />} />
      <Route path="/jobs/:jobId/signatures" component={() => <ProtectedRoute component={JobSignatures} />} />

      <Route path="/search" component={() => <ProtectedRoute component={SearchPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />

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
