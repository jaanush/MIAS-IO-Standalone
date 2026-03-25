-- Add bus communication timeout to template_signal and bus_signal
ALTER TABLE template_signal ADD COLUMN IF NOT EXISTS timeout_ms INT NULL;
ALTER TABLE bus_signal ADD COLUMN IF NOT EXISTS timeout_ms INT NULL;
