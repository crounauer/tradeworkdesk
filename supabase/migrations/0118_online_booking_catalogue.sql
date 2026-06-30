-- Migration 0118: Online booking catalogue support

ALTER TABLE service_catalogue
	ADD COLUMN IF NOT EXISTS booking_duration_minutes INTEGER NOT NULL DEFAULT 60,
	ADD COLUMN IF NOT EXISTS online_booking_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_service_catalogue_tenant_online_booking
	ON service_catalogue (tenant_id, online_booking_enabled, is_active);

ALTER TABLE bookings
	ADD COLUMN IF NOT EXISTS service_catalogue_id UUID REFERENCES service_catalogue(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_service_catalogue
	ON bookings (tenant_id, service_catalogue_id);