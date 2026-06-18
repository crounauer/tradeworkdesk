-- patch-056-public-uploads-bucket.sql
-- Ensure public bucket exists for website contact form photo uploads.

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-uploads', 'public-uploads', true)
ON CONFLICT DO NOTHING;