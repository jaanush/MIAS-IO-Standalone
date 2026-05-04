-- FR-015 / NOTIF-023: per-pin wiring metadata pushed by the plugin to
-- drive MIAS-IO's auto-wire matcher. New tables, new enums, plus two
-- governance columns on codesys_fb_definition.

-- CreateEnum
CREATE TYPE "wiring_hint_kind" AS ENUM ('SIGNAL', 'PARAMETER');

-- CreateEnum
CREATE TYPE "wiring_hint_value_role" AS ENUM ('ACTUAL', 'SETPOINT', 'REFERENCE', 'LIMIT', 'ALARM', 'COMMAND');

-- CreateEnum
CREATE TYPE "wiring_hint_command_kind" AS ENUM ('PULSE', 'LEVEL');

-- CreateEnum
CREATE TYPE "wiring_gap_reason" AS ENUM ('NO_HINT', 'NO_CANDIDATE_SIGNAL', 'LOW_CONFIDENCE', 'AMBIGUOUS_MATCH', 'HUMAN_REVIEW_FLAGGED', 'DANGEROUS_FB', 'INCOMPATIBLE_HINT_VERSION');

-- AlterTable: governance flags on the FB definition row.
ALTER TABLE "codesys_fb_definition"
  ADD COLUMN "always_review"       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "hint_schema_version" VARCHAR(20);

-- CreateTable: 1:1 with codesys_fb_parameter; carries the full wiringHint blob.
CREATE TABLE "codesys_fb_parameter_hint" (
    "id"                  SERIAL          NOT NULL,
    "parameter_id"        INTEGER         NOT NULL,
    "hint_schema_version" VARCHAR(20),
    "kind"                "wiring_hint_kind" NOT NULL DEFAULT 'SIGNAL',
    "semantic"            VARCHAR(100),
    "expected_unit"       VARCHAR(50),
    "instrument_class"    VARCHAR(20),
    "match_tag"           TEXT[]          DEFAULT ARRAY[]::TEXT[],
    "required"            BOOLEAN         NOT NULL DEFAULT false,
    "default_literal"     VARCHAR(255),
    "paired_with"         VARCHAR(255),
    "struct_role"         VARCHAR(100),
    "array_cardinality"   INTEGER,
    "value_role"          "wiring_hint_value_role",
    "human_review"        BOOLEAN         NOT NULL DEFAULT false,
    "command_kind"        "wiring_hint_command_kind",
    "notes"               TEXT,
    "created_at"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "codesys_fb_parameter_hint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "codesys_fb_parameter_hint_parameter_id_key"
  ON "codesys_fb_parameter_hint" ("parameter_id");

ALTER TABLE "codesys_fb_parameter_hint"
  ADD CONSTRAINT "codesys_fb_parameter_hint_parameter_id_fkey"
  FOREIGN KEY ("parameter_id") REFERENCES "codesys_fb_parameter"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: matcher gap log. Each row is one auto-wire attempt that
-- didn't produce a confidently-bound WiringRecipeParam.
CREATE TABLE "wiring_recipe_gap" (
    "id"                    SERIAL              NOT NULL,
    "project_id"            INTEGER             NOT NULL,
    "component_instance_id" INTEGER             NOT NULL,
    "parameter_id"          INTEGER             NOT NULL,
    "reason"                "wiring_gap_reason" NOT NULL,
    "details"               TEXT,
    "resolved_at"           TIMESTAMP(3),
    "created_at"            TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "wiring_recipe_gap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wiring_recipe_gap_project_id_idx"
  ON "wiring_recipe_gap" ("project_id");
CREATE INDEX "wiring_recipe_gap_component_instance_id_idx"
  ON "wiring_recipe_gap" ("component_instance_id");
CREATE INDEX "wiring_recipe_gap_reason_idx"
  ON "wiring_recipe_gap" ("reason");

ALTER TABLE "wiring_recipe_gap"
  ADD CONSTRAINT "wiring_recipe_gap_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wiring_recipe_gap"
  ADD CONSTRAINT "wiring_recipe_gap_component_instance_id_fkey"
  FOREIGN KEY ("component_instance_id") REFERENCES "component_instance"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wiring_recipe_gap"
  ADD CONSTRAINT "wiring_recipe_gap_parameter_id_fkey"
  FOREIGN KEY ("parameter_id") REFERENCES "codesys_fb_parameter"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
