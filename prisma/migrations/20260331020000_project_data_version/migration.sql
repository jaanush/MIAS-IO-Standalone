-- Add data_version to project for tracking sync state between instances
ALTER TABLE "project" ADD COLUMN "data_version" INTEGER NOT NULL DEFAULT 0;

-- Trigger: auto-increment data_version on project row update
CREATE OR REPLACE FUNCTION bump_project_data_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if only updated_at changed (Prisma auto-touch)
  IF NEW.data_version = OLD.data_version THEN
    NEW.data_version := OLD.data_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_data_version
  BEFORE UPDATE ON "project"
  FOR EACH ROW
  EXECUTE FUNCTION bump_project_data_version();
