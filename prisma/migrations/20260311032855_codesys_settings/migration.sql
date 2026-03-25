-- CreateTable
CREATE TABLE "codesys_settings" (
    "project_id" INTEGER NOT NULL,
    "fb_alarm_digital" VARCHAR(100) NOT NULL DEFAULT 'FB_AlarmDigital',
    "fb_alarm_analogue" VARCHAR(100) NOT NULL DEFAULT 'FB_AlarmAnalogue',
    "fb_analog_scaling" VARCHAR(100) NOT NULL DEFAULT 'FB_AnalogueIn_DeadBand_rev3',
    "fb_tank_level" VARCHAR(100) NOT NULL DEFAULT 'FB_TankLevel',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codesys_settings_pkey" PRIMARY KEY ("project_id")
);

-- AddForeignKey
ALTER TABLE "codesys_settings" ADD CONSTRAINT "codesys_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
