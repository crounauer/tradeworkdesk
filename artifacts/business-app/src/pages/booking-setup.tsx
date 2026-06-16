/**
 * Online Booking — settings and services configuration page
 */
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Plus, Trash2, Calendar, Clock, Settings } from "lucide-react";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface WorkingHour { day: number; start: string; end: string }
interface BookingService {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  price_type: string;
  is_active: boolean;
  sort_order: number;
}
interface BookingSettings {
  is_enabled: boolean;
  working_hours: WorkingHour[];
  slot_duration_minutes: number;
  buffer_between_minutes: number;
  min_advance_hours: number;
  max_advance_days: number;
  auto_confirm: boolean;
  confirmation_email_enabled: boolean;
  reminder_email_enabled: boolean;
  reminder_hours_before: number;
  auto_create_job: boolean;
  notify_email: string | null;
  page_title: string | null;
  page_description: string | null;
}

const DEFAULT_SETTINGS: BookingSettings = {
  is_enabled: false,
  working_hours: [
    { day: 1, start: "08:00", end: "17:00" },
    { day: 2, start: "08:00", end: "17:00" },
    { day: 3, start: "08:00", end: "17:00" },
    { day: 4, start: "08:00", end: "17:00" },
    { day: 5, start: "08:00", end: "17:00" },
  ],
  slot_duration_minutes: 60,
  buffer_between_minutes: 15,
  min_advance_hours: 2,
  max_advance_days: 60,
  auto_confirm: false,
  confirmation_email_enabled: true,
  reminder_email_enabled: true,
  reminder_hours_before: 24,
  auto_create_job: true,
  notify_email: null,
  page_title: null,
  page_description: null,
};

export default function BookingSetup() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_SETTINGS);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [deletingService, setDeletingService] = useState<BookingService | null>(null);
  const [newService, setNewService] = useState({ name: "", description: "", duration_minutes: 60, price: "", price_type: "fixed" });

  const { data: fetchedSettings, isLoading: settingsLoading } = useQuery<BookingSettings>({
    queryKey: ["/api/booking/settings"],
    queryFn: () => apiFetch("/api/booking/settings"),
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<BookingService[]>({
    queryKey: ["/api/booking/services"],
    queryFn: () => apiFetch("/api/booking/services"),
  });

  useEffect(() => {
    if (fetchedSettings && Object.keys(fetchedSettings).length > 0) {
      setSettings({ ...DEFAULT_SETTINGS, ...fetchedSettings });
    }
  }, [fetchedSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => apiFetch("/api/booking/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/settings"] });
      toast({ title: "Booking settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createServiceMutation = useMutation({
    mutationFn: () => apiFetch("/api/booking/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newService,
        price: newService.price ? parseFloat(newService.price) : null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/services"] });
      setShowServiceDialog(false);
      setNewService({ name: "", description: "", duration_minutes: 60, price: "", price_type: "fixed" });
      toast({ title: "Service added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/booking/services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/services"] });
      setDeletingService(null);
      toast({ title: "Service removed" });
    },
  });

  const toggleDay = (day: number) => {
    const exists = settings.working_hours.find((w) => w.day === day);
    if (exists) {
      setSettings((s) => ({ ...s, working_hours: s.working_hours.filter((w) => w.day !== day) }));
    } else {
      setSettings((s) => ({
        ...s,
        working_hours: [...s.working_hours, { day, start: "08:00", end: "17:00" }].sort((a, b) => a.day - b.day),
      }));
    }
  };

  const updateDayHours = (day: number, field: "start" | "end", value: string) => {
    setSettings((s) => ({
      ...s,
      working_hours: s.working_hours.map((w) => w.day === day ? { ...w, [field]: value } : w),
    }));
  };

  if (settingsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link href="/booking"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Online Booking</h1>
        <Badge variant={settings.is_enabled ? "default" : "secondary"}>
          {settings.is_enabled ? "Active" : "Disabled"}
        </Badge>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" />Settings</TabsTrigger>
          <TabsTrigger value="services"><Clock className="w-3.5 h-3.5 mr-1.5" />Services</TabsTrigger>
          <TabsTrigger value="hours"><Calendar className="w-3.5 h-3.5 mr-1.5" />Working Hours</TabsTrigger>
        </TabsList>

        {/* ── Settings tab ── */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable online booking</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow customers to book appointments from your website</p>
                </div>
                <Switch checked={settings.is_enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, is_enabled: v }))} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-confirm bookings</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Instantly confirm without manual review</p>
                </div>
                <Switch checked={settings.auto_confirm} onCheckedChange={(v) => setSettings((s) => ({ ...s, auto_confirm: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-create job in TradeWorkDesk</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">When a booking is confirmed, create a job automatically</p>
                </div>
                <Switch checked={settings.auto_create_job} onCheckedChange={(v) => setSettings((s) => ({ ...s, auto_create_job: v }))} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Min advance notice (hours)</Label>
                  <Input type="number" min={0} value={settings.min_advance_hours}
                    onChange={(e) => setSettings((s) => ({ ...s, min_advance_hours: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max advance window (days)</Label>
                  <Input type="number" min={1} value={settings.max_advance_days}
                    onChange={(e) => setSettings((s) => ({ ...s, max_advance_days: parseInt(e.target.value) || 60 }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Slot duration (minutes)</Label>
                  <Input type="number" min={15} step={15} value={settings.slot_duration_minutes}
                    onChange={(e) => setSettings((s) => ({ ...s, slot_duration_minutes: parseInt(e.target.value) || 60 }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Buffer between bookings (minutes)</Label>
                  <Input type="number" min={0} step={5} value={settings.buffer_between_minutes}
                    onChange={(e) => setSettings((s) => ({ ...s, buffer_between_minutes: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notification email (optional override)</Label>
                <Input type="email" value={settings.notify_email ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, notify_email: e.target.value || null }))}
                  placeholder="bookings@yourcompany.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Reminders & Confirmations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Send confirmation email to customer</Label>
                <Switch checked={settings.confirmation_email_enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, confirmation_email_enabled: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Send reminder email to customer</Label>
                <Switch checked={settings.reminder_email_enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, reminder_email_enabled: v }))} />
              </div>
              {settings.reminder_email_enabled && (
                <div className="space-y-1">
                  <Label className="text-xs">Hours before appointment to send reminder</Label>
                  <Select value={String(settings.reminder_hours_before)}
                    onValueChange={(v) => setSettings((s) => ({ ...s, reminder_hours_before: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 hours</SelectItem>
                      <SelectItem value="4">4 hours</SelectItem>
                      <SelectItem value="24">24 hours (day before)</SelectItem>
                      <SelectItem value="48">48 hours (2 days before)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </TabsContent>

        {/* ── Services tab ── */}
        <TabsContent value="services" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Bookable services customers can choose from</p>
            <Button size="sm" onClick={() => setShowServiceDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Service
            </Button>
          </div>
          {servicesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : services.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No services yet. Add one to get started.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {services.map((svc) => (
                <Card key={svc.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{svc.name}</p>
                      {svc.description && <p className="text-xs text-muted-foreground truncate">{svc.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                      <span>{svc.duration_minutes}min</span>
                      {svc.price != null && <span>·</span>}
                      {svc.price != null && (
                        <span>{svc.price_type === "from" ? "From " : ""}{svc.price_type !== "free" && svc.price_type !== "tbc" ? `£${svc.price}` : svc.price_type}</span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingService(svc)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Working hours tab ── */}
        <TabsContent value="hours" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">Select days and set hours when customers can book</p>
          <div className="space-y-3">
            {DAYS.map((name, day) => {
              const wh = settings.working_hours.find((w) => w.day === day);
              return (
                <div key={day} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-32">
                    <Switch checked={!!wh} onCheckedChange={() => toggleDay(day)} />
                    <Label className={wh ? "" : "text-muted-foreground"}>{name}</Label>
                  </div>
                  {wh ? (
                    <div className="flex items-center gap-2">
                      <Input type="time" value={wh.start} onChange={(e) => updateDayHours(day, "start", e.target.value)} className="w-28" />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input type="time" value={wh.end} onChange={(e) => updateDayHours(day, "end", e.target.value)} className="w-28" />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Hours
          </Button>
        </TabsContent>
      </Tabs>

      {/* Add service dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Booking Service</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Service Name</Label>
              <Input value={newService.name} onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Boiler Service" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={newService.description} onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))}
                placeholder="Short description..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Duration (minutes)</Label>
                <Input type="number" min={15} step={15} value={newService.duration_minutes}
                  onChange={(e) => setNewService((s) => ({ ...s, duration_minutes: parseInt(e.target.value) || 60 }))} />
              </div>
              <div className="space-y-1">
                <Label>Price type</Label>
                <Select value={newService.price_type} onValueChange={(v) => setNewService((s) => ({ ...s, price_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed price</SelectItem>
                    <SelectItem value="from">From (starting from)</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="tbc">TBC / Quote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(newService.price_type === "fixed" || newService.price_type === "from") && (
              <div className="space-y-1">
                <Label>Price (£)</Label>
                <Input type="number" min={0} step={0.01} value={newService.price}
                  onChange={(e) => setNewService((s) => ({ ...s, price: e.target.value }))}
                  placeholder="0.00" />
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => createServiceMutation.mutate()}
              disabled={!newService.name || createServiceMutation.isPending}>
              {createServiceMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Add Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete service */}
      <AlertDialog open={!!deletingService} onOpenChange={(o) => !o && setDeletingService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove service?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingService?.name}" will be removed from the booking form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingService && deleteServiceMutation.mutate(deletingService.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
