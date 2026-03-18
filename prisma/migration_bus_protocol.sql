-- Add bus_protocol column to hardware_component
-- References the existing bus_protocol enum type

ALTER TABLE "hardware_component"
  ADD COLUMN "bus_protocol" "bus_protocol";
