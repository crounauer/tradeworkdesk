import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

type HousekeepingRow = {
  id: number;
  table_schema: string;
  table_name: string;
  column_name: string;
  confidence: "high" | "medium" | "low";
  source: string;
  evidence: string | null;
  protected: boolean;
  notes: string | null;
  detected_at: string;
  resolved_at: string | null;
};

const HOUSEKEEPING_SQL_TEMPLATE = `-- 1) Create table for manual/automated audit findings
create table if not exists public.superadmin_unused_columns_audit (
  id bigint generated always as identity primary key,
  table_schema text not null,
  table_name text not null,
  column_name text not null,
  confidence text not null default 'medium' check (confidence in ('high','medium','low')),
  source text not null default 'manual_sql',
  evidence text,
  protected boolean not null default false,
  notes text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_unused_columns_open
  on public.superadmin_unused_columns_audit (resolved_at, confidence, table_name);

-- 2) Example insert format (replace with your real findings)
-- insert into public.superadmin_unused_columns_audit
--   (table_schema, table_name, column_name, confidence, source, evidence, protected, notes)
-- values
--   ('public', 'jobs', 'legacy_field', 'high', 'runtime+static', 'not seen in 30d runtime; no static refs', false, 'candidate for deprecation');

-- 3) Optional helper: generate first-pass candidates (review carefully)
-- with protected_cols as (
--   select n.nspname as table_schema, c.relname as table_name, a.attname as column_name
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   join pg_index i on i.indrelid = c.oid
--   join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
--   where n.nspname = 'public' and c.relkind = 'r'
-- )
-- select c.table_schema, c.table_name, c.column_name
-- from information_schema.columns c
-- left join protected_cols p
--   on p.table_schema = c.table_schema
--  and p.table_name = c.table_name
--  and p.column_name = c.column_name
-- where c.table_schema = 'public'
--   and p.column_name is null
--   and c.column_name not in ('id', 'tenant_id', 'created_at', 'updated_at')
-- order by c.table_name, c.ordinal_position;
`;

const router: IRouter = Router();

async function handleUnusedColumns(_req: Request, res: Response): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("superadmin_unused_columns_audit")
    .select("id, table_schema, table_name, column_name, confidence, source, evidence, protected, notes, detected_at, resolved_at")
    .is("resolved_at", null)
    .order("confidence", { ascending: true })
    .order("table_name", { ascending: true })
    .order("column_name", { ascending: true });

  if (error) {
    const message = String(error.message || "");
    const isMissingAuditTable =
      message.toLowerCase().includes("could not find") ||
      message.toLowerCase().includes("does not exist") ||
      error.code === "PGRST205";

    if (isMissingAuditTable) {
      res.json({
        configured: false,
        message: "Audit table not found. Run the SQL template once, then refresh.",
        sqlTemplate: HOUSEKEEPING_SQL_TEMPLATE,
        summary: { total: 0, high: 0, medium: 0, low: 0 },
        data: [] as HousekeepingRow[],
      });
      return;
    }

    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (data || []) as HousekeepingRow[];
  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.confidence === "high") acc.high += 1;
      if (row.confidence === "medium") acc.medium += 1;
      if (row.confidence === "low") acc.low += 1;
      return acc;
    },
    { total: 0, high: 0, medium: 0, low: 0 },
  );

  res.json({
    configured: true,
    message: rows.length === 0 ? "No open candidates found." : undefined,
    sqlTemplate: HOUSEKEEPING_SQL_TEMPLATE,
    summary,
    data: rows,
  });
}

router.get("/api/superadmin/db-housekeeping/unused-columns", requireAuth, requireSuperAdmin, handleUnusedColumns);

// Backward-compatible alias for older frontend builds still requesting /db-hq.
router.get("/api/superadmin/db-hq/unused-columns", requireAuth, requireSuperAdmin, handleUnusedColumns);

export default router;