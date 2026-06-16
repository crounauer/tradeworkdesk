/**
 * Bookings list — shows all customer bookings with status management
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
import { Settings, Loader2, CheckCircle2, XCircle, Phone, Mail, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

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
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  source: string;
  booking_services?: { name: string; duration_minutes: number } | null;
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

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/booking/bookings", statusFilter],
    queryFn: () => apiFetch(`/api/booking/bookings${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`)
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/booking/bookings/${id}/confirm`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/bookings"] });
      toast({ title: "Booking confirmed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/booking/bookings/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking/bookings"] });
      setCancellingId(null);
      toast({ title: "Booking cancelled" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
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
            <p className="text-muted-foreground">No bookings yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              <Link href="/booking/setup" className="underline">Set up online booking</Link> to start receiving customer appointments.
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
                      {b.booking_services && (
                        <Badge variant="secondary" className="text-xs">{b.booking_services.name}</Badge>
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
                    {b.status === "pending" && (
                      <Button size="sm" variant="outline"
                        onClick={() => confirmMutation.mutate(b.id)}
                        disabled={confirmMutation.isPending}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" /> Confirm
                      </Button>
                    )}
                    {(b.status === "pending" || b.status === "confirmed") && (
                      <Button size="sm" variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancellingId(b.id)}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    )}
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
    </div>
  );
}
