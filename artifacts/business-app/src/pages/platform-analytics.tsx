import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlatformMarketingAnalytics from "@/pages/platform-marketing-analytics";
import PlatformWebsiteAnalytics from "@/pages/platform-website-analytics";
import PlatformMarketingSiteAnalytics from "@/pages/platform-marketing-site-analytics";

export default function PlatformAnalytics() {
  const defaultTab = useMemo(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "websites") return "websites";
      if (tab === "marketing-site") return "marketing-site";
      return "marketing";
    } catch {
      return "marketing";
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Analytics</h1>
        <p className="text-muted-foreground">Platform-wide marketing and website performance in one place.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="marketing">Marketing Analytics</TabsTrigger>
          <TabsTrigger value="websites">Tenant Website Analytics</TabsTrigger>
          <TabsTrigger value="marketing-site">Marketing Site</TabsTrigger>
        </TabsList>

        <TabsContent value="marketing" className="mt-4">
          <PlatformMarketingAnalytics />
        </TabsContent>

        <TabsContent value="websites" className="mt-4">
          <PlatformWebsiteAnalytics />
        </TabsContent>

        <TabsContent value="marketing-site" className="mt-4">
          <PlatformMarketingSiteAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
