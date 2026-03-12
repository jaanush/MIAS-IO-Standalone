-- ============================================================
-- Missing PLCs (4) and Couplers (40)
-- Source: wago.com/se Controller 750 family + Fieldbus Couplers
-- ============================================================

-- ── Missing PLCs ──────────────────────────────────────────────────────────────

INSERT INTO device_catalog (vendor_name, article_number, description, type,
  ip_rating, extended_temp, eco, has_sd_card, has_media_redundancy, ethernet_ports,
  generation, program_memory_kb, ram_memory_kb)
VALUES
  -- Base MODBUS RS-485 (750-815/325-000 is the extended-temp variant already in DB)
  ('Wago', '750-815/300-000', 'Controller MODBUS; RS-485; 115.2 kBd',
   'PLC', 'IP20', false, false, false, false, NULL, NULL, NULL, NULL),

  -- CANopen high-memory variant (750-837 is 128/64 KB, this is 640/832 KB)
  ('Wago', '750-837/021-000', 'Controller CANopen; MCS; 640/832 KB Program/RAM',
   'PLC', 'IP20', false, false, false, false, NULL, NULL, 640, 832),

  -- 3rd gen ETHERNET base model (750-885/025-000 is the extended-temp variant)
  ('Wago', '750-885', 'Controller ETHERNET; 3rd Generation; SD Card; Media Redundancy',
   'PLC', 'IP20', false, false, true, true, 2, 3, NULL, NULL),

  -- Modbus TCP 4th gen; Remote Technology + Extended Temp + ECO
  ('Wago', '750-890/025-002',
   'Controller Modbus TCP; 4th Generation; Remote Technology; Extended Temperature; ECO',
   'PLC', 'IP20', true, true, true, false, 2, 4, NULL, NULL)
ON CONFLICT (vendor_name, article_number) DO NOTHING;

-- PLC protocol entries
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_RTU' FROM device_catalog WHERE article_number = '750-815/300-000'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number = '750-837/021-000'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number IN ('750-885', '750-890/025-002')
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;


-- ── Missing Couplers ──────────────────────────────────────────────────────────
-- Standard WAGO 750 specs: maxModules=64, busPowerBudget=1750 mA, 24VDC, IP20
-- Standard temp:  0°C / 55°C
-- Extended temp: -20°C / 60°C  (025-xxx variants)
-- Extreme:       -40°C / 70°C  (040-xxx variants)

INSERT INTO device_catalog (vendor_name, article_number, description, type,
  ip_rating, extended_temp, eco,
  max_modules, bus_power_budget_ma,
  supply_voltage_min_v, supply_voltage_max_v,
  temp_min_c, temp_max_c,
  ethernet_ports, data_rate_mbit,
  width_mm)
VALUES

-- ── Page 0 ────────────────────────────────────────────────────────────────────

  -- Modbus TCP 4th gen
  ('Wago', '750-362', 'Fieldbus Coupler Modbus TCP; 4th Generation',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- EtherNet/IP 4th gen ECO
  ('Wago', '750-363', 'Fieldbus Coupler EtherNet/IP; 4th Generation; ECO',
   'COUPLER', 'IP20', false, true, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- PROFIBUS DP 2nd gen 12 MBd
  ('Wago', '750-333', 'Fieldbus Coupler PROFIBUS DP; 2nd Generation; 12 MBd',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- Modbus TCP 4th gen Extreme
  ('Wago', '750-362/040-000', 'Fieldbus Coupler Modbus TCP; 4th Generation; Extreme',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -40, 70, 2, 100, 51),

  -- PROFINET 3rd gen ECO Advanced
  ('Wago', '750-377', 'Fieldbus Coupler PROFINET IO; 3rd Generation; ECO Advanced',
   'COUPLER', 'IP20', false, true, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- MODBUS RS-485
  ('Wago', '750-315/300-000', 'Fieldbus Coupler MODBUS; RS-485; 115.2 kBd',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- DeviceNet
  ('Wago', '750-306', 'Fieldbus Coupler DeviceNet',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- CANopen D-Sub
  ('Wago', '750-338', 'Fieldbus Coupler CANopen; D-Sub',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- MODBUS RS-232
  ('Wago', '750-316/300-000', 'Fieldbus Coupler MODBUS; RS-232; 115.2 kBd',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- EtherNet/IP M12 4th gen Extreme
  ('Wago', '750-365/040-010', 'Fieldbus Coupler EtherNet/IP M12; 4th Generation; Extreme',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -40, 70, 2, 100, 51),

  -- CC-Link
  ('Wago', '750-325', 'Fieldbus Coupler CC-Link',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- CANopen MCS ECO
  ('Wago', '750-347', 'Fieldbus Coupler CANopen; MCS; ECO',
   'COUPLER', 'IP20', false, true, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- PROFIBUS DP ECO
  ('Wago', '750-343', 'Fieldbus Coupler PROFIBUS DP; 12 MBd; ECO',
   'COUPLER', 'IP20', false, true, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- ETHERNET 1st gen
  ('Wago', '750-342', 'Fieldbus Coupler ETHERNET; 1st Generation',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- DeviceNet ECO
  ('Wago', '750-346', 'Fieldbus Coupler DeviceNet; ECO',
   'COUPLER', 'IP20', false, true, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- CANopen D-Sub Extreme
  ('Wago', '750-338/040-000', 'Fieldbus Coupler CANopen; D-Sub; Extreme',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -40, 70, 0, NULL, 51),

-- ── Page 1 ────────────────────────────────────────────────────────────────────

  -- CANopen D-Sub ECO
  ('Wago', '750-348', 'Fieldbus Coupler CANopen; D-Sub; ECO',
   'COUPLER', 'IP20', false, true, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- EtherNet/IP 4th gen DLR (Device Level Ring)
  ('Wago', '750-366', 'Fieldbus Coupler EtherNet/IP; 4th Generation; DLR',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- PROFINET 3rd gen Extended Temp Advanced
  ('Wago', '750-375/025-000', 'Fieldbus Coupler PROFINET IO; 3rd Generation; Extended Temperature; Advanced',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -20, 60, 2, 100, 51),

  -- PROFIBUS DP 2nd gen 12 MBd Extreme
  ('Wago', '750-333/040-000', 'Fieldbus Coupler PROFIBUS DP; 2nd Generation; 12 MBd; Extreme',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -40, 70, 0, NULL, 51),

  -- EtherCAT ID-Switch
  ('Wago', '750-354/000-001', 'Fieldbus Coupler EtherCAT; ID-Switch',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- EtherNet/IP 4th gen Extreme
  ('Wago', '750-363/040-000', 'Fieldbus Coupler EtherNet/IP; 4th Generation; Extreme',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -40, 70, 2, 100, 51),

  -- BACnet/IP 4th gen
  ('Wago', '750-332', 'Fieldbus Coupler BACnet/IP; 4th Generation',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- Modbus TCP M12 4th gen Extreme
  ('Wago', '750-364/040-010', 'Fieldbus Coupler Modbus TCP M12; 4th Generation; Extreme',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -40, 70, 2, 100, 51),

  -- CANopen MCS Extended Temp
  ('Wago', '750-337/025-000', 'Fieldbus Coupler CANopen; MCS; Extended Temperature',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -20, 60, 0, NULL, 51),

  -- Modbus TCP 4th gen (alternate variant)
  ('Wago', '750-362/000-001', 'Fieldbus Coupler Modbus TCP; 4th Generation',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- PROFINET 3rd gen Extended Temp ECO Advanced
  ('Wago', '750-377/025-000', 'Fieldbus Coupler PROFINET IO; 3rd Generation; Extended Temperature; ECO Advanced',
   'COUPLER', 'IP20', true, true, 64, 1750, 24, 24, -20, 60, 2, 100, 51),

  -- EtherCAT ID-Switch 100 Mbit/s Diagnostics
  ('Wago', '750-354/000-002', 'Fieldbus Coupler EtherCAT; ID-Switch; 100 Mbit/s; Diagnostics',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- INTERBUS
  ('Wago', '750-304', 'Fieldbus Coupler INTERBUS',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- DeviceNet variant 006
  ('Wago', '750-306/000-006', 'Fieldbus Coupler DeviceNet',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- INTERBUS ECO 500 kbit/s
  ('Wago', '750-344', 'Fieldbus Coupler INTERBUS; 500 kbit/s; ECO',
   'COUPLER', 'IP20', false, true, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- DeviceNet variant 005
  ('Wago', '750-306/000-005', 'Fieldbus Coupler DeviceNet',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- CC-Link (older generation)
  ('Wago', '750-310', 'Fieldbus Coupler CC-Link',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- PROFIBUS DP Fiber 1.5 MBd
  ('Wago', '750-331', 'Fieldbus Coupler PROFIBUS DP; Fiber Optic; 1.5 MBd',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- PROFINET 1st gen
  ('Wago', '750-340', 'Fieldbus Coupler PROFINET IO; 1st Generation',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 2, 100, 51),

  -- ETHERNET 3rd gen Extreme
  ('Wago', '750-352/040-000', 'Fieldbus Coupler ETHERNET; 3rd Generation; Extreme',
   'COUPLER', 'IP20', true, false, 64, 1750, 24, 24, -40, 70, 2, 100, 51),

-- ── Page 2 ────────────────────────────────────────────────────────────────────

  -- CANopen (basic, no MCS)
  ('Wago', '750-307', 'Fieldbus Coupler CANopen',
   'COUPLER', 'IP20', false, false, 64, 1750, 24, 24, 0, 55, 0, NULL, 51),

  -- 767-series: compact fieldbus stations with integrated 8ch DI 24VDC
  ('Wago', '767-1101', 'Compact Fieldbus Station PROFIBUS DP; 8-Channel Digital Input 24 VDC',
   'COUPLER', 'IP20', false, false, 8, 1750, 24, 24, 0, 55, 0, NULL, 51),

  ('Wago', '767-1301', 'Compact Fieldbus Station ETHERNET; 8-Channel Digital Input 24 VDC',
   'COUPLER', 'IP20', false, false, 8, 1750, 24, 24, 0, 55, 2, 100, 51),

  ('Wago', '767-1501', 'Compact Fieldbus Station CANopen; 8-Channel Digital Input 24 VDC',
   'COUPLER', 'IP20', false, false, 8, 1750, 24, 24, 0, 55, 0, NULL, 51)

ON CONFLICT (vendor_name, article_number) DO NOTHING;


-- ── Coupler protocol entries ──────────────────────────────────────────────────

-- Modbus TCP couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog
WHERE article_number IN (
  '750-362', '750-362/040-000', '750-362/000-001',
  '750-364/040-010', '750-342', '750-352/040-000', '767-1301'
)
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- EtherNet/IP couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog
WHERE article_number IN (
  '750-363', '750-363/040-000', '750-365/040-010', '750-366'
)
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- PROFINET couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFINET' FROM device_catalog
WHERE article_number IN (
  '750-377', '750-375/025-000', '750-377/025-000', '750-340'
)
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- CANopen couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog
WHERE article_number IN (
  '750-338', '750-338/040-000', '750-347', '750-348',
  '750-337/025-000', '750-307', '767-1501'
)
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- PROFIBUS couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFIBUS' FROM device_catalog
WHERE article_number IN (
  '750-333', '750-333/040-000', '750-343', '750-331', '767-1101'
)
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- DeviceNet couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'DEVICENET' FROM device_catalog
WHERE article_number IN (
  '750-306', '750-306/000-005', '750-306/000-006', '750-346'
)
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- EtherCAT couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERCAT' FROM device_catalog
WHERE article_number IN ('750-354/000-001', '750-354/000-002')
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- BACnet coupler
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'BACNET' FROM device_catalog
WHERE article_number = '750-332'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- MODBUS RTU couplers
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_RTU' FROM device_catalog
WHERE article_number IN ('750-315/300-000', '750-316/300-000')
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;
