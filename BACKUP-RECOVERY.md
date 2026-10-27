# Backup history and recovery

Super admins use **Platform > Settings > Database > Backup History** to see
platform database exports and media-inclusive tenant snapshots together.
History reads all R2 listing pages. Downloads are signed, time-limited URLs.
Deleting a backup is permanent and requires confirmation.

## What each backup contains

| Type | Location in the configured R2 bucket | Recovery use |
| --- | --- | --- |
| Platform database export | `backup_<timestamp>.json.gz` | Operator-led recovery into a separate staging database |
| Legacy database dump | `backup_<timestamp>.dump` | Inspect its format before choosing staging recovery tooling |
| Tenant snapshot | `tenant-backups/<tenant-id>/backup_<timestamp>.zip` | Restore included records and archived media into a new suspended company |

Database exports contain records discovered through PostgREST and exported Auth
user metadata, not password hashes, database schema, policies, functions, grants,
or Storage file contents. A successful upload is not proof of complete recovery.
Inspect backup logs for skipped tables. Tenant snapshots include only the tables
listed in their manifest and the media objects archived by the snapshot builder;
they are not a complete image of every platform feature.
New snapshots also include product/service catalogues and extra job visits and
appliance links so their included references can be recovered independently.
Older snapshots may lack those records and be blocked by unresolved-reference checks.

## Tenant recovery

1. Select the required snapshot in Backup History and download an untouched copy.
2. Click **Validate**. The company page's **Validate Latest Backup** uses the
   latest snapshot instead. Validation streams the archive to temporary disk,
   checks its manifest, tenant ownership, table counts, media metadata and sizes,
   and reads archived media without holding all files in memory.
3. Skipped tables/media, unsupported tables, missing records, unresolved references
   or invalid counts block recovery. Resolve the cause and create a new snapshot;
   do not interpret a partial snapshot as complete.
4. Click **Restore as New Tenant** and confirm the company and date. The server
   revalidates the selected archive before writing anything.
5. Recovery uses new record IDs and remaps included references. The source
   company is not updated. The new company is suspended and restored websites
   are drafts. Custom domains, subscriptions/add-ons and push configuration are
   excluded; integration credentials in company settings are cleared.
   Restored customer confirmation tokens are regenerated and expired, rather than
   reusing live confirmation links.
6. Disabled, banned recovery Auth identities preserve profile references without
   sending invitations, changing existing users, or granting sign-in access.
   An operator must review and map access separately before activation.
7. Row counts are checked after restore. A failed insert, media upload or count
   verification fails recovery rather than reporting partial success. Newly
   created files, company and recovery identities are removed on failure;
   cleanup failures are reported explicitly and require operator attention.
8. Review the suspended company, records, files, users, unresolved external
   integrations and deliberately excluded features. Validation is not a test
   restore and count verification is not a complete functional acceptance test.
   Do not activate until an operator approves the result.

There is no production overwrite option. A previously recorded successful
restore of the same snapshot is refused to avoid accidental duplicates.

## Platform database recovery: staging only

This is an operator procedure, **not an automated production restore button**.

1. Preserve the original backup and record its filename, creation time, size and
   matching application revision. Keep a second copy outside the recovery project.
2. Provision an isolated Supabase project. Do not copy production service keys,
   domain bindings, payment credentials, webhook endpoints or scheduled jobs.
   Disable outbound email, SMS and integrations.
3. Establish schema parity using the matching repository migrations, including
   functions, policies and extensions. Record any migration differences.
4. Inspect the archive offline. Confirm the format, expected tables and counts,
   Auth metadata and any skipped-table warnings from the original backup logs.
   A JSON export is not input to `pg_restore`. A legacy `.dump` must be identified
   and inspected with the appropriate PostgreSQL tools before use.
5. Prepare a reviewed, project-specific import into the empty staging project:
   use foreign-key order, handle cyclic references explicitly, and reconcile
   generated IDs and sequences. Do not disable production constraints or run
   an unreviewed generic JSON importer against production.
6. Recover Auth separately. Exported user metadata cannot recreate password
   hashes or existing sessions. Plan controlled identity mapping and password
   resets without sending messages to real customers during the rehearsal.
7. Recover Storage objects from verified tenant snapshots or separate storage
   backups. Reconcile metadata paths, public URLs and ownership.
8. Compare row counts, foreign-key relationships and media inventories. Test
   representative jobs, invoices, attachments, website drafts and staging sign-in.
   Record missing features and data; take a native database backup of the
   verified staging result.
9. Produce a recovery report and a separately approved cutover/rollback plan.
   No production connection, overwrite or traffic switch happens from Backup
   History.

## Operational limits

Snapshots, validation and recovery use temporary disk. Provide space for the
compressed archive and downloaded/extracted media. Table JSON and its metadata
are still parsed in memory; this is not unlimited-size database recovery.
R2 and Supabase errors are surfaced to the operator. Test recovery periodically,
not just backup upload success.
