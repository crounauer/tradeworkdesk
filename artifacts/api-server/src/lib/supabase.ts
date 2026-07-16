import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// This project uses dynamic table access across many routes. Keep the shared
// admin client schema-agnostic at compile time to avoid stale generated schema
// types causing `never` cascades in otherwise valid query code.
type LooseSupabaseClient = SupabaseClient<any, "public", any>;

let adminClient: LooseSupabaseClient | null = null;

function getAdminClient(): LooseSupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "supabaseAdmin is unavailable: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return adminClient;
}

export const supabaseAdmin = new Proxy({} as LooseSupabaseClient, {
  get(_target, prop, receiver) {
    const client = getAdminClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function createSupabaseClient(accessToken: string) {
  if (!supabaseUrl) {
    throw new Error("createSupabaseClient failed: SUPABASE_URL must be set");
  }

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("createSupabaseClient failed: SUPABASE_ANON_KEY must be set");
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
