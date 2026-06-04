-- Run this in the Supabase SQL Editor before deploying the sync script.
-- Adds unique constraints so upsert-by-attio_record_id works correctly.

ALTER TABLE companies
  ADD CONSTRAINT companies_attio_record_id_key UNIQUE (attio_record_id);

ALTER TABLE deals
  ADD CONSTRAINT deals_attio_record_id_key UNIQUE (attio_record_id);

ALTER TABLE people
  ADD CONSTRAINT people_attio_record_id_key UNIQUE (attio_record_id);
