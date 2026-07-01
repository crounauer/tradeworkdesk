/**
 * Booking review queue — online booking requests pending office approval.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { Settings, Loader2, CheckCircle2, XCircle, Phone, Mail, Calendar, Clock, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { BookJobDialog } from "@/components/book-job-dialog";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface Booking {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_postcode: string | null;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  source: string;
  booking_services?: { name: string; duration_minutes: number } | null;
  service_catalogue?: { name: string; booking_duration_minutes: number } | null;
  created_at: string;
}

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  no_show: "bg-red-100 text-red-800 border-red-200",
};

export default function Bookings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [convertingBooking, setConvertingBooking] = useState<Booking | null>(null);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/booking/bookings", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ source: "website" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiFetch(`/api/booking/bookings?${params.toString()}`);
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/booking/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/bookings"] });
      setCancellingId(null);
      toast({ title: "Booking cancelled" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/booking/bookings/${id}/reopen`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/bookings"] });
      setReopeningId(null);
      toast({ title: "Booking re-opened" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/booking/bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/bookings"] });
      setDeletingId(null);
      toast({ title: "Booking deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleFinalizeConvert = async (jobId: string) => {
    if (!convertingBooking) return;
    await apiFetch(`/api/booking/bookings/${convertingBooking.id}/convert-to-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });
    qc.invalidateQueries({ queryKey: ["/api/booking/bookings"] });
    toast({ title: "Booking converted", description: "Job created and linked successfully." });
    setConvertingBooking(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Online Booking Review</h1>
        <Link href="/booking/setup">
          <Button variant="outline" size="sm"><Settings className="w-3.5 h-3.5 mr-1.5" />Booking Setup</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bookings</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">No online bookings pending review.</p>
            <p className="text-sm text-muted-foreground mt-1">
              New website bookings will appear here before they are converted into jobs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{b.customer_name}</span>
                      <Badge className={`text-xs px-1.5 py-0.5 border ${STATUS_COLOURS[b.status]}`} variant="outline">
                        {b.status}
                      </Badge>
                      {(b.service_catalogue || b.booking_services) && (
                        <Badge variant="secondary" className="text-xs">{(b.service_catalogue || b.booking_services)?.name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(b.scheduled_start), "EEE d MMM yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(b.scheduled_start), "HH:mm")} – {format(new Date(b.scheduled_end), "HH:mm")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{b.customer_email}</span>
                      {b.customer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.customer_phone}</span>}
                    </div>
                    {b.notes && <p className="text-xs text-muted-foreground italic">{b.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={`/schedule?view=day&date=${new Date(b.scheduled_start).toISOString().slice(0, 10)}`}>
                      <Button size="sm" variant="outline">View Day</Button>
                    </Link>
                    {b.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => setConvertingBooking(b)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" /> Convert to Job
                      </Button>
                    )}
                    {(b.status === "pending" || b.status === "confirmed") && (
                      <Button size="sm" variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancellingId(b.id)}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    )}
                    {b.status === "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => setReopeningId(b.id)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Re-open
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(b.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!cancellingId} onOpenChange={(o) => !o && setCancellingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>This booking will be marked as cancelled. The customer will not be automatically notified unless notifications are configured.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => cancellingId && cancelMutation.mutate(cancellingId)}>
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reopeningId} onOpenChange={(o) => !o && setReopeningId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-open booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the booking back to pending so it can be reviewed and converted again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Cancelled</AlertDialogCancel>
            <AlertDialogAction onClick={() => reopeningId && reopenMutation.mutate(reopeningId)}>
              Re-open Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will fully remove the booking record and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Delete Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BookJobDialog
        open={!!convertingBooking}
        onOpenChange={(open) => { if (!open) setConvertingBooking(null); }}
        initialDate={convertingBooking?.scheduled_start?.slice(0, 10)}
        initialBookingPrefill={convertingBooking ? {
          customer_name: convertingBooking.customer_name,
          customer_email: convertingBooking.customer_email,
          customer_phone: convertingBooking.customer_phone,
          customer_address: convertingBooking.customer_address,
          customer_postcode: convertingBooking.customer_postcode,
          notes: String(convertingBooking.notes || "").replace(/\n?\[BOOKING_GEO\][^\n]+/g, "").trim() || null,
          scheduled_start: convertingBooking.scheduled_start,
        } : undefined}
        onJobCreated={handleFinalizeConvert}
      />
    </div>
  );
}
