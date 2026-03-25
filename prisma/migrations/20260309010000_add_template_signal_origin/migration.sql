-- Add INTERNAL to signal_origin enum
ALTER TYPE signal_origin ADD VALUE IF NOT EXISTS 'INTERNAL';

-- Add origin column to template_signal (nullable — existing signals have no origin set)
ALTER TABLE template_signal ADD COLUMN IF NOT EXISTS origin signal_origin NULL;
