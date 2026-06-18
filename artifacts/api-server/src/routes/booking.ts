/**
 * Online Booking API routes
 *
 * Authenticated (tenant staff):
 *   GET    /api/booking/settings             — get booking settings
 *   PUT    /api/booking/settings             — upsert booking settings
 *   GET    /api/booking/services             — list booking services
 *   POST   /api/booking/services             — create service
 *   PATCH  /api/booking/services/:id         — update service
 *   DELETE /api/booking/services/:id         — delete service
 *   GET    /api/booking/bookings             — list bookings (with filters)
 *   GET    /api/booking/bookings/:id         — get single booking
 *   POST   /api/booking/bookings             — create booking (manual / staff)
 *   PATCH  /api/booking/bookings/:id         — update booking
 *   POST   /api/booking/bookings/:id/confirm — confirm a pending booking
 *   POST   /api/booking/bookings/:id/cancel  — cancel a booking
 *   GET    /api/booking/slots                — available slots for a date range
 *   POST   /api/booking/slot-overrides       — block/unblock a date/time
 *   DELETE /api/booking/slot-overrides/:id   — remove override
 *
 * Public (no auth — called from website booking widget):
 *   GET    /api/public/booking/:tenantId/services   — list services
 *   GET    /api/public/booking/:tenantId/slots      — available slots
 *   POST   /api/public/booking/:tenantId            — submit a booking
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import {
  requireAuth,
  requireTenant,
  requirePlanFeature,
  type AuthenticatedRequest,
} from "../middlewares/auth";

const router: IRouter = Router();
const publicRouter: IRouter = Router();
const db = supabaseAdmin as any;

function requireBooking() {
  return requirePlanFeature("job_management");  // booking is part of job management module
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate available slots for a date range given booking settings,
 * existing bookings, and slot overrides.
 */
async function getAvailableSlots(
  tenantId: string,
  fromDate: string,
  toDate: string,
  serviceDurationMinutes = 60
): Promise<{ start: string; end: string }[]> {
  const [settingsResult, bookingsResult, overridesResult] = await Promise.all([
    db.from("booking_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("bookings")
      .select("scheduled_start, scheduled_end")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_start", new Date(fromDate).toISOString())
      .lte("scheduled_start", new Date(toDate + "T23:59:59Z").toISOString()),
    db.from("booking_slot_overrides")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("date", fromDate)
      .lte("date", toDate),
  ]);

  const settings = settingsResult.data;
  if (!settings || !settings.is_enabled) return [];

  const workingHours: { day: number; start: string; end: string }[] = settings.working_hours || [];
  const slotDuration: number = settings.slot_duration_minutes || 60;
  const buffer: number = settings.buffer_between_minutes || 15;
  const minAdvanceMs: number = (settings.min_advance_hours || 2) * 60 * 60 * 1000;
  const maxAdvanceDays: number = settings.max_advance_days || 60;

  const existingBookings: { scheduled_start: string; scheduled_end: string }[] = bookingsResult.data || [];
  const overrides: { date: string; start_time: string | null; end_time: string | null; type: string }[] = overridesResult.data || [];

  const slots: { start: string; end: string }[] = [];
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

  const start = new Date(fromDate);
  const end = new Date(toDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d > maxDate) break;
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split("T")[0];

    // Check whole-day block override
    const wholeDayBlock = overrides.find(
      (o) => o.date === dateStr && !o.start_time && o.type === "blocked"
    );
    if (wholeDayBlock) continue;

    // Get working hours for this day
    const wh = workingHours.find((w) => w.day === dayOfWeek);
    if (!wh) continue;

    const [startH, startM] = wh.start.split(":").map(Number);
    const [endH, endM] = wh.end.split(":").map(Number);

    let slotStart = new Date(d);
    slotStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(endH, endM, 0, 0);

    while (slotStart < dayEnd) {
      const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60000);
      if (slotEnd > dayEnd) break;

      // Check min advance
      if (slotStart.getTime() - now.getTime() < minAdvanceMs) {
        slotStart = new Date(slotStart.getTime() + slotDuration * 60000);
        continue;
      }

      // Check time-based block overrides
      const timeBlocked = overrides.some((o) => {
        if (o.date !== dateStr || o.type !== "blocked" || !o.start_time) return false;
        const oStart = new Date(`${dateStr}T${o.start_time}`);
        const oEnd = new Date(`${dateStr}T${o.end_time || o.start_time}`);
        return slotStart < oEnd && slotEnd > oStart;
      });
      if (timeBlocked) {
        slotStart = new Date(slotStart.getTime() + slotDuration * 60000);
        continue;
      }

      // Check existing bookings overlap (with buffer)
      const hasConflict = existingBookings.some((b) => {
        const bStart = new Date(b.scheduled_start).getTime() - buffer * 60000;
        const bEnd = new Date(b.scheduled_end).getTime() + buffer * 60000;
        return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
      });

      if (!hasConflict) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }

      slotStart = new Date(slotStart.getTime() + slotDuration * 60000);
    }
  }

  return slots;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get("/booking/settings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_settings").select("*").eq("tenant_id", req.tenantId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? {});
});

router.put("/booking/settings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("booking_settings").upsert(
    { ...fields, tenant_id: req.tenantId },
    { onConflict: "tenant_id" }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Services ─────────────────────────────────────────────────────────────────

router.get("/booking/services", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_services").select("*")
    .eq("tenant_id", req.tenantId).order("sort_order").order("created_at");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post("/booking/services", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_services").insert(
    { ...req.body, tenant_id: req.tenantId }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/booking/services/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, ...fields } = req.body;
  const { data, error } = await db.from("booking_services")
    .update(fields).eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.delete("/booking/services/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await db.from("booking_services")
    .delete().eq("id", req.params.id).eq("tenant_id", req.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// ─── Bookings ─────────────────────────────────────────────────────────────────

router.get("/booking/bookings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { status, from, to, limit = "50" } = req.query as Record<string, string>;
  let q = db.from("bookings").select("*, booking_services(name, duration_minutes)")
    .eq("tenant_id", req.tenantId)
    .order("scheduled_start", { ascending: false })
    .limit(parseInt(limit));
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("scheduled_start", new Date(from).toISOString());
  if (to) q = q.lte("scheduled_start", new Date(to + "T23:59:59Z").toISOString());
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get("/booking/bookings/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("bookings")
    .select("*, booking_services(name, duration_minutes, price)")
    .eq("id", req.params.id).eq("tenant_id", req.tenantId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/booking/bookings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("bookings").insert(
    { ...req.body, tenant_id: req.tenantId, source: "manual" }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/booking/bookings/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, ...fields } = req.body;
  const { data, error } = await db.from("bookings")
    .update(fields).eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/booking/bookings/:id/confirm", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  // 1. Confirm the booking
  const { data: booking, error } = await db.from("bookings")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: req.userId })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!booking) return res.status(404).json({ error: "Not found" });

  // 2. Auto-create job if setting enabled
  try {
    const { data: settings } = await db.from("booking_settings")
      .select("auto_create_job, default_job_type_id")
      .eq("tenant_id", req.tenantId)
      .maybeSingle();

    if (settings?.auto_create_job) {
      const { data: svc } = await db.from("booking_services")
        .select("name, duration_minutes")
        .eq("id", booking.booking_service_id)
        .maybeSingle();

      const serviceLabel = svc?.name || "Online Booking";
      const scheduledDate = booking.scheduled_start
        ? new Date(booking.scheduled_start).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const scheduledTime = booking.scheduled_start
        ? new Date(booking.scheduled_start).toTimeString().slice(0, 5)
        : null;

      const { data: job } = await db.from("jobs").insert({
        tenant_id: req.tenantId,
        title: serviceLabel + " — " + (booking.customer_name || "Customer"),
        description: booking.notes || null,
        status: "scheduled",
        job_type_id: settings.default_job_type_id || null,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        created_by: req.userId,
      }).select("id").single();

      if (job?.id) {
        // Link booking to job and create/link enquiry
        await db.from("bookings")
          .update({ job_id: job.id })
          .eq("id", req.params.id);

        // Also create an enquiry so the job shows in the inbox
        const { data: enquiry } = await db.from("enquiries").insert({
          tenant_id: req.tenantId,
          contact_name: booking.customer_name,
          contact_email: booking.customer_email || null,
          contact_phone: booking.customer_phone || null,
          address: [booking.customer_address, booking.customer_postcode].filter(Boolean).join(", ") || null,
          source: "website",
          description: [
            serviceLabel,
            booking.notes,
          ].filter(Boolean).join("\n") || null,
          status: "converted",
          notes: "Auto-created from confirmed online booking (ID: " + req.params.id + ")",
          linked_job_id: job.id,
        }).select("id").single();

        if (enquiry?.id) {
          await db.from("bookings").update({ enquiry_id: enquiry.id }).eq("id", req.params.id);
        }
      }
    }
  } catch (autoErr) {
    // Non-fatal — log but don't fail the confirm response
    console.error("[booking] auto-create job failed:", (autoErr as Error).message);
  }

  res.json(booking);
});

router.post("/booking/bookings/:id/cancel", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const { data, error } = await db.from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason ?? null })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// ─── Slots ────────────────────────────────────────────────────────────────────

router.get("/booking/slots", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { from, to, service_id } = req.query as Record<string, string>;
  if (!from || !to) return res.status(400).json({ error: "from and to are required" });

  let duration = 60;
  if (service_id) {
    const { data: svc } = await db.from("booking_services")
      .select("duration_minutes").eq("id", service_id).eq("tenant_id", req.tenantId).maybeSingle();
    if (svc) duration = svc.duration_minutes;
  }

  const slots = await getAvailableSlots(req.tenantId!, from, to, duration);
  res.json(slots);
});

router.post("/booking/slot-overrides", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_slot_overrides").insert(
    { ...req.body, tenant_id: req.tenantId }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete("/booking/slot-overrides/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await db.from("booking_slot_overrides")
    .delete().eq("id", req.params.id).eq("tenant_id", req.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// ─── Public booking routes (no auth) ─────────────────────────────────────────

publicRouter.get("/public/booking/:tenantId/services", async (req: Request, res: Response) => {
  const { data, error } = await db.from("booking_services").select("id, name, description, duration_minutes, price, price_type")
    .eq("tenant_id", req.params.tenantId).eq("is_active", true).order("sort_order");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

publicRouter.get("/public/booking/:tenantId/slots", async (req: Request, res: Response) => {
  const { from, to, service_id } = req.query as Record<string, string>;
  if (!from || !to) return res.status(400).json({ error: "from and to are required" });

  let duration = 60;
  if (service_id) {
    const { data: svc } = await db.from("booking_services")
      .select("duration_minutes").eq("id", service_id).eq("tenant_id", req.params.tenantId).maybeSingle();
    if (svc) duration = svc.duration_minutes;
  }

  const slots = await getAvailableSlots(req.params.tenantId, from, to, duration);
  res.json(slots);
});

publicRouter.post("/public/booking/:tenantId", async (req: Request, res: Response) => {
  // Validate settings exist and booking is enabled
  const { data: settings } = await db.from("booking_settings")
    .select("is_enabled, auto_confirm").eq("tenant_id", req.params.tenantId).maybeSingle();
  if (!settings?.is_enabled) {
    return res.status(403).json({ error: "Online booking is not enabled" });
  }

  const { customer_name, customer_email, customer_phone, scheduled_start, booking_service_id, notes, customer_address, customer_postcode } = req.body as Record<string, string>;
  if (!customer_name || !customer_email || !scheduled_start) {
    return res.status(400).json({ error: "customer_name, customer_email and scheduled_start are required" });
  }

  // Calculate end time from service duration
  let duration = 60;
  if (booking_service_id) {
    const { data: svc } = await db.from("booking_services")
      .select("duration_minutes").eq("id", booking_service_id).eq("tenant_id", req.params.tenantId).maybeSingle();
    if (svc) duration = svc.duration_minutes;
  }
  const scheduledEnd = new Date(new Date(scheduled_start).getTime() + duration * 60000).toISOString();

  const { data, error } = await db.from("bookings").insert({
    tenant_id: req.params.tenantId,
    booking_service_id: booking_service_id || null,
    scheduled_start,
    scheduled_end: scheduledEnd,
    customer_name,
    customer_email,
    customer_phone: customer_phone || null,
    customer_address: customer_address || null,
    customer_postcode: customer_postcode || null,
    notes: notes || null,
    status: settings.auto_confirm ? "confirmed" : "pending",
    source: "website",
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ id: data.id, status: data.status, scheduled_start: data.scheduled_start });
});

export { router as bookingRouter, publicRouter as bookingPublicRouter };
