export type ProfileDeleteCleanupStep = {
  table: string;
  column: string;
  mode: "set_null" | "cascade" | "delete";
  note?: string;
};

export function getProfileDeleteCleanupPlan(): ProfileDeleteCleanupStep[] {
  return [
    { table: "jobs", column: "assigned_technician_id", mode: "set_null", note: "clear active technician assignment" },
    { table: "service_records", column: "technician_id", mode: "delete", note: "remove service record ownership" },
    { table: "commissioning_records", column: "technician_id", mode: "delete", note: "remove commissioning ownership" },
    { table: "heat_pump_service_records", column: "technician_id", mode: "delete", note: "remove heat pump service ownership" },
    { table: "heat_pump_commissioning_records", column: "technician_id", mode: "delete", note: "remove heat pump commissioning ownership" },
    { table: "breakdown_reports", column: "technician_id", mode: "delete", note: "remove breakdown report ownership" },
    { table: "oil_tank_inspections", column: "technician_id", mode: "delete", note: "remove oil tank inspection ownership" },
    { table: "oil_tank_risk_assessments", column: "technician_id", mode: "delete", note: "remove oil tank risk assessment ownership" },
    { table: "combustion_analysis_records", column: "technician_id", mode: "delete", note: "remove combustion analysis ownership" },
    { table: "burner_setup_records", column: "technician_id", mode: "delete", note: "remove burner setup record ownership" },
    { table: "fire_valve_test_records", column: "technician_id", mode: "delete", note: "remove fire valve test ownership" },
    { table: "oil_line_vacuum_tests", column: "technician_id", mode: "delete", note: "remove oil line vacuum test ownership" },
    { table: "job_completion_reports", column: "technician_id", mode: "delete", note: "remove job completion report ownership" },
    { table: "invoices", column: "created_by", mode: "set_null", note: "preserve invoices without creator" },
    { table: "shopping_lists", column: "assigned_to", mode: "set_null", note: "unassign shopping lists from this user" },
    { table: "shopping_lists", column: "created_by", mode: "delete", note: "remove shopping lists created by this user" },
    { table: "community_categories", column: "created_by", mode: "set_null", note: "preserve community categories without creator" },
    { table: "community_threads", column: "created_by", mode: "delete", note: "remove community threads created by this user" },
    { table: "community_posts", column: "author_id", mode: "delete", note: "remove community posts authored by this user" },
    { table: "community_post_reports", column: "reported_by", mode: "delete", note: "remove community post reports filed by this user" },
    { table: "job_notes", column: "author_id", mode: "delete", note: "remove notes authored by this user" },
    { table: "job_time_entries", column: "created_by", mode: "set_null", note: "preserve time entries without creator" },
    { table: "job_email_logs", column: "sent_by", mode: "delete", note: "remove email logs sent by this user" },
    { table: "job_schedule_history", column: "changed_by", mode: "set_null", note: "preserve schedule history without actor" },
    { table: "website_templates", column: "created_by", mode: "set_null", note: "preserve website templates without creator" },
    { table: "invoice_payments", column: "created_by", mode: "set_null", note: "preserve invoice payments without creator" },
    { table: "template_conversions", column: "created_by", mode: "delete", note: "remove template conversions created by this user" },
    { table: "template_conversions", column: "approved_by", mode: "set_null", note: "clear template conversion approver" },
    { table: "file_attachments", column: "uploaded_by", mode: "set_null", note: "keep attachment records without uploader" },
    { table: "tenant_audit_log", column: "actor_id", mode: "set_null", note: "preserve audit trail while removing actor" },
    { table: "invite_codes", column: "created_by", mode: "set_null", note: "preserve invite codes" },
    { table: "invite_codes", column: "used_by", mode: "set_null", note: "clear invite usage association" },
    { table: "web_push_subscriptions", column: "user_id", mode: "delete", note: "remove push subscriptions for deleted user" },
    { table: "tenant_user_push_preferences", column: "user_id", mode: "delete", note: "remove push preferences for deleted user" },
    { table: "push_notification_dispatch_log", column: "user_id", mode: "delete", note: "remove push dispatch history for deleted user" },
    { table: "user_todos", column: "user_id", mode: "delete", note: "remove user todo records" },
    { table: "support_tickets", column: "created_by_user_id", mode: "delete", note: "remove tickets created by this user" },
    { table: "customer_portal_access_requests", column: "reviewed_by", mode: "set_null", note: "clear portal review ownership" },
  ];
}

function isMissingTableError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = String(error.code || "");
  // 42P01 = raw Postgres "relation does not exist".
  // PGRST205/PGRST204 = Supabase PostgREST "table/column not found in schema cache"
  // (happens when a migration/patch was never applied to this tenant's database).
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export async function cleanupProfileReferences(supabase: any, userId: string): Promise<void> {
  const steps = getProfileDeleteCleanupPlan();

  for (const step of steps) {
    let query: any;

    if (step.mode === "set_null") {
      query = supabase.from(step.table).update({ [step.column]: null }).eq(step.column, userId);
    } else if (step.mode === "delete") {
      query = supabase.from(step.table).delete().eq(step.column, userId);
    } else {
      continue;
    }

    const { error } = await query;
    if (error) {
      if (isMissingTableError(error)) continue;
      throw new Error(`Failed to clean up ${step.table}.${step.column}: ${error.message}`);
    }
  }
}
