interface CreateJobTypeInput {
  endpoint: string;
  name: string;
}

interface CreateJobTypeResult {
  id: string;
  name?: string;
}

export async function createJobType(input: CreateJobTypeInput): Promise<CreateJobTypeResult> {
  const { endpoint, name } = input;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name,
      default_price: null,
      booking_duration_minutes: 60,
      online_booking_enabled: false,
      show_in_job_type_dropdown: true,
    }),
  });

  const body = await res.json().catch(() => ({})) as { id?: string; name?: string; error?: string };
  if (!res.ok || !body.id) {
    throw new Error(body.error || "Failed to add job type");
  }

  return { id: body.id, name: body.name };
}