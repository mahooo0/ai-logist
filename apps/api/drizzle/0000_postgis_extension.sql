-- 0000_postgis_extension.sql
-- Pitfall #3 of 01-RESEARCH.md: extension must be its own migration so the geography
-- type exists before any table that uses it.
CREATE EXTENSION IF NOT EXISTS postgis;
