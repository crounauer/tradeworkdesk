-- patch-049: Backfill file_size for existing file_attachments rows where it is NULL
--
-- Files uploaded before file_size was recorded have NULL in that column.
-- Supabase stores file metadata (including size in bytes) in the internal
-- storage.objects table under metadata->>'size'.
-- This patch joins on storage_path to fill in the missing sizes.

UPDATE file_attachments fa
SET file_size = (so.metadata->>'size')::bigint
FROM storage.objects so
WHERE so.name = fa.storage_path
  AND so.bucket_id IN ('service-photos', 'service-documents')
  AND fa.file_size IS NULL;
