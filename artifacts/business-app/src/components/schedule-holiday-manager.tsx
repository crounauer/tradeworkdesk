import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListProfiles } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface HolidayItem {
  id: string;
  technician_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  holiday_type: "technician_leave" | "public_holiday" | "bank_holiday";
  notes?: string | null;
  source?: string;
}

interface TeamProfile {
  id: string;
  full_name: string;
  role: string;
  is_active?: boolean | null;
  can_be_assigned_jobs?: boolean | null;
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ScheduleHolidayManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [leaveName, setLeaveName] = useState("Annual Leave");
  const [leaveTech, setLeaveTech] = useState("");
  const [leaveStart, setLeaveStart] = useState(todayIso());
  const [leaveEnd, setLeaveEnd] = useState(todayIso());
  const [publicName, setPublicName] = useState("");
  const [publicDate, setPublicDate] = useState(todayIso());
  const [bankYear, setBankYear] = useState(String(new Date().getFullYear()));
  const [submitting, setSubmitting] = useState<null | "leave" | "public" | "bank" | "delete">(null);

  const year = new Date().getFullYear();
  const range = useMemo(() => ({ from: `${year - 1}-01-01`, to: `${year + 2}-12-31` }), [year]);

  const { data: holidays = [] } = useQuery<HolidayItem[]>({
    queryKey: ["calendar-holidays", range.from, range.to],
    queryFn: () => apiFetch(`/api/calendar/holidays?date_from=${range.from}&date_to=${range.to}`),
  });

  const { data: profiles = [] } = useListProfiles();
  const technicians = useMemo(() => {
    const activeProfiles = (profiles as TeamProfile[] || []).filter((p) => p.is_active !== false);
    const assignable = activeProfiles.filter(
      (p) => p.role === "technician" || p.can_be_assigned_jobs === true,
    );

    // Sole-trader fallback: if no explicit technician/assignable flag exists,
    // allow the single active user to be selected for leave blocks.
    if (assignable.length === 0 && activeProfiles.length === 1) {
      return activeProfiles;
    }
    return assignable;
  }, [profiles]);

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["calendar-holidays"] }),
      qc.invalidateQueries({ queryKey: ["/api/calendar"] }),
    ]);
  }

  async function addTechnicianLeave() {
    if (!leaveTech) {
      toast({ title: "Select technician", description: "Please choose a technician for leave block.", variant: "destructive" });
      return;
    }
    if (!leaveStart || !leaveEnd) {
      toast({ title: "Missing dates", description: "Please provide start and end dates.", variant: "destructive" });
      return;
    }
    setSubmitting("leave");
    try {
      await apiFetch("/api/calendar/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leaveName.trim() || "Annual Leave",
          technician_id: leaveTech,
          start_date: leaveStart,
          end_date: leaveEnd,
          holiday_type: "technician_leave",
        }),
      });
      await refreshAll();
      toast({ title: "Leave block added" });
    } catch (err) {
      toast({ title: "Failed to add leave", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  }

  async function addPublicHoliday() {
    if (!publicName.trim() || !publicDate) {
      toast({ title: "Missing fields", description: "Holiday name and date are required.", variant: "destructive" });
      return;
    }
    setSubmitting("public");
    try {
      await apiFetch("/api/calendar/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: publicName.trim(),
          start_date: publicDate,
          end_date: publicDate,
          holiday_type: "public_holiday",
        }),
      });
      setPublicName("");
      await refreshAll();
      toast({ title: "Public holiday added" });
    } catch (err) {
      toast({ title: "Failed to add public holiday", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  }

  async function importBankHolidays() {
    setSubmitting("bank");
    try {
      const data = await apiFetch<{ imported: number }>("/api/calendar/holidays/import-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(bankYear) || new Date().getFullYear() }),
      });
      await refreshAll();
      toast({ title: "Bank holidays imported", description: `${data.imported} holiday records imported/updated.` });
    } catch (err) {
      toast({ title: "Failed to import", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  }

  async function deleteHoliday(id: string) {
    setSubmitting("delete");
    try {
      await apiFetch(`/api/calendar/holidays/${id}`, { method: "DELETE" });
      await refreshAll();
      toast({ title: "Holiday removed" });
    } catch (err) {
      toast({ title: "Failed to remove", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  }

  const upcoming = [...holidays]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 20);

  return (
    <Card className="p-4 border border-border">
      <h3 className="text-base font-semibold mb-3">Holiday & Leave Management</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Block Days Per Technician</p>
          <div className="space-y-1.5">
            <Label>Technician</Label>
            <select
              value={leaveTech}
              onChange={(e) => setLeaveTech(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select technician</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={leaveName} onChange={(e) => setLeaveName(e.target.value)} placeholder="Annual Leave" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
            </div>
          </div>
          <Button onClick={addTechnicianLeave} disabled={submitting !== null} className="w-full">
            {submitting === "leave" ? "Saving..." : "Add Technician Leave Block"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Public / Bank Holidays</p>
          <div className="space-y-1.5">
            <Label>Public holiday name</Label>
            <Input value={publicName} onChange={(e) => setPublicName(e.target.value)} placeholder="Example: Company Shutdown" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={publicDate} onChange={(e) => setPublicDate(e.target.value)} />
          </div>
          <Button onClick={addPublicHoliday} disabled={submitting !== null} className="w-full" variant="outline">
            {submitting === "public" ? "Saving..." : "Add Public Holiday"}
          </Button>
          <div className="pt-2 border-t border-border space-y-2">
            <Label>Import UK bank holidays for year</Label>
            <div className="flex gap-2">
              <Input type="number" value={bankYear} onChange={(e) => setBankYear(e.target.value)} min={2020} max={2100} />
              <Button onClick={importBankHolidays} disabled={submitting !== null}>
                {submitting === "bank" ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">Upcoming Holiday Blocks</p>
        <div className="max-h-64 overflow-auto rounded-lg border border-border">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">No holiday blocks added yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((h) => (
                <li key={h.id} className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.start_date}{h.end_date !== h.start_date ? ` to ${h.end_date}` : ""} · {h.holiday_type.replace("_", " ")}
                      {h.technician_id ? ` · ${technicians.find((t) => t.id === h.technician_id)?.full_name || "Technician"}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={submitting !== null} onClick={() => deleteHoliday(h.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
