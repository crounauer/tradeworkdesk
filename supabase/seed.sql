-- BoilerTech Seed Data
-- Run this after migration.sql to populate the database with realistic test data.
-- NOTE: You need to first create auth users in Supabase Auth, then insert matching profiles.
-- The UUIDs below are placeholders - replace with actual auth user IDs after creating them.

-- Placeholder admin user (replace UUID with actual Supabase auth user ID)
-- INSERT INTO profiles (id, email, full_name, role, phone)
-- VALUES ('REPLACE-WITH-AUTH-USER-ID', 'admin@boilertech.co.uk', 'Sarah Mitchell', 'admin', '07700 900100');

-- Sample Customers
INSERT INTO customers (id, first_name, last_name, email, phone, address_line1, city, county, postcode, notes) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'James', 'Wilson', 'james.wilson@email.com', '07700 123001', '14 Oak Avenue', 'Manchester', 'Greater Manchester', 'M20 3PQ', 'Elderly customer - prefers morning appointments'),
  ('a1000000-0000-0000-0000-000000000002', 'Sarah', 'Thompson', 'sarah.t@email.com', '07700 123002', '8 Elm Close', 'Stockport', 'Greater Manchester', 'SK4 2AB', 'Has two properties'),
  ('a1000000-0000-0000-0000-000000000003', 'Mohammed', 'Khan', 'mkhan@email.com', '07700 123003', '22 Victoria Road', 'Salford', 'Greater Manchester', 'M6 8RF', NULL),
  ('a1000000-0000-0000-0000-000000000004', 'Emily', 'Roberts', 'emily.roberts@email.com', '07700 123004', '5 Church Lane', 'Altrincham', 'Greater Manchester', 'WA14 1ER', 'Commercial customer - restaurant chain'),
  ('a1000000-0000-0000-0000-000000000005', 'David', 'Patel', 'dpatel@email.com', '07700 123005', '31 Riverside Drive', 'Didsbury', 'Greater Manchester', 'M20 5QS', NULL),
  ('a1000000-0000-0000-0000-000000000006', 'Catherine', 'O''Brien', 'cobrien@email.com', '07700 123006', '17 Park Crescent', 'Bury', 'Greater Manchester', 'BL9 0JT', 'Key holder: neighbour at No. 19'),
  ('a1000000-0000-0000-0000-000000000007', 'Robert', 'Hughes', 'rhughes@email.com', '07700 123007', '42 Station Road', 'Bolton', 'Greater Manchester', 'BL1 2JH', NULL),
  ('a1000000-0000-0000-0000-000000000008', 'Lisa', 'Chen', 'lchen@email.com', '07700 123008', '9 Meadow Walk', 'Wigan', 'Greater Manchester', 'WN1 3SD', 'Rental property - tenant is Mr. Browne');

-- Sample Properties
INSERT INTO properties (id, customer_id, address_line1, address_line2, city, county, postcode, access_notes, parking_notes) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '14 Oak Avenue', NULL, 'Manchester', 'Greater Manchester', 'M20 3PQ', 'Ring bell and wait - customer is slow to answer', 'Street parking available'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', '8 Elm Close', NULL, 'Stockport', 'Greater Manchester', 'SK4 2AB', NULL, 'Driveway available'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', '47 High Street', 'Flat 2B', 'Stockport', 'Greater Manchester', 'SK1 1EG', 'Buzzer code: 22B', 'Pay and display car park behind building'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', '22 Victoria Road', NULL, 'Salford', 'Greater Manchester', 'M6 8RF', 'Boiler in kitchen cupboard', NULL),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000004', '5 Church Lane', NULL, 'Altrincham', 'Greater Manchester', 'WA14 1ER', 'Commercial premises - report to reception', 'Rear car park, staff entrance'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000005', '31 Riverside Drive', NULL, 'Didsbury', 'Greater Manchester', 'M20 5QS', NULL, 'Double garage - park on drive'),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000006', '17 Park Crescent', NULL, 'Bury', 'Greater Manchester', 'BL9 0JT', 'Key with neighbour at No.19 if customer out', 'On-street parking'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000007', '42 Station Road', NULL, 'Bolton', 'Greater Manchester', 'BL1 2JH', NULL, 'Car park behind building'),
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000008', '9 Meadow Walk', NULL, 'Wigan', 'Greater Manchester', 'WN1 3SD', 'Tenant: Mr. Browne. Landlord pre-authorized access.', 'Street parking');

-- Sample Appliances
INSERT INTO appliances (id, property_id, appliance_type, manufacturer, model, serial_number, gc_number, installation_date, last_service_date, next_service_due) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Combi Boiler', 'Worcester Bosch', 'Greenstar 8000 Life 35kW', 'WB-2021-44821', 'GC-47-123-456', '2021-03-15', '2025-03-10', '2026-03-10'),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'System Boiler', 'Vaillant', 'ecoTEC Plus 630', 'VL-2019-33102', 'GC-52-789-012', '2019-11-20', '2025-01-18', '2026-01-18'),
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'Combi Boiler', 'Ideal', 'Logic Max C35', 'ID-2022-55473', NULL, '2022-06-01', '2025-06-05', '2026-06-05'),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'Combi Boiler', 'Baxi', '800 Combi 36', 'BX-2020-67894', 'GC-41-345-678', '2020-09-12', '2025-09-15', '2026-09-15'),
  ('c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', 'Commercial Boiler', 'Potterton', 'Paramount Five 115kW', 'PT-2018-12345', 'GC-33-901-234', '2018-01-10', '2024-12-01', '2025-12-01'),
  ('c1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000006', 'Combi Boiler', 'Worcester Bosch', 'Greenstar CDi Classic 36', 'WB-2017-98765', 'GC-47-567-890', '2017-04-22', '2025-04-20', '2026-04-20'),
  ('c1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000006', 'Water Heater', 'Megaflo', 'Eco Systemfit 210', 'MF-2017-11223', NULL, '2017-04-22', '2025-04-20', '2026-04-20'),
  ('c1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000007', 'Regular Boiler', 'Viessmann', 'Vitodens 100-W 26kW', 'VS-2023-44556', 'GC-56-123-789', '2023-02-28', '2025-02-25', '2026-02-25'),
  ('c1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000008', 'Combi Boiler', 'Vaillant', 'ecoFIT Pure 830', 'VL-2021-77889', 'GC-52-456-012', '2021-07-14', '2024-07-10', '2025-07-10'),
  ('c1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000009', 'System Boiler', 'Ideal', 'Vogue Max S26', 'ID-2020-99001', NULL, '2020-12-03', '2024-11-28', '2025-11-28');
