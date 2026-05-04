-- FR-019: per-iface CAN_Task cadence override on the bus row.
-- null = use CAN_Task cycle (10 ms today). API enforces 10..200,
-- multiple of 10. Plugin renderer emits `tCallInterval := T#<value>MS`
-- and auto-staggers `tCallOffset` to avoid all slow ifaces firing on
-- the same tick.

-- AlterTable
ALTER TABLE "plc_network" ADD COLUMN "cyclic_call_interval_ms" INTEGER;
