import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/use-company-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ScheduleHolidayManager = lazy(() => import("@/components/schedule-holiday-manager"));

export default function LeaveHolidaysPage() {
  const { profile } = useAuth();
  const { hasFeature } = usePlanFeatures();
  const { data: companySettings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();

  const [noticeEnabled, setNoticeEnabled] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeStartDate, setNoticeStartDate] = useState("");
  const [noticeEndDate, setNoticeEndDate] = useState("");
  const [noticeAutoFromHolidays, setNoticeAutoFromHolidays] = useState(false);
  const noticeHydratedRef = useRef(false);

  const hasJobManagement = hasFeature("job_management");
  const canManageHolidays = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";
  const canManageWebsiteNotice = profile?.role === "admin" || profile?.role === "super_admin";
  const supportsAutoFromHolidays = Object.prototype.hasOwnProperty.call(
    companySettings || {},
    "website_closure_notice_auto_from_holidays",
  );

  useEffect(() => {
    if (noticeHydratedRef.current || !companySettings) return;
    noticeHydratedRef.current = true;
    setNoticeEnabled(Boolean(companySettings?.website_closure_notice_enabled));
    setNoticeMessage(companySettings?.website_closure_notice_message || "");
    setNoticeStartDate(companySettings?.website_closure_notice_start_date || "");
    setNoticeEndDate(companySettings?.website_closure_notice_end_date || "");
    setNoticeAutoFromHolidays(Boolean(companySettings?.website_closure_notice_auto_from_holidays));
  }, [companySettings]);

  const handleSaveNotice = async () => {
    if (!canManageWebsiteNotice) return;
    try {
      const payload: Record<string, unknown> = {
        website_closure_notice_enabled: noticeEnabled,
        website_closure_notice_message: noticeMessage.trim() || null,
        website_closure_notice_start_date: noticeStartDate || null,
        website_closure_notice_end_date: noticeEndDate || null,
      };
      if (supportsAutoFromHolidays) {
        payload.website_closure_notice_auto_from_holidays = noticeAutoFromHolidays;
      }

      const updated = await updateSettings.mutateAsync(payload);

      // Keep local state aligned with the authoritative API response after save.
      setNoticeEnabled(Boolean(updated.website_closure_notice_enabled));
      setNoticeMessage(updated.website_closure_notice_message || "");
      setNoticeStartDate(updated.website_closure_notice_start_date || "");
      setNoticeEndDate(updated.website_closure_notice_end_date || "");
      setNoticeAutoFromHolidays(Boolean(updated.website_closure_notice_auto_from_holidays));

      toast({ title: "Website closure notice saved" });
    } catch (error) {
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Could not update website closure notice",
        variant: "destructive",
      });
    }
  };

  if (!hasJobManagement) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-display font-bold text-foreground">Leave & Holidays</h1>
        <p className="text-sm text-muted-foreground">This feature requires job management to be enabled on your plan.</p>
      </div>
    );
  }

  if (!canManageHolidays) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-display font-bold text-foreground">Leave & Holidays</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to manage leave and holidays.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Leave & Holidays</h1>
          <p className="text-muted-foreground mt-1">
            Manage technician leave blocks, public holidays, and UK bank holiday imports.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="rounded-xl border border-border bg-card animate-pulse" style={{ height: 360 }} />}>
        <ScheduleHolidayManager />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Website Closure Announcement</CardTitle>
          <CardDescription>
            Show a visible announcement banner on your public website when you are closed for holidays or any other reason.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable public closure notice</Label>
              <p className="text-xs text-muted-foreground mt-0.5">When enabled, visitors will see this message at the top of your website.</p>
            </div>
            <Switch
              checked={noticeEnabled}
              onCheckedChange={setNoticeEnabled}
              disabled={!canManageWebsiteNotice || updateSettings.isPending}
            />
          </div>

          {supportsAutoFromHolidays ? (
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-publish from public/bank holidays</Label>
                <p className="text-xs text-muted-foreground mt-0.5">If enabled, adding a public holiday or importing bank holidays will automatically update this website notice.</p>
              </div>
              <Switch
                checked={noticeAutoFromHolidays}
                onCheckedChange={setNoticeAutoFromHolidays}
                disabled={!canManageWebsiteNotice || updateSettings.isPending}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="closure-message">Announcement message</Label>
            <Textarea
              id="closure-message"
              rows={3}
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              placeholder="We are closed for the bank holiday and will reopen on Tuesday at 8:00 AM."
              disabled={!canManageWebsiteNotice || updateSettings.isPending}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="closure-start">Start date (optional)</Label>
              <Input
                id="closure-start"
                type="date"
                value={noticeStartDate}
                onChange={(e) => setNoticeStartDate(e.target.value)}
                disabled={!canManageWebsiteNotice || updateSettings.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closure-end">End date (optional)</Label>
              <Input
                id="closure-end"
                type="date"
                value={noticeEndDate}
                onChange={(e) => setNoticeEndDate(e.target.value)}
                disabled={!canManageWebsiteNotice || updateSettings.isPending}
              />
            </div>
          </div>

          {canManageWebsiteNotice ? (
            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveNotice} disabled={updateSettings.isPending}>
                Save Website Notice
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Admin access is required to publish website announcements.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
