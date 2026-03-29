-- Allow standalone FB definitions (pushed via plugin API, not tied to an import session)
ALTER TABLE "codesys_fb_definition" ALTER COLUMN "import_id" DROP NOT NULL;

-- Unique constraint for standalone FB definitions
CREATE UNIQUE INDEX IF NOT EXISTS "codesys_fb_definition_name_source_file_key" ON "codesys_fb_definition"("name", "source_file");
