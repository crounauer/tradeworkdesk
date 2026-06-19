import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebsiteAnalytics from "@/pages/website-analytics";
import Reports from "@/pages/reports";
import AdminAuditLog from "@/pages/admin-audit-log";

export default function TenantReporting() {
  const defaultTab = useMemo(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "reports") return "reports";
      if (tab === "audit") return "audit";
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
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
