-- Migration 0084: Phase 3 - Online Booking
-- Tables:
--   booking_settings   — per-tenant booking configuration
--   booking_services   — bookable service types with duration/price
--   bookings           — customer booking records
--   booking_slots      — available / blocked time slots (optional manual overrides)

-- ─── 1. Booking settings ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Feature toggle
  is_enabled                BOOLEAN NOT NULL DEFAULT false,
  -- Working hours (array of {day: 0-6, start: "09:00", end: "17:00"})
  working_hours             JSONB NOT NULL DEFAULT '[]',
  -- Slot configuration
  slot_duration_minutes     INTEGER NOT NULL DEFAULT 60,
  buffer_between_minutes    INTEGER NOT NULL DEFAULT 15,
  -- Advance booking window
  min_advance_hours         INTEGER NOT NULL DEFAULT 2,    -- can't book less than X hours ahead
  max_advance_days          INTEGER NOT NULL DEFAULT 60,   -- can't book more than X days ahead
  -- Confirmation
  auto_confirm              BOOLEAN NOT NULL DEFAULT false, -- or manual confirmation required
  confirmation_email_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_email_enabled    BOOLEAN NOT NULL DEFAULT true,
  reminder_hours_before     INTEGER NOT NULL DEFAULT 24,
  -- Integration: auto-create job in TradeWorkDesk when booking confirmed
  auto_create_job           BOOLEAN NOT NULL DEFAULT true,
  default_job_type_id       UUID,   -- optional: references job_types(id)
  -- Notifications
  notify_email              TEXT,   -- override for booking notification email
  notify_sms_enabled        BOOLEAN NOT NULL DEFAULT false,
  -- Booking page customisation
  page_title                TEXT,
  page_description          TEXT,
  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_settings_tenant ON booking_settings(tenant_id);

DROP TRIGGER IF EXISTS set_updated_at ON booking_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON booking_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_settings_tenant" ON booking_settings;
CREATE POLICY "booking_settings_tenant" ON booking_settings
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = booking_settings.tenant_id)
  );

-- ─── 2. Booking services ──────────────────────────────────────────────────────
-- Bookable service types shown to customers on the booking form

CREATE TABLE IF NOT EXISTS booking_services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  duration_minutes  INTEGER NOT NULL DEFAULT 60,
  price             NUMERIC(10,2),
  price_type        TEXT NOT NULL DEFAULT 'fixed'
    CHECK (price_type IN ('fixed', 'from', 'free', 'tbc')),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_services_tenant ON booking_services(tenant_id, is_active, sort_order);

DROP TRIGGER IF EXISTS set_updated_at ON booking_services;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON booking_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_services_tenant" ON booking_services;
CREATE POLICY "booking_services_tenant" ON booking_services
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = booking_services.tenant_id)
  );

-- Public read (so the booking widget can fetch services)
DROP POLICY IF EXISTS "booking_services_public_read" ON booking_services;
CREATE POLICY "booking_services_public_read" ON booking_services
  FOR SELECT TO anon USING (is_active = true);

-- ─── 3. Bookings ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_service_id  UUID REFERENCES booking_services(id) ON DELETE SET NULL,
  -- Scheduled time
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  -- Customer details
  customer_name       TEXT NOT NULL,
  customer_email      TEXT NOT NULL,
  customer_phone      TEXT,
  customer_address    TEXT,
  customer_postcode   TEXT,
  notes               TEXT,
  -- Status workflow
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- TradeWorkDesk integration
  job_id              UUID,  -- references jobs(id) — no FK to avoid coupling
  enquiry_id          UUID,  -- references enquiries(id)
  -- Source tracking
  source              TEXT NOT NULL DEFAULT 'website'
    CHECK (source IN ('website', 'phone', 'manual', 'app')),
  -- Notification tracking
  confirmation_sent_at   TIMESTAMPTZ,
  reminder_sent_at       TIMESTAMPTZ,
  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant       ON bookings(tenant_id, status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled    ON bookings(tenant_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_bookings_email        ON bookings(tenant_id, customer_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON bookings(status);

DROP TRIGGER IF EXISTS set_updated_at ON bookings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_tenant" ON bookings;
CREATE POLICY "bookings_tenant" ON bookings
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = bookings.tenant_id)
  );

-- Public insert: customers submit bookings from the website
DROP POLICY IF EXISTS "bookings_public_insert" ON bookings;
CREATE POLICY "bookings_public_insert" ON bookings
  FOR INSERT TO anon WITH CHECK (true);

-- ─── 4. Booking slots (blocked/overridden times) ──────────────────────────────
-- Lets tenants block out specific times or add ad-hoc available slots

CREATE TABLE IF NOT EXISTS booking_slot_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME,      -- NULL = whole day
  end_time    TIME,
  type        TEXT NOT NULL DEFAULT 'blocked'
    CHECK (type IN ('blocked', 'available')),  -- blocked = no bookings; available = extra slot
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slot_overrides_tenant ON booking_slot_overrides(tenant_id, date);

ALTER TABLE booking_slot_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slot_overrides_tenant" ON booking_slot_overrides;
CREATE POLICY "slot_overrides_tenant" ON booking_slot_overrides
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = booking_slot_overrides.tenant_id)
  );

-- Public read: booking widget needs to know what slots are blocked
DROP POLICY IF EXISTS "slot_overrides_public_read" ON booking_slot_overrides;
CREATE POLICY "slot_overrides_public_read" ON booking_slot_overrides
  FOR SELECT TO anon USING (true);
