-- Patch 031: Allow decimal quantities on job_parts and job_services
-- e.g. 1.5m of copper pipe, 0.5 hours of a service

ALTER TABLE job_parts ALTER COLUMN quantity TYPE NUMERIC(10,3) USING quantity::NUMERIC(10,3);
ALTER TABLE job_services ALTER COLUMN quantity TYPE NUMERIC(10,3) USING quantity::NUMERIC(10,3);
