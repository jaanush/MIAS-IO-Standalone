-- CreateTable
CREATE TABLE "codesys_import" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "source_path" VARCHAR(500) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gvl_count" INTEGER NOT NULL DEFAULT 0,
    "fb_count" INTEGER NOT NULL DEFAULT 0,
    "instance_count" INTEGER NOT NULL DEFAULT 0,
    "variable_count" INTEGER NOT NULL DEFAULT 0,
    "connection_count" INTEGER NOT NULL DEFAULT 0,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "codesys_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codesys_fb_definition" (
    "id" SERIAL NOT NULL,
    "import_id" INTEGER NOT NULL,
    "component_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "extends_name" VARCHAR(255),
    "source_file" VARCHAR(500) NOT NULL,

    CONSTRAINT "codesys_fb_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codesys_fb_parameter" (
    "id" SERIAL NOT NULL,
    "fb_definition_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "data_type" VARCHAR(100) NOT NULL,

    CONSTRAINT "codesys_fb_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codesys_fb_instance" (
    "id" SERIAL NOT NULL,
    "import_id" INTEGER NOT NULL,
    "fb_definition_id" INTEGER,
    "component_instance_id" INTEGER,
    "name" VARCHAR(500) NOT NULL,
    "fb_type_name" VARCHAR(255) NOT NULL,
    "gvl_name" VARCHAR(255) NOT NULL,
    "comment" VARCHAR(500),

    CONSTRAINT "codesys_fb_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codesys_variable" (
    "id" SERIAL NOT NULL,
    "import_id" INTEGER NOT NULL,
    "signal_id" INTEGER,
    "name" VARCHAR(500) NOT NULL,
    "data_type" VARCHAR(100) NOT NULL,
    "gvl_name" VARCHAR(255) NOT NULL,
    "hw_address" VARCHAR(50),
    "io_direction" VARCHAR(10),
    "comment" VARCHAR(500),
    "is_raw" BOOLEAN NOT NULL DEFAULT false,
    "is_sensor_fault" BOOLEAN NOT NULL DEFAULT false,
    "group_tag" VARCHAR(500),

    CONSTRAINT "codesys_variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codesys_fb_connection" (
    "id" SERIAL NOT NULL,
    "import_id" INTEGER NOT NULL,
    "fb_instance_id" INTEGER NOT NULL,
    "variable_id" INTEGER,
    "parameter_name" VARCHAR(255) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "raw_expression" VARCHAR(500) NOT NULL,
    "source_file" VARCHAR(500) NOT NULL,

    CONSTRAINT "codesys_fb_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codesys_fb_definition_import_id_name_key" ON "codesys_fb_definition"("import_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "codesys_fb_parameter_fb_definition_id_name_key" ON "codesys_fb_parameter"("fb_definition_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "codesys_fb_instance_import_id_gvl_name_name_key" ON "codesys_fb_instance"("import_id", "gvl_name", "name");

-- CreateIndex
CREATE UNIQUE INDEX "codesys_variable_import_id_gvl_name_name_key" ON "codesys_variable"("import_id", "gvl_name", "name");

-- AddForeignKey
ALTER TABLE "codesys_import" ADD CONSTRAINT "codesys_import_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_definition" ADD CONSTRAINT "codesys_fb_definition_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "codesys_import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_definition" ADD CONSTRAINT "codesys_fb_definition_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_parameter" ADD CONSTRAINT "codesys_fb_parameter_fb_definition_id_fkey" FOREIGN KEY ("fb_definition_id") REFERENCES "codesys_fb_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_instance" ADD CONSTRAINT "codesys_fb_instance_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "codesys_import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_instance" ADD CONSTRAINT "codesys_fb_instance_fb_definition_id_fkey" FOREIGN KEY ("fb_definition_id") REFERENCES "codesys_fb_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_instance" ADD CONSTRAINT "codesys_fb_instance_component_instance_id_fkey" FOREIGN KEY ("component_instance_id") REFERENCES "component_instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_variable" ADD CONSTRAINT "codesys_variable_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "codesys_import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_variable" ADD CONSTRAINT "codesys_variable_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_connection" ADD CONSTRAINT "codesys_fb_connection_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "codesys_import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_connection" ADD CONSTRAINT "codesys_fb_connection_fb_instance_id_fkey" FOREIGN KEY ("fb_instance_id") REFERENCES "codesys_fb_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_fb_connection" ADD CONSTRAINT "codesys_fb_connection_variable_id_fkey" FOREIGN KEY ("variable_id") REFERENCES "codesys_variable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
