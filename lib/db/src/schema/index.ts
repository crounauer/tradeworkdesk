import { pgTable, uuid, text, varchar, boolean, date, time, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "office_staff", "technician"]);
export const jobStatusEnum = pgEnum("job_status", ["scheduled", "in_progress", "completed", "cancelled", "requires_follow_up"]);
export const jobTypeEnum = pgEnum("job_type", ["annual_service", "breakdown", "installation", "inspection", "other"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("technician"),
  phone: varchar("phone", { length: 50 }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address_line1: varchar("address_line1", { length: 255 }),
  address_line2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  county: varchar("county", { length: 100 }),
  postcode: varchar("postcode", { length: 20 }),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer_id: uuid("customer_id").notNull().references(() => customers.id),
  address_line1: varchar("address_line1", { length: 255 }).notNull(),
  address_line2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  county: varchar("county", { length: 100 }),
  postcode: varchar("postcode", { length: 20 }).notNull(),
  access_notes: text("access_notes"),
  parking_notes: text("parking_notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const appliances = pgTable("appliances", {
  id: uuid("id").primaryKey().defaultRandom(),
  property_id: uuid("property_id").notNull().references(() => properties.id),
  appliance_type: varchar("appliance_type", { length: 100 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  serial_number: varchar("serial_number", { length: 100 }),
  gc_number: varchar("gc_number", { length: 100 }),
  installation_date: date("installation_date"),
  last_service_date: date("last_service_date"),
  next_service_due: date("next_service_due"),
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
  job_type: jobTypeEnum("job_type").notNull(),
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
  visual_inspection: text("visual_inspection"),
  appliance_condition: varchar("appliance_condition", { length: 100 }),
  flue_inspection: text("flue_inspection"),
  combustion_co2: varchar("combustion_co2", { length: 20 }),
  combustion_co: varchar("combustion_co", { length: 20 }),
  combustion_o2: varchar("combustion_o2", { length: 20 }),
  combustion_efficiency: varchar("combustion_efficiency", { length: 20 }),
  appliance_safe: boolean("appliance_safe").default(true),
  defects_details: text("defects_details"),
  work_completed: text("work_completed"),
  follow_up_required: boolean("follow_up_required").default(false),
  next_service_due: date("next_service_due"),
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
  file_name: varchar("file_name", { length: 255 }).notNull(),
  file_type: varchar("file_type", { length: 100 }).notNull(),
  file_size: integer("file_size").notNull(),
  storage_path: text("storage_path").notNull(),
  entity_type: varchar("entity_type", { length: 50 }).notNull(),
  entity_id: uuid("entity_id").notNull(),
  uploaded_by: uuid("uploaded_by").notNull().references(() => profiles.id),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const signatures = pgTable("signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  signer_type: varchar("signer_type", { length: 20 }).notNull(),
  signer_name: varchar("signer_name", { length: 255 }).notNull(),
  storage_path: text("storage_path").notNull(),
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
