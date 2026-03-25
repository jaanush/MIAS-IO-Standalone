-- Replace single protocol column on module_catalog with a join table

CREATE TABLE module_catalog_protocol (
  module_catalog_id INT NOT NULL REFERENCES module_catalog(id) ON DELETE CASCADE,
  protocol          bus_protocol NOT NULL,
  PRIMARY KEY (module_catalog_id, protocol)
);

-- Migrate any existing single-protocol values into the new table
INSERT INTO module_catalog_protocol (module_catalog_id, protocol)
SELECT id, protocol FROM module_catalog WHERE protocol IS NOT NULL;

-- Drop the old column
ALTER TABLE module_catalog DROP COLUMN IF EXISTS protocol;
