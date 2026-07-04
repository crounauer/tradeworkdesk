import { createClient } from "@supabase/supabase-js";

type Args = {
  email: string;
  password: string;
};

function parseArgs(argv: string[]): Args {
  const emailFlag = argv.find((arg) => arg.startsWith("--email="));
  const passwordFlag = argv.find((arg) => arg.startsWith("--password="));

  if (!emailFlag || !passwordFlag) {
    throw new Error(
      "Usage: pnpm --filter @workspace/api-server exec tsx scripts/reset-user-password.ts --email=user@example.com --password='NewStrongPassword123!'"
    );
  }

  const email = emailFlag.split("=").slice(1).join("=").trim().toLowerCase();
  const password = passwordFlag.split("=").slice(1).join("=");

  if (!email) {
    throw new Error("Missing --email value.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return { email, password };
}

function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const { email, password } = parseArgs(process.argv.slice(2));
  const supabase = getAdminClient();

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Could not list users: ${listError.message}`);
  }

  const user = usersData.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) {
    throw new Error(`No Supabase auth user found for email: ${email}`);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password,
  });

  if (updateError) {
    throw new Error(`Failed to reset password: ${updateError.message}`);
  }

  console.log(`Password updated for ${email} (user id: ${user.id}).`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(message);
  process.exit(1);
});