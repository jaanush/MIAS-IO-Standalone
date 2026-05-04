-- Engineering-unit physical-quantity classification.
--
-- Each unit gets a `quantity` (e.g. POWER_ACTIVE, VOLTAGE, TEMPERATURE),
-- an `is_primary` flag picking the canonical unit per quantity, and a
-- `scale_to_primary` multiplier that converts a value in this unit to the
-- equivalent value in the primary unit of the same quantity. A partial
-- unique index enforces "at most one primary per quantity".
--
-- A follow-up migration (or tRPC procedure) will use these columns to
-- rebase analog signals onto their quantity's primary unit, multiplying
-- scale_min/scale_max by `scale_to_primary` of their current unit. This
-- migration is fully additive — no signal data changes.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Schema
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE engineering_unit ADD COLUMN quantity VARCHAR(40);
ALTER TABLE engineering_unit ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE engineering_unit ADD COLUMN scale_to_primary DECIMAL(20, 10) NOT NULL DEFAULT 1.0;

CREATE UNIQUE INDEX engineering_unit_primary_per_quantity
  ON engineering_unit (quantity)
  WHERE is_primary = TRUE;

-- ──────────────────────────────────────────────────────────────────────
-- 2) Back-fill quantity / primary / scale for the 28 existing units
--    Match by `symbol` so re-running on a re-seeded DB lands the same way.
-- ──────────────────────────────────────────────────────────────────────

-- Power (active)  primary: kW
UPDATE engineering_unit SET quantity='POWER_ACTIVE', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='kW';

-- Power (apparent)  primary: kVA
UPDATE engineering_unit SET quantity='POWER_APPARENT', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='kVA';

-- Power (reactive)  primary: kVAr
UPDATE engineering_unit SET quantity='POWER_REACTIVE', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='kVAr';

-- Energy  primary: kWh
UPDATE engineering_unit SET quantity='ENERGY', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='kWh';
UPDATE engineering_unit SET quantity='ENERGY', is_primary=FALSE, scale_to_primary=1000
  WHERE symbol='MWh';

-- Voltage  primary: V DC (highest signal usage)
-- Note: V / V AC / V DC are the same unit physically (volts). AC/DC is a
-- signal qualifier, not a unit-level distinction. Modelled as one quantity
-- here — refine the AC/DC concern in a later pass.
UPDATE engineering_unit SET quantity='VOLTAGE', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='V DC';
UPDATE engineering_unit SET quantity='VOLTAGE', is_primary=FALSE, scale_to_primary=1
  WHERE symbol IN ('V', 'V AC');
UPDATE engineering_unit SET quantity='VOLTAGE', is_primary=FALSE, scale_to_primary=0.001
  WHERE symbol='mV';

-- Current  primary: A DC
UPDATE engineering_unit SET quantity='CURRENT', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='A DC';
UPDATE engineering_unit SET quantity='CURRENT', is_primary=FALSE, scale_to_primary=1
  WHERE symbol='A';
UPDATE engineering_unit SET quantity='CURRENT', is_primary=FALSE, scale_to_primary=0.001
  WHERE symbol='mA';

-- Charge  primary: As
UPDATE engineering_unit SET quantity='CHARGE', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='As';

-- Resistance  primary: kOhm
UPDATE engineering_unit SET quantity='RESISTANCE', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='kOhm';
UPDATE engineering_unit SET quantity='RESISTANCE', is_primary=FALSE, scale_to_primary=0.000001
  WHERE symbol='mOhm';

-- Frequency  primary: Hz
UPDATE engineering_unit SET quantity='FREQUENCY', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='Hz';

-- Pressure  primary: mBar (most-used in current data)
UPDATE engineering_unit SET quantity='PRESSURE', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='mBar';
UPDATE engineering_unit SET quantity='PRESSURE', is_primary=FALSE, scale_to_primary=0.01
  WHERE symbol='Pa';

-- Temperature  primary: °C
UPDATE engineering_unit SET quantity='TEMPERATURE', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='°C';

-- Length  primary: m
UPDATE engineering_unit SET quantity='LENGTH', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='m';
UPDATE engineering_unit SET quantity='LENGTH', is_primary=FALSE, scale_to_primary=1000
  WHERE symbol='km';

-- Mass  primary: kg
UPDATE engineering_unit SET quantity='MASS', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='kg';

-- Volume  primary: L
UPDATE engineering_unit SET quantity='VOLUME', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='L';

-- Time / duration  primary: Hours
UPDATE engineering_unit SET quantity='TIME', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='Hours';

-- Angular speed  primary: RPM
UPDATE engineering_unit SET quantity='ANGULAR_SPEED', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='RPM';

-- Torque  primary: NM (Newton-meter; symbol style is non-SI but unchanged here)
UPDATE engineering_unit SET quantity='TORQUE', is_primary=TRUE, scale_to_primary=1
  WHERE symbol='NM';

-- Ratio / dimensionless  primary: %
-- Rh ("Relative humidity") is just % constrained to humidity; same scale.
UPDATE engineering_unit SET quantity='RATIO', is_primary=TRUE,  scale_to_primary=1
  WHERE symbol='%';
UPDATE engineering_unit SET quantity='RATIO', is_primary=FALSE, scale_to_primary=1
  WHERE symbol='Rh';
