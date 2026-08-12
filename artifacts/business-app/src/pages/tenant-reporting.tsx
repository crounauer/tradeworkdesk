import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebsiteAnalytics from "@/pages/website-analytics";
import Reports from "@/pages/reports";
import AdminAuditLog from "@/pages/admin-audit-log";
import EmailAuditReport from "@/pages/email-audit-report";

export default function TenantReporting() {
  const defaultTab = useMemo(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "reports") return "reports";
      if (tab === "audit") return "audit";
      if (tab === "email") return "email";
      return "analytics";
    } catch {
      return "analytics";
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Reporting</h1>
        <p className="text-muted-foreground">Analytics, operational reporting and audit history in one place.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap w-full justify-start gap-2 p-1">
          <TabsTrigger value="analytics" className="flex-1 min-w-[120px] sm:flex-none">Analytics</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1 min-w-[120px] sm:flex-none">Reports</TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 min-w-[120px] sm:flex-none">Audit Trail</TabsTrigger>
          <TabsTrigger value="email" className="flex-1 min-w-[120px] sm:flex-none">Email Log</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4">
          <WebsiteAnalytics />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Reports />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AdminAuditLog />
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <EmailAuditReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
