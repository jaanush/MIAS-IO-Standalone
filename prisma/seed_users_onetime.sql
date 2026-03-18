-- One-time user seed + ownership assignment
-- Run once on deployed DB, then delete

BEGIN;

-- Clear existing users and members
TRUNCATE project_member CASCADE;
DELETE FROM users;

-- Insert users from local DB
INSERT INTO public.users (id, email, name, role, created_at, updated_at, password_hash) VALUES
  ('efe1273a-5cb6-46fe-a179-a0b94372e35f', 'jaanus.heeringson@metstech.se', 'Jaanus Heeringson', 'ADMIN', '2026-03-08 13:26:04.514', '2026-03-08 13:26:04.514', '$2b$10$Ln6t1qJOGXXhJzSItCxLTOx.7TattJJYx5pmfrcHWNaS3uGTg7AL.'),
  ('8d78f5f5-6298-45cf-987e-9378ea9a93da', 'admin@mias.io', 'Admin', 'ADMIN', '2026-03-18 09:32:01.241', '2026-03-18 09:32:01.241', '$2b$10$/daqrs4XpOgxWBUgMH9D2uVFxz0GzsfmVNRO8q5ZvlFptOJYAKb32');

-- Set created_by on all tables to Jaanus
UPDATE project SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;
UPDATE plc SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;
UPDATE io_carrier SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;
UPDATE io_card SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;
UPDATE signal SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;
UPDATE hardware_component SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;
UPDATE component_instance SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;
UPDATE codesys_task SET created_by = 'efe1273a-5cb6-46fe-a179-a0b94372e35f' WHERE created_by IS NULL;

-- Add Jaanus as OWNER on all projects
INSERT INTO project_member (project_id, user_id, role, created_at)
SELECT id, 'efe1273a-5cb6-46fe-a179-a0b94372e35f', 'OWNER', NOW()
FROM project
ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'OWNER';

-- Reset sequence
SELECT setval('project_member_id_seq', COALESCE((SELECT MAX(id) FROM project_member), 0) + 1, false);

COMMIT;
