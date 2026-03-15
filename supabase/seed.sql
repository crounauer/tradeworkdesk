-- BoilerTech Seed Data
-- Run this after migration.sql to populate the database with realistic test data.
-- NOTE: You need to first create auth users in Supabase Auth, then insert matching profiles.
-- The UUIDs below are placeholders - replace with actual auth user IDs after creating them.

-- Placeholder admin user (replace UUID with actual Supabase auth user ID)
-- INSERT INTO profiles (id, email, full_name, role, phone)
-- VALUES ('REPLACE-WITH-AUTH-USER-ID', 'admin@boilertech.co.uk', 'Sarah Mitchell', 'admin', '07700 900100');

-- Sample Customers
INSERT INTO customers (id, title, first_name, last_name, email, phone, mobile, address_line1, city, county, postcode, notes) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Mr', 'James', 'Wilson', 'james.wilson@email.com', '0161 432 1001', '07700 123001', '14 Oak Avenue', 'Manchester', 'Greater Manchester', 'M20 3PQ', 'Elderly customer - prefers morning appointments'),
  ('a1000000-0000-0000-0000-000000000002', 'Mrs', 'Sarah', 'Thompson', 'sarah.t@email.com', '0161 432 1002', '07700 123002', '8 Elm Close', 'Stockport', 'Greater Manchester', 'SK4 2AB', 'Has two properties'),
  ('a1000000-0000-0000-0000-000000000003', 'Mr', 'Mohammed', 'Khan', 'mkhan@email.com', '0161 432 1003', '07700 123003', '22 Victoria Road', 'Salford', 'Greater Manchester', 'M6 8RF', NULL),
  ('a1000000-0000-0000-0000-000000000004', 'Ms', 'Emily', 'Roberts', 'emily.roberts@email.com', '0161 432 1004', '07700 123004', '5 Church Lane', 'Altrincham', 'Greater Manchester', 'WA14 1ER', 'Commercial customer - restaurant chain'),
  ('a1000000-0000-0000-0000-000000000005', 'Mr', 'David', 'Patel', 'dpatel@email.com', '0161 432 1005', '07700 123005', '31 Riverside Drive', 'Didsbury', 'Greater Manchester', 'M20 5QS', NULL),
  ('a1000000-0000-0000-0000-000000000006', 'Mrs', 'Catherine', 'O''Brien', 'cobrien@email.com', '0161 432 1006', '07700 123006', '17 Park Crescent', 'Bury', 'Greater Manchester', 'BL9 0JT', 'Key holder: neighbour at No. 19'),
  ('a1000000-0000-0000-0000-000000000007', 'Mr', 'Robert', 'Hughes', 'rhughes@email.com', '0161 432 1007', '07700 123007', '42 Station Road', 'Bolton', 'Greater Manchester', 'BL1 2JH', NULL),
  ('a1000000-0000-0000-0000-000000000008', 'Ms', 'Lisa', 'Chen', 'lchen@email.com', '0161 432 1008', '07700 123008', '9 Meadow Walk', 'Wigan', 'Greater Manchester', 'WN1 3SD', 'Rental property - tenant is Mr. Browne'),
  ('a1000000-0000-0000-0000-000000000009', 'Dr', 'Andrew', 'Stewart', 'astewart@email.com', '0161 432 1009', '07700 123009', '76 Heaton Road', 'Heaton Moor', 'Greater Manchester', 'SK4 4NZ', 'Works from home - flexible scheduling'),
  ('a1000000-0000-0000-0000-000000000010', 'Mrs', 'Patricia', 'Brown', 'pbrown@email.com', '0161 432 1010', '07700 123010', '3 Willow Lane', 'Chorlton', 'Greater Manchester', 'M21 9AG', NULL),
  ('a1000000-0000-0000-0000-000000000011', NULL, 'Westfield Estates', 'Ltd', 'info@westfield-estates.com', '0161 432 1011', NULL, '100 Deansgate', 'Manchester', 'Greater Manchester', 'M3 2GP', 'Landlord - manages 3 rental properties'),
  ('a1000000-0000-0000-0000-000000000012', 'Mr', 'Thomas', 'McCarthy', 'tmccarthy@email.com', '0161 432 1012', '07700 123012', '28 Beech Road', 'Chorlton', 'Greater Manchester', 'M21 8BJ', 'Deaf customer - prefers text communication');

-- Sample Properties
INSERT INTO properties (id, customer_id, address_line1, address_line2, city, county, postcode, property_type, occupancy_type, access_notes, parking_notes, boiler_location, flue_location, tank_location) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '14 Oak Avenue', NULL, 'Manchester', 'Greater Manchester', 'M20 3PQ', 'residential', 'owner_occupied', 'Ring bell and wait - customer is slow to answer', 'Street parking available', 'Kitchen cupboard', 'Rear wall', NULL),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', '8 Elm Close', NULL, 'Stockport', 'Greater Manchester', 'SK4 2AB', 'residential', 'owner_occupied', NULL, 'Driveway available', 'Utility room', 'Side wall', NULL),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', '47 High Street', 'Flat 2B', 'Stockport', 'Greater Manchester', 'SK1 1EG', 'residential', 'tenant', 'Buzzer code: 22B', 'Pay and display car park behind building', 'Hallway cupboard', 'Shared flue, roof exit', NULL),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', '22 Victoria Road', NULL, 'Salford', 'Greater Manchester', 'M6 8RF', 'residential', 'owner_occupied', 'Boiler in kitchen cupboard', NULL, 'Kitchen cupboard', 'Kitchen wall', NULL),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000004', '5 Church Lane', NULL, 'Altrincham', 'Greater Manchester', 'WA14 1ER', 'commercial', NULL, 'Commercial premises - report to reception', 'Rear car park, staff entrance', 'Plant room', 'Roof mounted', NULL),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000005', '31 Riverside Drive', NULL, 'Didsbury', 'Greater Manchester', 'M20 5QS', 'residential', 'owner_occupied', NULL, 'Double garage - park on drive', 'Garage', 'Rear wall', 'Garden shed'),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000006', '17 Park Crescent', NULL, 'Bury', 'Greater Manchester', 'BL9 0JT', 'residential', 'owner_occupied', 'Key with neighbour at No.19 if customer out', 'On-street parking', 'Airing cupboard, first floor', 'Bedroom wall', NULL),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000007', '42 Station Road', NULL, 'Bolton', 'Greater Manchester', 'BL1 2JH', 'residential', 'owner_occupied', NULL, 'Car park behind building', 'Under stairs', 'Rear wall', NULL),
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000008', '9 Meadow Walk', NULL, 'Wigan', 'Greater Manchester', 'WN1 3SD', 'residential', 'tenant', 'Tenant: Mr. Browne. Landlord pre-authorized access.', 'Street parking', 'Kitchen', 'Side wall', NULL),
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000009', '76 Heaton Road', NULL, 'Heaton Moor', 'Greater Manchester', 'SK4 4NZ', 'residential', 'owner_occupied', 'Home office - please call before arrival', 'Driveway', 'Utility room', 'Rear wall', NULL),
  ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000010', '3 Willow Lane', NULL, 'Chorlton', 'Greater Manchester', 'M21 9AG', 'residential', 'owner_occupied', NULL, 'Off-street parking', 'Kitchen', 'Kitchen wall', NULL),
  ('b1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000011', '15 Albert Road', 'Unit 4', 'Manchester', 'Greater Manchester', 'M19 2FQ', 'residential', 'tenant', 'Key held at managing agent office', 'Street parking, permit zone M-F 8-6', 'Hallway', 'Rear wall', NULL),
  ('b1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000011', '88 Princess Street', 'Apt 12', 'Manchester', 'Greater Manchester', 'M1 6NG', 'residential', 'tenant', 'Concierge will provide access', 'Underground car park, visitor spaces', 'Utility cupboard', 'Shared flue', NULL);

-- Sample Appliances (using migration.sql field names)
INSERT INTO appliances (id, property_id, manufacturer, model, serial_number, boiler_type, fuel_type, system_type, installation_date, warranty_expiry, burner_make, burner_model, nozzle_size, pump_pressure, last_service_date, next_service_due) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Worcester Bosch', 'Greenstar 8000 Life 35kW', 'WB-2021-44821', 'combi', 'gas', 'sealed', '2021-03-15', '2028-03-15', NULL, NULL, NULL, NULL, '2025-03-10', '2026-03-10'),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Vaillant', 'ecoTEC Plus 630', 'VL-2019-33102', 'system', 'gas', 'sealed', '2019-11-20', '2024-11-20', NULL, NULL, NULL, NULL, '2025-01-18', '2026-01-18'),
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'Ideal', 'Logic Max C35', 'ID-2022-55473', 'combi', 'gas', 'sealed', '2022-06-01', '2032-06-01', NULL, NULL, NULL, NULL, '2025-06-05', '2026-06-05'),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'Baxi', '800 Combi 36', 'BX-2020-67894', 'combi', 'gas', 'sealed', '2020-09-12', '2027-09-12', NULL, NULL, NULL, NULL, '2025-09-15', '2026-09-15'),
  ('c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', 'Potterton', 'Paramount Five 115kW', 'PT-2018-12345', 'regular', 'gas', 'open_vented', '2018-01-10', '2023-01-10', 'Riello', 'RDB1', '0.65 USG 60W', '10 bar', '2024-12-01', '2025-06-01'),
  ('c1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000006', 'Worcester Bosch', 'Greenstar CDi Classic 36', 'WB-2017-98765', 'combi', 'gas', 'sealed', '2017-04-22', '2022-04-22', NULL, NULL, NULL, NULL, '2025-04-20', '2026-04-20'),
  ('c1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000006', 'Megaflo', 'Eco Systemfit 210', 'MF-2017-11223', 'other', 'electric', NULL, '2017-04-22', NULL, NULL, NULL, NULL, NULL, '2025-04-20', '2026-04-20'),
  ('c1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000007', 'Viessmann', 'Vitodens 100-W 26kW', 'VS-2023-44556', 'regular', 'gas', 'sealed', '2023-02-28', '2033-02-28', NULL, NULL, NULL, NULL, '2025-02-25', '2026-02-25'),
  ('c1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000008', 'Vaillant', 'ecoFIT Pure 830', 'VL-2021-77889', 'combi', 'gas', 'sealed', '2021-07-14', '2028-07-14', NULL, NULL, NULL, NULL, '2024-07-10', '2025-07-10'),
  ('c1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000009', 'Ideal', 'Vogue Max S26', 'ID-2020-99001', 'system', 'gas', 'sealed', '2020-12-03', '2027-12-03', NULL, NULL, NULL, NULL, '2024-11-28', '2025-11-28'),
  ('c1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000010', 'Grant', 'VortexBlue 21/26', 'GR-2019-66001', 'combi', 'oil', 'sealed', '2019-05-10', '2024-05-10', 'Riello', 'RDB1 70/90', '0.50 USG 60S', '8 bar', '2025-05-08', '2026-05-08'),
  ('c1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000011', 'Worcester Bosch', 'Greenstar Ri 27kW', 'WB-2022-33445', 'regular', 'gas', 'open_vented', '2022-09-15', '2029-09-15', NULL, NULL, NULL, NULL, '2025-09-10', '2026-09-10'),
  ('c1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000012', 'Baxi', 'Duo-tec 28 GA', 'BX-2021-88990', 'combi', 'gas', 'sealed', '2021-01-20', '2028-01-20', NULL, NULL, NULL, NULL, '2025-01-15', '2026-01-15'),
  ('c1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000013', 'Ideal', 'Logic+ Heat 18', 'ID-2023-11234', 'regular', 'gas', 'sealed', '2023-11-05', '2033-11-05', NULL, NULL, NULL, NULL, '2024-11-01', '2025-11-01');
