import { pgTable, uuid, text, varchar, boolean, date, time, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "office_staff", "technician"]);
export const jobStatusEnum = pgEnum("job_status", ["scheduled", "in_progress", "completed", "cancelled", "requires_follow_up"]);
export const jobTypeEnum = pgEnum("job_type", ["service", "breakdown", "installation", "inspection", "follow_up"]);
export const priorityEnum = pgEnum("priority_level", ["low", "medium", "high", "urgent"]);
export const propertyTypeEnum = pgEnum("property_type", ["residential", "commercial", "industrial"]);
export const occupancyTypeEnum = pgEnum("occupancy_type", ["owner_occupied", "tenant", "landlord", "vacant", "holiday_let"]);
export const fuelTypeEnum = pgEnum("fuel_type", ["oil", "gas", "lpg", "electric", "solid_fuel", "other"]);
export const boilerTypeEnum = pgEnum("boiler_type", ["combi", "system", "regular", "back_boiler", "other"]);
export const systemTypeEnum = pgEnum("system_type", ["open_vented", "sealed", "gravity_fed", "pressurised", "other"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  full_name: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default("technician"),
  phone: text("phone"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  address_line1: text("address_line1"),
  address_line2: text("address_line2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer_id: uuid("customer_id").notNull().references(() => customers.id),
  address_line1: text("address_line1").notNull(),
  address_line2: text("address_line2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode").notNull(),
  property_type: propertyTypeEnum("property_type"),
  occupancy_type: occupancyTypeEnum("occupancy_type"),
  access_notes: text("access_notes"),
  parking_notes: text("parking_notes"),
  boiler_location: text("boiler_location"),
  flue_location: text("flue_location"),
  tank_location: text("tank_location"),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const appliances = pgTable("appliances", {
  id: uuid("id").primaryKey().defaultRandom(),
  property_id: uuid("property_id").notNull().references(() => properties.id),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serial_number: text("serial_number"),
  boiler_type: boilerTypeEnum("boiler_type"),
  fuel_type: fuelTypeEnum("fuel_type"),
  system_type: systemTypeEnum("system_type"),
  installation_date: date("installation_date"),
  warranty_expiry: date("warranty_expiry"),
  burner_make: text("burner_make"),
  burner_model: text("burner_model"),
  nozzle_size: text("nozzle_size"),
  pump_pressure: text("pump_pressure"),
  controls: text("controls"),
  last_service_date: date("last_service_date"),
  next_service_due: date("next_service_due"),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer_id: uuid("customer_id").notNull().references(() => customers.id),
  property_id: uuid("property_id").notNull().references(() => properties.id),
  appliance_id: uuid("appliance_id").references(() => appliances.id),
  assigned_technician_id: uuid("assigned_technician_id").references(() => profiles.id),
  job_type: jobTypeEnum("job_type").notNull().default("service"),
  status: jobStatusEnum("status").notNull().default("scheduled"),
  priority: priorityEnum("priority").notNull().default("medium"),
  description: text("description"),
  notes: text("notes"),
  scheduled_date: date("scheduled_date").notNull(),
  scheduled_time: time("scheduled_time"),
  estimated_duration: integer("estimated_duration"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const serviceRecords = pgTable("service_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  arrival_time: time("arrival_time"),
  departure_time: time("departure_time"),
  visual_inspection: text("visual_inspection"),
  appliance_condition: text("appliance_condition"),
  flue_inspection: text("flue_inspection"),
  combustion_co2: numeric("combustion_co2"),
  combustion_co: numeric("combustion_co"),
  combustion_o2: numeric("combustion_o2"),
  combustion_temp: numeric("combustion_temp"),
  combustion_efficiency: numeric("combustion_efficiency"),
  smoke_test: text("smoke_test"),
  smoke_number: integer("smoke_number"),
  burner_cleaned: boolean("burner_cleaned"),
  nozzle_checked: boolean("nozzle_checked"),
  filter_replaced: boolean("filter_replaced"),
  electrodes_checked: boolean("electrodes_checked"),
  pump_pressure_checked: boolean("pump_pressure_checked"),
  flue_swept: boolean("flue_swept"),
  controls_tested: boolean("controls_tested"),
  safety_devices_tested: boolean("safety_devices_tested"),
  nozzle_size_fitted: text("nozzle_size_fitted"),
  safety_devices_notes: text("safety_devices_notes"),
  leaks_found: boolean("leaks_found"),
  leaks_details: text("leaks_details"),
  defects_found: boolean("defects_found"),
  defects_details: text("defects_details"),
  advisories: text("advisories"),
  parts_required: text("parts_required"),
  work_completed: text("work_completed"),
  appliance_safe: boolean("appliance_safe").default(true),
  follow_up_required: boolean("follow_up_required").default(false),
  next_service_due: date("next_service_due"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const breakdownReports = pgTable("breakdown_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  reported_fault: text("reported_fault"),
  symptoms: text("symptoms"),
  diagnostics_performed: text("diagnostics_performed"),
  findings: text("findings"),
  parts_required: text("parts_required"),
  temporary_fix: text("temporary_fix"),
  permanent_fix: text("permanent_fix"),
  appliance_safe: boolean("appliance_safe").default(true),
  return_visit_required: boolean("return_visit_required").default(false),
  return_visit_notes: text("return_visit_notes"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const jobNotes = pgTable("job_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  author_id: uuid("author_id").notNull().references(() => profiles.id),
  content: text("content").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const fileAttachments = pgTable("file_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  file_name: text("file_name").notNull(),
  file_type: text("file_type").notNull(),
  file_size: integer("file_size"),
  storage_path: text("storage_path").notNull(),
  entity_type: text("entity_type").notNull(),
  entity_id: uuid("entity_id").notNull(),
  uploaded_by: uuid("uploaded_by").references(() => profiles.id),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const signatures = pgTable("signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  signer_type: text("signer_type").notNull(),
  signer_name: text("signer_name").notNull(),
  storage_path: text("storage_path").notNull(),
  signed_at: timestamp("signed_at").defaultNow(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Appliance = typeof appliances.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type BreakdownReport = typeof breakdownReports.$inferSelect;
export type JobNote = typeof jobNotes.$inferSelect;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type Signature = typeof signatures.$inferSelect;
