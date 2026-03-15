-- Lookup options table for configurable dropdown values
CREATE TABLE IF NOT EXISTS lookup_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, value)
);

-- Seed default values
INSERT INTO lookup_options (category, value, label, sort_order) VALUES
  ('property_type', 'residential', 'Residential', 1),
  ('property_type', 'commercial', 'Commercial', 2),
  ('property_type', 'industrial', 'Industrial', 3),
  ('occupancy_type', 'owner_occupied', 'Owner Occupied', 1),
  ('occupancy_type', 'tenant', 'Tenant', 2),
  ('occupancy_type', 'landlord', 'Landlord', 3),
  ('occupancy_type', 'vacant', 'Vacant', 4),
  ('occupancy_type', 'holiday_let', 'Holiday Let', 5),
  ('boiler_type', 'combi', 'Combi', 1),
  ('boiler_type', 'system', 'System', 2),
  ('boiler_type', 'regular', 'Regular', 3),
  ('boiler_type', 'back_boiler', 'Back Boiler', 4),
  ('boiler_type', 'heat_pump', 'Heat Pump', 5),
  ('boiler_type', 'other', 'Other', 6),
  ('fuel_type', 'oil', 'Oil', 1),
  ('fuel_type', 'gas', 'Gas', 2),
  ('fuel_type', 'lpg', 'LPG', 3),
  ('fuel_type', 'electric', 'Electric', 4),
  ('fuel_type', 'solid_fuel', 'Solid Fuel', 5),
  ('fuel_type', 'other', 'Other', 6)
ON CONFLICT (category, value) DO NOTHING;
