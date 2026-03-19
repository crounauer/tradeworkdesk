import { pgTable, uuid, text, varchar, boolean, date, time, integer, serial, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";

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
  arrival_time: timestamp("arrival_time", { withTimezone: true }),
  departure_time: timestamp("departure_time", { withTimezone: true }),
  visual_inspection: text("visual_inspection"),
  appliance_condition: text("appliance_condition"),
  flue_inspection: text("flue_inspection"),
  combustion_co2: text("combustion_co2"),
  combustion_co: text("combustion_co"),
  combustion_o2: text("combustion_o2"),
  combustion_temp: text("combustion_temp"),
  combustion_efficiency: text("combustion_efficiency"),
  smoke_test: text("smoke_test"),
  smoke_number: text("smoke_number"),
  burner_cleaned: boolean("burner_cleaned").default(false),
  heat_exchanger_cleaned: boolean("heat_exchanger_cleaned").default(false),
  nozzle_checked: boolean("nozzle_checked").default(false),
  nozzle_replaced: boolean("nozzle_replaced").default(false),
  nozzle_size_fitted: text("nozzle_size_fitted"),
  electrodes_checked: boolean("electrodes_checked").default(false),
  electrodes_replaced: boolean("electrodes_replaced").default(false),
  filter_checked: boolean("filter_checked").default(false),
  filter_cleaned: boolean("filter_cleaned").default(false),
  filter_replaced: boolean("filter_replaced").default(false),
  oil_line_checked: boolean("oil_line_checked").default(false),
  fire_valve_checked: boolean("fire_valve_checked").default(false),
  seals_gaskets_checked: boolean("seals_gaskets_checked").default(false),
  seals_gaskets_replaced: boolean("seals_gaskets_replaced").default(false),
  controls_checked: boolean("controls_checked").default(false),
  thermostat_checked: boolean("thermostat_checked").default(false),
  safety_devices_checked: boolean("safety_devices_checked").default(false),
  safety_devices_notes: text("safety_devices_notes"),
  leaks_found: boolean("leaks_found").default(false),
  leaks_details: text("leaks_details"),
  defects_found: boolean("defects_found").default(false),
  defects_details: text("defects_details"),
  advisories: text("advisories"),
  parts_required: text("parts_required"),
  work_completed: text("work_completed"),
  appliance_safe: boolean("appliance_safe").default(true),
  follow_up_required: boolean("follow_up_required").default(false),
  follow_up_notes: text("follow_up_notes"),
  next_service_due: date("next_service_due"),
  additional_notes: text("additional_notes"),
  gas_tightness_pass: boolean("gas_tightness_pass").default(false),
  gas_standing_pressure: text("gas_standing_pressure"),
  gas_working_pressure: text("gas_working_pressure"),
  gas_operating_pressure: text("gas_operating_pressure"),
  gas_burner_pressure: text("gas_burner_pressure"),
  gas_heat_input: text("gas_heat_input"),
  co_co2_ratio: text("co_co2_ratio"),
  flue_spillage_test: text("flue_spillage_test"),
  ventilation_adequate: boolean("ventilation_adequate").default(false),
  gas_meter_type: text("gas_meter_type"),
  gas_safe_engineer_id: text("gas_safe_engineer_id"),
  cp12_certificate_number: text("cp12_certificate_number"),
  landlord_certificate: boolean("landlord_certificate").default(false),
  appliance_classification: text("appliance_classification"),
  warning_notice_issued: boolean("warning_notice_issued").default(false),
  warning_notice_type: text("warning_notice_type"),
  warning_notice_details: text("warning_notice_details"),
  customer_warned: boolean("customer_warned").default(false),
  gas_valve_checked: boolean("gas_valve_checked").default(false),
  injectors_checked: boolean("injectors_checked").default(false),
  pilot_checked: boolean("pilot_checked").default(false),
  ignition_checked: boolean("ignition_checked").default(false),
  gas_pressure_checked: boolean("gas_pressure_checked").default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const commissioningRecords = pgTable("commissioning_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  gas_safe_engineer_id: text("gas_safe_engineer_id"),
  standing_pressure: text("standing_pressure"),
  working_pressure: text("working_pressure"),
  operating_pressure: text("operating_pressure"),
  gas_rate_measured: text("gas_rate_measured"),
  combustion_co: text("combustion_co"),
  combustion_co2: text("combustion_co2"),
  flue_temp: text("flue_temp"),
  ignition_tested: boolean("ignition_tested").default(false),
  controls_tested: boolean("controls_tested").default(false),
  thermostats_tested: boolean("thermostats_tested").default(false),
  pressure_relief_tested: boolean("pressure_relief_tested").default(false),
  expansion_vessel_checked: boolean("expansion_vessel_checked").default(false),
  system_flushed: boolean("system_flushed").default(false),
  inhibitor_added: boolean("inhibitor_added").default(false),
  customer_instructions_given: boolean("customer_instructions_given").default(false),
  customer_name_signed: text("customer_name_signed"),
  notes: text("notes"),
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

export const oilTankInspections = pgTable("oil_tank_inspections", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  tank_type: text("tank_type"),
  tank_size: text("tank_size"),
  tank_material: text("tank_material"),
  tank_location: text("tank_location"),
  tank_age: text("tank_age"),
  bunding_type: text("bunding_type"),
  bunding_condition: text("bunding_condition"),
  sight_gauge_condition: text("sight_gauge_condition"),
  fill_point_condition: text("fill_point_condition"),
  vent_condition: text("vent_condition"),
  filter_condition: text("filter_condition"),
  pipework_condition: text("pipework_condition"),
  supports_condition: text("supports_condition"),
  overall_condition: text("overall_condition"),
  leaks_found: boolean("leaks_found").default(false),
  leaks_details: text("leaks_details"),
  remedial_actions: text("remedial_actions"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const oilTankRiskAssessments = pgTable("oil_tank_risk_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  site_hazards: text("site_hazards"),
  environmental_risks: text("environmental_risks"),
  fire_risk: text("fire_risk"),
  access_risk: text("access_risk"),
  likelihood_rating: text("likelihood_rating"),
  severity_rating: text("severity_rating"),
  overall_risk_rating: text("overall_risk_rating"),
  control_measures: text("control_measures"),
  further_actions_required: text("further_actions_required"),
  assessor_name: text("assessor_name"),
  assessor_qualification: text("assessor_qualification"),
  assessment_date: date("assessment_date"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const combustionAnalysisRecords = pgTable("combustion_analysis_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  co2_reading: text("co2_reading"),
  co_reading: text("co_reading"),
  o2_reading: text("o2_reading"),
  flue_temperature: text("flue_temperature"),
  ambient_temperature: text("ambient_temperature"),
  efficiency: text("efficiency"),
  excess_air: text("excess_air"),
  smoke_number: text("smoke_number"),
  ambient_co: text("ambient_co"),
  draft_reading: text("draft_reading"),
  instrument_make: text("instrument_make"),
  instrument_model: text("instrument_model"),
  instrument_serial: text("instrument_serial"),
  calibration_date: date("calibration_date"),
  pass_fail: text("pass_fail"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const burnerSetupRecords = pgTable("burner_setup_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  burner_manufacturer: text("burner_manufacturer"),
  burner_model: text("burner_model"),
  burner_serial_number: text("burner_serial_number"),
  nozzle_size: text("nozzle_size"),
  nozzle_type: text("nozzle_type"),
  nozzle_angle: text("nozzle_angle"),
  pump_pressure: text("pump_pressure"),
  pump_vacuum: text("pump_vacuum"),
  electrode_gap: text("electrode_gap"),
  electrode_position: text("electrode_position"),
  air_damper_setting: text("air_damper_setting"),
  head_setting: text("head_setting"),
  combustion_co2: text("combustion_co2"),
  combustion_co: text("combustion_co"),
  combustion_smoke: text("combustion_smoke"),
  combustion_efficiency: text("combustion_efficiency"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const fireValveTestRecords = pgTable("fire_valve_test_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  valve_location: text("valve_location"),
  valve_type: text("valve_type"),
  valve_manufacturer: text("valve_manufacturer"),
  test_date: date("test_date"),
  test_method: text("test_method"),
  test_result: text("test_result"),
  response_time: text("response_time"),
  reset_successful: boolean("reset_successful").default(false),
  remedial_action: text("remedial_action"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const oilLineVacuumTests = pgTable("oil_line_vacuum_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  pipe_size: text("pipe_size"),
  pipe_material: text("pipe_material"),
  pipe_length: text("pipe_length"),
  number_of_joints: text("number_of_joints"),
  initial_vacuum: text("initial_vacuum"),
  vacuum_after_5_min: text("vacuum_after_5_min"),
  vacuum_after_10_min: text("vacuum_after_10_min"),
  allowable_drop: text("allowable_drop"),
  actual_drop: text("actual_drop"),
  pass_fail: text("pass_fail"),
  remedial_action: text("remedial_action"),
  additional_notes: text("additional_notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const jobCompletionReports = pgTable("job_completion_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_id: uuid("job_id").notNull().references(() => jobs.id),
  technician_id: uuid("technician_id").notNull().references(() => profiles.id),
  work_completed: text("work_completed"),
  parts_fitted: text("parts_fitted"),
  parts_serial_numbers: text("parts_serial_numbers"),
  outstanding_items: text("outstanding_items"),
  defects_found: text("defects_found"),
  advisories: text("advisories"),
  customer_advised: boolean("customer_advised").default(false),
  customer_sign_off: boolean("customer_sign_off").default(false),
  customer_name_signed: text("customer_name_signed"),
  next_service_date: date("next_service_date"),
  follow_up_required: boolean("follow_up_required").default(false),
  follow_up_notes: text("follow_up_notes"),
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

export const jobTypes = pgTable("job_types", {
  id: serial("id").primaryKey(),
  tenant_id: text("tenant_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  category: text("category").notNull().default("service"),
  color: varchar("color", { length: 20 }).notNull().default("#3B82F6"),
  default_duration_minutes: integer("default_duration_minutes"),
  is_active: boolean("is_active").notNull().default(true),
  is_default: boolean("is_default").notNull().default(false),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const jobTypeSelections = pgTable("job_type_selections", {
  id: serial("id").primaryKey(),
  job_id: uuid("job_id").notNull(),
  job_type_id: integer("job_type_id").notNull().references(() => jobTypes.id),
  tenant_id: text("tenant_id").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Appliance = typeof appliances.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type CommissioningRecord = typeof commissioningRecords.$inferSelect;
export type BreakdownReport = typeof breakdownReports.$inferSelect;
export type OilTankInspection = typeof oilTankInspections.$inferSelect;
export type OilTankRiskAssessment = typeof oilTankRiskAssessments.$inferSelect;
export type CombustionAnalysisRecord = typeof combustionAnalysisRecords.$inferSelect;
export type BurnerSetupRecord = typeof burnerSetupRecords.$inferSelect;
export type FireValveTestRecord = typeof fireValveTestRecords.$inferSelect;
export type OilLineVacuumTest = typeof oilLineVacuumTests.$inferSelect;
export type JobCompletionReport = typeof jobCompletionReports.$inferSelect;
export type JobNote = typeof jobNotes.$inferSelect;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type Signature = typeof signatures.$inferSelect;
export type JobType = typeof jobTypes.$inferSelect;
export type JobTypeSelection = typeof jobTypeSelections.$inferSelect;
