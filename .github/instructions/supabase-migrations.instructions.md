---
description: "Use when adding, altering or dropping database columns, tables, constraints or indexes, or writing any SQL schema change for Supabase/Postgres."
applyTo: "supabase/**"
---

# Supabase Schema Changes

## Where migrations go

- New schema changes go in `supabase/migrations/NNNN_short_name.sql`, incrementing
  from the highest existing number. This directory is what `pnpm db:migrate` reads.
- `supabase/patch-*.sql` at the repo root is **legacy**. There are ~79 of them and
  they are NOT picked up by the migration runner. Do not add new ones.

## Writing the SQL

- Make DDL additive and idempotent: `ADD COLUMN IF NOT EXISTS`, and guard
  constraints with a `pg_constraint` existence check so re-runs are safe.
- New columns must be nullable or have a default, so currently-deployed code
  keeps working before the matching release ships.
- Don't drop a column in the same release that removes the code using it.

## Applying it

The agent cannot apply schema changes — the Fly container has no usable Postgres
connection string (see the Fly deploy instructions). The user runs them in the
Supabase SQL Editor.

**Apply the migration before deploying code that reads or writes the new columns.**
PostgREST rejects unknown columns, so deploying first turns every affected write
into a 500 until the schema catches up.

To verify a migration landed without DB credentials, probe PostgREST from the Fly
machine using the service key already in its environment:

    GET $SUPABASE_URL/rest/v1/<table>?select=<column>&limit=1

200 means the column exists, 4xx means it does not. Never print the key.
