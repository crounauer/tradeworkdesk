import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { CalendarCheck, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/use-company-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";

const ScheduleHolidayManager = lazy(() => import("@/components/schedule-holiday-manager"));

type TechnicianLeave = {
  id: string;
  technician_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  holiday_type: "technician_leave" | "technician_away" | "technician_sick" | "public_holiday" | "bank_holiday";
};

const leaveTypeLabel: Record<TechnicianLeave["holiday_type"], string> = {
  technician_leave: "Holiday",
  technician_away: "Away",
  technician_sick: "Sick leave",
  public_holiday: "Public holiday",
  bank_holiday: "Bank holiday",
};

function MyLeaveList({ technicianId }: { technicianId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", start_date: "", end_date: "", start_time: "", end_time: "", holiday_type: "technician_leave" as TechnicianLeave["holiday_type"] });
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const { data: holidays = [], isLoading } = useQuery<TechnicianLeave[]>({
    queryKey: ["my-leave", technicianId],
    queryFn: () => customFetch("/api/calendar/holidays?date_from=2000-01-01&date_to=2100-12-31") as Promise<TechnicianLeave[]>,
  });
  const myLeave = holidays
    .filter((holiday) => holiday.technician_id === technicianId)
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  const refreshLeave = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ["my-leave", technicianId], type: "active" }),
      qc.refetchQueries({ queryKey: ["calendar-holidays"], type: "active" }),
      qc.refetchQueries({ queryKey: ["/api/calendar"], type: "active" }),
    ]);
  };

  const startEdit = (holiday: TechnicianLeave) => {
    setEditingId(holiday.id);
    setEditForm({
      name: holiday.name,
      start_date: String(holiday.start_date).slice(0, 10),
      end_date: String(holiday.end_date).slice(0, 10),
      start_time: holiday.start_time?.slice(0, 5) || "",
      end_time: holiday.end_time?.slice(0, 5) || "",
      holiday_type: holiday.holiday_type,
    });
  };

  const saveEdit = async (id: string) => {
    setSubmittingId(id);
    try {
      await customFetch(`/api/calendar/holidays/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          start_date: editForm.start_date,
          end_date: editForm.end_date,
          start_time: editForm.start_time || null,
          end_time: editForm.end_time || null,
          holiday_type: editForm.holiday_type,
        }),
      });
      setEditingId(null);
      await refreshLeave();
      toast({ title: "Leave updated" });
    } catch (error) {
      toast({ title: "Failed to update leave", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setSubmittingId(null);
    }
  };

  const deleteLeave = async (id: string) => {
    if (!window.confirm("Delete this leave block?")) return;
    setSubmittingId(id);
    try {
      await customFetch(`/api/calendar/holidays/${id}`, { method: "DELETE" });
      await refreshLeave();
      toast({ title: "Leave deleted" });
    } catch (error) {
      toast({ title: "Failed to delete leave", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My Leave</CardTitle>
        <CardDescription>Your booked holiday, away, and sick leave.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your leave…</p>
        ) : myLeave.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no leave booked.</p>
        ) : (
          <div className="space-y-2">
            {myLeave.map((holiday) => (
              <div key={holiday.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3">
                {editingId === holiday.id ? (
                  <div className="grid w-full gap-2 md:grid-cols-6">
                    <Input className="md:col-span-2" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))} />
                    <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))} />
                    <Input type="time" value={editForm.start_time} onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))} />
                    <Input type="time" value={editForm.end_time} onChange={(e) => setEditForm((f) => ({ ...f, end_time: e.target.value }))} />
                    <Select value={editForm.holiday_type} onValueChange={(value) => setEditForm((f) => ({ ...f, holiday_type: value as TechnicianLeave["holiday_type"] }))}>
                      <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technician_leave">Holiday</SelectItem>
                        <SelectItem value="technician_away">Away</SelectItem>
                        <SelectItem value="technician_sick">Sick leave</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="md:col-span-4 flex justify-end gap-2">
                      <Button type="button" size="sm" onClick={() => void saveEdit(holiday.id)} disabled={submittingId === holiday.id || !editForm.name.trim()}>{submittingId === holiday.id ? "Saving..." : "Save"}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(holiday.start_date)}{holiday.start_date !== holiday.end_date ? ` – ${formatDate(holiday.end_date)}` : ""}
                        {holiday.start_time && holiday.end_time ? ` · ${holiday.start_time.slice(0, 5)}–${holiday.end_time.slice(0, 5)}` : " · All day"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{leaveTypeLabel[holiday.holiday_type]}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(holiday)}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void deleteLeave(holiday.id)} disabled={submittingId === holiday.id}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeaveHolidaysPage() {
  const { profile } = useAuth();
  const { hasFeature } = usePlanFeatures();
  const { data: companySettings, isLoading: isCompanySettingsLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();

  const [noticeEnabled, setNoticeEnabled] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeStartDate, setNoticeStartDate] = useState("");
  const [noticeEndDate, setNoticeEndDate] = useState("");
  const [noticeAutoFromHolidays, setNoticeAutoFromHolidays] = useState(false);
  const noticeHydratedRef = useRef(false);
  const [noticeFormDirty, setNoticeFormDirty] = useState(false);

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

      await updateSettings.mutateAsync(payload);

      // Keep the local controls stable after save; do not let a stale response
      // immediately flip UI state.
      setNoticeEnabled(Boolean(payload.website_closure_notice_enabled));
      setNoticeMessage(typeof payload.website_closure_notice_message === "string" ? payload.website_closure_notice_message : "");
      setNoticeStartDate(typeof payload.website_closure_notice_start_date === "string" ? payload.website_closure_notice_start_date : "");
      setNoticeEndDate(typeof payload.website_closure_notice_end_date === "string" ? payload.website_closure_notice_end_date : "");
      if (supportsAutoFromHolidays) {
        setNoticeAutoFromHolidays(Boolean(payload.website_closure_notice_auto_from_holidays));
      }
      setNoticeFormDirty(false);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Leave & Holidays</h1>
          <p className="text-muted-foreground mt-1">
            Manage technician holiday, away, and sick blocks, plus public holidays and UK bank holiday imports.
          </p>
        </div>
      </div>

      {profile?.id ? <MyLeaveList technicianId={profile.id} /> : null}

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
              onCheckedChange={(next) => {
                setNoticeEnabled(next);
                setNoticeFormDirty(true);
              }}
              disabled={!canManageWebsiteNotice || updateSettings.isPending || isCompanySettingsLoading}
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
                onCheckedChange={(next) => {
                  setNoticeAutoFromHolidays(next);
                  setNoticeFormDirty(true);
                }}
                disabled={!canManageWebsiteNotice || updateSettings.isPending || isCompanySettingsLoading}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="closure-message">Announcement message</Label>
            <Textarea
              id="closure-message"
              rows={3}
              value={noticeMessage}
              onChange={(e) => {
                setNoticeMessage(e.target.value);
                setNoticeFormDirty(true);
              }}
              placeholder="We are closed for the bank holiday and will reopen on Tuesday at 8:00 AM."
              disabled={!canManageWebsiteNotice || updateSettings.isPending || isCompanySettingsLoading}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="closure-start">Start date (optional)</Label>
              <Input
                id="closure-start"
                type="date"
                value={noticeStartDate}
                onChange={(e) => {
                  setNoticeStartDate(e.target.value);
                  setNoticeFormDirty(true);
                }}
                disabled={!canManageWebsiteNotice || updateSettings.isPending || isCompanySettingsLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closure-end">End date (optional)</Label>
              <Input
                id="closure-end"
                type="date"
                value={noticeEndDate}
                onChange={(e) => {
                  setNoticeEndDate(e.target.value);
                  setNoticeFormDirty(true);
                }}
                disabled={!canManageWebsiteNotice || updateSettings.isPending || isCompanySettingsLoading}
              />
            </div>
          </div>

          {canManageWebsiteNotice ? (
            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveNotice} disabled={updateSettings.isPending || isCompanySettingsLoading}>
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
