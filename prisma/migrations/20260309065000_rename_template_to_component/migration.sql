-- Rename tables: template_* → component_* / hardware_template → hardware_component
-- Uses IF EXISTS / exception blocks to be idempotent (some renames may already exist on live DB)

ALTER TABLE IF EXISTS "hardware_template"       RENAME TO "hardware_component";
ALTER TABLE IF EXISTS "template_signal"         RENAME TO "component_signal";
ALTER TABLE IF EXISTS "template_instance"       RENAME TO "component_instance";
ALTER TABLE IF EXISTS "template_analog_alarm"   RENAME TO "component_analog_alarm";
ALTER TABLE IF EXISTS "template_discrete_alarm" RENAME TO "component_discrete_alarm";

-- Create input_type_catalog if it doesn't exist
-- (was created outside Prisma on live DB; shadow DB needs it here)
CREATE TABLE IF NOT EXISTS "input_type_catalog" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "input_type_catalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "input_type_catalog_code_key" ON "input_type_catalog"("code");

INSERT INTO "input_type_catalog" ("code", "name", "sort_order") VALUES
  ('MA_4_20','4–20 mA',1), ('MA_0_20','0–20 mA',2), ('MA_0_25','0–25 mA',3),
  ('V_0_10','0–10 V',4), ('V_0_5','0–5 V',5), ('V_PLUS_MINUS_10','±10 V',6),
  ('V_PLUS_MINUS_5','±5 V',7), ('PT100','PT100',8), ('PT1000','PT1000',9),
  ('NI100','NI100',10), ('NI1000','NI1000',11), ('TC_K','TC Type K',12),
  ('TC_J','TC Type J',13), ('TC_T','TC Type T',14), ('TC_E','TC Type E',15),
  ('TC_N','TC Type N',16), ('TC_R','TC Type R',17), ('TC_S','TC Type S',18),
  ('TC_B','TC Type B',19), ('RESISTANCE_0_600','0–600 Ω',20),
  ('POTENTIOMETER','Potentiometer',21)
ON CONFLICT (code) DO NOTHING;

-- Add default_input_type_id FK column to component_signal (if not already present)
ALTER TABLE "component_signal" ADD COLUMN IF NOT EXISTS "default_input_type_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "component_signal"
    ADD CONSTRAINT "template_signal_default_input_type_id_fkey"
    FOREIGN KEY ("default_input_type_id") REFERENCES "input_type_catalog"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rename primary key constraints
DO $$ BEGIN ALTER TABLE "hardware_component"    RENAME CONSTRAINT "hardware_template_pkey"       TO "hardware_component_pkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_signal"      RENAME CONSTRAINT "template_signal_pkey"         TO "component_signal_pkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_instance"    RENAME CONSTRAINT "template_instance_pkey"       TO "component_instance_pkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_analog_alarm"   RENAME CONSTRAINT "template_analog_alarm_pkey"   TO "component_analog_alarm_pkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_discrete_alarm" RENAME CONSTRAINT "template_discrete_alarm_pkey" TO "component_discrete_alarm_pkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Rename unique indexes
DO $$ BEGIN ALTER INDEX "template_signal_template_id_channel_offset_key" RENAME TO "component_signal_component_id_channel_offset_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "template_analog_alarm_template_signal_id_condition_key" RENAME TO "component_analog_alarm_component_signal_id_condition_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "template_discrete_alarm_template_signal_id_condition_key" RENAME TO "component_discrete_alarm_component_signal_id_condition_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "instance_signal_instance_id_template_signal_id_key" RENAME TO "instance_signal_instance_id_component_signal_id_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Rename foreign key constraints
DO $$ BEGIN ALTER TABLE "hardware_component"  RENAME CONSTRAINT "hardware_template_project_id_fkey"  TO "hardware_component_project_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "hardware_component"  RENAME CONSTRAINT "hardware_template_created_by_fkey"  TO "hardware_component_created_by_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_signal"    RENAME CONSTRAINT "template_signal_template_id_fkey"   TO "component_signal_component_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_signal"    RENAME CONSTRAINT "template_signal_default_eu_id_fkey" TO "component_signal_default_eu_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_signal"    RENAME CONSTRAINT "template_signal_default_input_type_id_fkey" TO "component_signal_default_input_type_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_instance"  RENAME CONSTRAINT "template_instance_project_id_fkey"  TO "component_instance_project_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_instance"  RENAME CONSTRAINT "template_instance_created_by_fkey"  TO "component_instance_created_by_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_instance"  RENAME CONSTRAINT "template_instance_template_id_fkey" TO "component_instance_component_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_analog_alarm"   RENAME CONSTRAINT "template_analog_alarm_template_signal_id_fkey"   TO "component_analog_alarm_component_signal_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "component_discrete_alarm" RENAME CONSTRAINT "template_discrete_alarm_template_signal_id_fkey" TO "component_discrete_alarm_component_signal_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "instance_signal"     RENAME CONSTRAINT "instance_signal_template_signal_id_fkey" TO "instance_signal_component_signal_id_fkey"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
