-- Add CANBUS to bus_protocol enum (PostgreSQL requires this to be done outside transactions)
ALTER TYPE bus_protocol ADD VALUE IF NOT EXISTS 'CANBUS';

-- Add protocol column to module_catalog (for IO cards that provide a fieldbus network)
ALTER TABLE module_catalog ADD COLUMN IF NOT EXISTS protocol bus_protocol NULL;
