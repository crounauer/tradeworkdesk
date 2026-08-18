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
    { table: "job_notes", column: "author_id", mode: "delete", note: "remove notes authored by this user" },
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
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation") && msg.includes("does not exist");
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
