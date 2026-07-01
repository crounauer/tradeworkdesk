import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BookJobDialog } from "@/components/book-job-dialog";

interface BookingRecord {
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
  booking_services?: { name: string } | null;
  service_catalogue?: { name: string } | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function BookingConvertPage(props: { params?: { id?: string } }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, routeParams] = useRoute("/booking/review/:id/convert");
  const bookingId = routeParams?.id || props?.params?.id || "";
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: booking, isLoading, error } = useQuery<BookingRecord>({
    queryKey: ["/api/booking/bookings", bookingId, "convert"],
    enabled: !!bookingId,
    queryFn: () => apiFetch(`/api/booking/bookings/${bookingId}`),
  });

  const cleanNotes = useMemo(() => {
    return String(booking?.notes || "").replace(/\n?\[BOOKING_GEO\][^\n]+/g, "").trim();
  }, [booking?.notes]);

  const finalizeConversion = async (jobId: string) => {
    if (!bookingId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/booking/bookings/${bookingId}/convert-to-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      toast({ title: "Booking converted", description: "Booking linked to the new job successfully." });
      navigate("/booking/review");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to convert booking";
      toast({ title: "Conversion error", description: message, variant: "destructive" });
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  if (!bookingId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Booking id is missing.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Convert Booking to Job</h1>
          <p className="text-sm text-muted-foreground">Review booking details, then create a job with prefilled information.</p>
        </div>
        <Link href="/booking/review">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Back to Review Queue</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error || !booking ? (
        <Card>
          <CardContent className="py-8 text-sm text-destructive">Unable to load booking details.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Customer:</strong> {booking.customer_name}</p>
              <p><strong>Email:</strong> {booking.customer_email}</p>
              {booking.customer_phone && <p><strong>Phone:</strong> {booking.customer_phone}</p>}
              <p><strong>Address:</strong> {[booking.customer_address, booking.customer_postcode].filter(Boolean).join(", ") || "Not provided"}</p>
              <p><strong>Service:</strong> {booking.service_catalogue?.name || booking.booking_services?.name || "Online Booking"}</p>
              <p><strong>Requested time:</strong> {new Date(booking.scheduled_start).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
              {cleanNotes && <p><strong>Details:</strong> {cleanNotes}</p>}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={() => setShowDialog(true)} disabled={booking.status === "cancelled" || submitting}>
              Create Job from Booking
            </Button>
            {booking.status === "cancelled" && <p className="text-xs text-muted-foreground">Cancelled bookings cannot be converted.</p>}
          </div>

          <BookJobDialog
            open={showDialog}
            onOpenChange={setShowDialog}
            initialDate={booking.scheduled_start?.slice(0, 10)}
            initialBookingPrefill={{
              customer_name: booking.customer_name,
              customer_email: booking.customer_email,
              customer_phone: booking.customer_phone,
              customer_address: booking.customer_address,
              customer_postcode: booking.customer_postcode,
              notes: cleanNotes,
              scheduled_start: booking.scheduled_start,
            }}
            onJobCreated={finalizeConversion}
          />
        </>
      )}
    </div>
  );
}
