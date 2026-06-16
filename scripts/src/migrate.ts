/**
 * Database migration runner
 *
 * Usage:
 *   pnpm db:migrate              — run all pending migrations
 *   pnpm db:migrate --baseline   — mark all existing migrations as applied
 *                                  without running them (use on existing DBs)
 *   pnpm db:migrate --status     — show applied / pending migrations
 *   pnpm db:migrate --dry-run    — show what would run without executing
 *
 * Requires environment variables:
 *   DATABASE_URL  — postgres connection string (from Supabase project settings
 *                   → Database → Connection string → URI)
 *
 * Or set in scripts/.env (not committed).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");
const SUPABASE_DIR = path.resolve(__dirname, "../../supabase");

const args = process.argv.slice(2);
const isBaseline = args.includes("--baseline");
const isStatus = args.includes("--status");
const isDryRun = args.includes("--dry-run");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  console.error(
    "Get it from: Supabase project → Settings → Database → Connection string → URI"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Resolve the full SQL content for a migration file.
// Handles \ir (include relative) directives.
// ---------------------------------------------------------------------------
function resolveSql(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  const dir = path.dirname(filePath);

  return content
    .split("\n")
    .map((line) => {
      const irMatch = line.match(/^\\ir\s+(.+)$/);
      if (irMatch) {
        const includePath = path.resolve(dir, irMatch[1].trim());
        if (!fs.existsSync(includePath)) {
          console.warn(`  WARNING: \ir target not found: ${includePath}`);
          return `-- MISSING FILE: ${includePath}`;
        }
        return fs.readFileSync(includePath, "utf8");
      }
      return line;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Get sorted list of migration files from the migrations directory
// ---------------------------------------------------------------------------
function getMigrationFiles(): { version: string; filePath: string }[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((f) => ({
    version: f.replace(".sql", ""),
    filePath: path.join(MIGRATIONS_DIR, f),
  }));
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrations = getMigrationFiles();

    // Get already-applied versions
    const { rows } = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations ORDER BY version"
    );
    const applied = new Set(rows.map((r) => r.version));

    const pending = migrations.filter((m) => !applied.has(m.version));

    // --status
    if (isStatus) {
      console.log("\nMigration status:\n");
      for (const m of migrations) {
        const status = applied.has(m.version) ? "✓ applied" : "○ pending";
        console.log(`  ${status}  ${m.version}`);
      }
      console.log(
        `\n${applied.size} applied, ${pending.length} pending\n`
      );
      return;
    }

    // --baseline: mark everything as applied without running
    if (isBaseline) {
      console.log(`\nBaselining ${migrations.length} migrations...\n`);
      for (const m of migrations) {
        if (!applied.has(m.version)) {
          await client.query(
            "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
            [m.version]
          );
          console.log(`  ✓ baselined  ${m.version}`);
        } else {
          console.log(`  - already    ${m.version}`);
        }
      }
      console.log("\nBaseline complete.\n");
      return;
    }

    if (pending.length === 0) {
      console.log("\nAll migrations are up to date.\n");
      return;
    }

    console.log(`\nRunning ${pending.length} pending migration(s)...\n`);

    for (const m of pending) {
      console.log(`  → ${m.version}`);

      if (isDryRun) {
        console.log("    (dry-run — skipping execution)");
        continue;
      }

      const sql = resolveSql(m.filePath);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [m.version]
        );
        await client.query("COMMIT");
        console.log(`    ✓ done`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`    ✗ FAILED: ${(err as Error).message}`);
        console.error("\nMigration aborted. Fix the error and re-run.\n");
        process.exit(1);
      }
    }

    console.log("\nAll migrations applied successfully.\n");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration runner error:", err.message);
  process.exit(1);
});
