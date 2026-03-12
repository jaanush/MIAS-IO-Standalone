-- =============================================================================
-- Seed: WAGO Device Catalog (PLCs, Couplers, Protocols, Approvals)
-- =============================================================================
--
-- Seeds the device_catalog, device_catalog_protocol, approval, and
-- device_catalog_approval tables with the complete WAGO product line.
--
-- Contents:
--   1. PLCs (74 rows) — grouped by series
--   2. Couplers (47 rows) — grouped by protocol family
--   3. Protocol assignments (216 rows) — one per device+protocol pair
--   4. Approvals (20 rows)
--   5. Device ↔ Approval links (per-product, from WAGO datasheets)
--   6. Summary SELECT statements
--
-- All device_catalog INSERTs use ON CONFLICT DO UPDATE SET so re-running
-- updates existing rows with enriched/corrected values.
--
-- Apply:
--   docker exec -i mias-io-postgres-1 psql -U mias -d mias_io < prisma/seed_device_catalog.sql
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. PLCs (74 rows)                                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_catalog (
  vendor_name, article_number, description,
  type, series, generation, ethernet_ports,
  has_sd_card, has_media_redundancy, extended_temp, eco,
  program_memory_kb, ram_memory_kb, data_memory_kb,
  ip_rating, temp_min_c, temp_max_c,
  max_modules, bus_power_budget_ma,
  supply_voltage_min_v, supply_voltage_max_v, internal_current_ma,
  width_mm, height_mm, depth_mm,
  data_rate_mbit,
  notes, created_at, updated_at
) VALUES

-- ── 750 Series ─────────────────────────────────────────────────────────────

-- DeviceNet
('Wago', '750-806', 'Controller DeviceNet',
 'PLC', '750 Series', 1, 0,
 FALSE, FALSE, FALSE, FALSE,
 16, 16, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 300,
 51, 100, 70,
 NULL,
 'Combines control, I/O interface, and DeviceNet fieldbus. IEC 61131-3.',
 NOW(), NOW()),

-- MODBUS RTU (Serial)
('Wago', '750-815/300-000', 'Controller MODBUS; RS-485; 115.2 kBd',
 'PLC', '750 Series', 1, 0,
 FALSE, FALSE, FALSE, FALSE,
 16, 16, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 300,
 51, 100, 70,
 1,
 NULL,
 NOW(), NOW()),

('Wago', '750-815/325-000', 'Controller MODBUS; RS-485; 115.2 kBd; Extended Temperature',
 'PLC', '750 Series', 1, 0,
 FALSE, FALSE, TRUE, FALSE,
 16, 16, 256,
 'IP20', -20, 60,
 64, 1800,
 18, 32, 300,
 51, 100, 70,
 1,
 'RS-485 serial interface at 115.2 kBaud. Extended temperature. IEC 61131-3.',
 NOW(), NOW()),

('Wago', '750-816/300-000', 'Controller MODBUS; RS-232; 115.2 kBd',
 'PLC', '750 Series', 1, 0,
 FALSE, FALSE, FALSE, FALSE,
 16, 16, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 300,
 51, 100, 70,
 1,
 'RS-232 serial interface at 115.2 kBaud. IEC 61131-3.',
 NOW(), NOW()),

-- EtherNet/IP 4th Gen
('Wago', '750-823', 'Controller EtherNet/IP; 4th Generation; 2 x ETHERNET; ECO',
 'PLC', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, TRUE,
 128, 64, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 250,
 51, 100, 70,
 100,
 'ECO variant. Two Ethernet interfaces with integrated switch. IEC 61131-3.',
 NOW(), NOW()),

-- BACnet
('Wago', '750-829', 'Controller BACnet MS/TP',
 'PLC', '750 Series', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 640, 832, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 350,
 51, 100, 70,
 100,
 'RS-485 MS/TP interface with termination resistor switching. 1x Ethernet service port + 2x Ethernet fieldbus ports. Max 250 BACnet objects.',
 NOW(), NOW()),

('Wago', '750-832', 'Controller BACnet/IP; 4th Generation; 2 x ETHERNET; SD Card',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, FALSE, FALSE,
 640, 832, 8192,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 '8 MB data memory. Max 1000 BACnet objects. B-BC profile per DIN EN ISO 16484-5. RTC with battery backup.',
 NOW(), NOW()),

('Wago', '750-832/000-002', 'Controller BACnet/IP; 4th Generation; 2 x ETHERNET; SD Card; Extended Features',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, FALSE, FALSE,
 640, 832, 8192,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Extended feature variant of 750-832.',
 NOW(), NOW()),

-- PROFIBUS
('Wago', '750-833', 'Controller PROFIBUS Slave',
 'PLC', '750 Series', 2, 0,
 FALSE, FALSE, FALSE, FALSE,
 128, 64, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 350,
 51, 100, 70,
 NULL,
 'Combines control, I/O interface, and PROFIBUS in one unit. IEC 61131-3.',
 NOW(), NOW()),

('Wago', '750-833/025-000', 'Controller PROFIBUS Slave; Extended Temperature',
 'PLC', '750 Series', 2, 0,
 FALSE, FALSE, TRUE, FALSE,
 128, 64, 256,
 'IP20', -20, 60,
 64, 1800,
 18, 32, 350,
 51, 100, 70,
 NULL,
 'Extended temperature variant of 750-833.',
 NOW(), NOW()),

-- CANopen
('Wago', '750-837', 'Controller CANopen; MCS; 128/64 KB Program/RAM',
 'PLC', '750 Series', 2, 0,
 FALSE, FALSE, FALSE, FALSE,
 128, 64, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 350,
 51, 100, 70,
 NULL,
 'MCS variant. 128 KB program memory, 64 KB RAM. IEC 61131-3.',
 NOW(), NOW()),

('Wago', '750-837/021-000', 'Controller CANopen; MCS; 640/832 KB Program/RAM',
 'PLC', '750 Series', 2, 0,
 FALSE, FALSE, FALSE, FALSE,
 640, 832, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 350,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-838', 'Controller CANopen; 128/64 KB Program/RAM; D-Sub',
 'PLC', '750 Series', 2, 0,
 FALSE, FALSE, FALSE, FALSE,
 128, 64, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 350,
 51, 100, 70,
 NULL,
 '128 KB program memory, 64 KB RAM. D-Sub connector. IEC 61131-3.',
 NOW(), NOW()),

('Wago', '750-838/021-000', 'Controller CANopen; 640/832 KB Program/RAM; D-Sub',
 'PLC', '750 Series', 2, 0,
 FALSE, FALSE, FALSE, FALSE,
 640, 832, 256,
 'IP20', 0, 55,
 64, 1800,
 18, 32, 350,
 51, 100, 70,
 NULL,
 'Extended memory variant. 640 KB program, 832 KB RAM. D-Sub connector. IEC 61131-3.',
 NOW(), NOW()),

('Wago', '750-838/040-000', 'Controller CANopen; 640/832 KB Program/RAM; D-Sub; XTR',
 'PLC', '750 Series', 2, 0,
 FALSE, FALSE, TRUE, FALSE,
 640, 832, 256,
 'IP20', -40, 70,
 64, 1800,
 18, 32, 350,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

-- Ethernet 1st Gen
('Wago', '750-842', 'Controller ETHERNET; 1st Generation',
 'PLC', '750 Series', 1, 1,
 FALSE, FALSE, FALSE, FALSE,
 16, 16, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 300,
 51, 100, 70,
 100,
 'Combines control, I/O interface, and Ethernet. IEC 61131-3. TCP/UDP Socket-API via function blocks.',
 NOW(), NOW()),

('Wago', '750-843', 'Controller ETHERNET; 1st Generation; ECO',
 'PLC', '750 Series', 1, 1,
 FALSE, FALSE, FALSE, TRUE,
 16, 16, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 300,
 51, 100, 70,
 100,
 'ECO variant of 750-842. IEC 61131-3.',
 NOW(), NOW()),

-- Modbus TCP 4th Gen
('Wago', '750-862', 'Controller Modbus TCP; 4th Generation; 2 x ETHERNET; ECO',
 'PLC', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, TRUE,
 128, 64, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 250,
 51, 100, 70,
 100,
 'ECO variant. Line topology via integrated switch. IEC 61131-3.',
 NOW(), NOW()),

-- Ethernet 3rd Gen
('Wago', '750-880', 'Controller ETHERNET; 3rd Generation; 2 x ETHERNET; SD Card',
 'PLC', '750 Series', 3, 2,
 TRUE, FALSE, FALSE, FALSE,
 640, 832, 1024,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 '1 MB data memory. SD card. Supports Modbus TCP, EtherNet/IP, IEC 60870-5, IEC 61850. RTC.',
 NOW(), NOW()),

('Wago', '750-880/025-000', 'Controller ETHERNET; 3rd Generation; SD Card; Extended Temperature',
 'PLC', '750 Series', 3, 2,
 TRUE, FALSE, TRUE, FALSE,
 640, 832, 1024,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Extended temperature variant of 750-880.',
 NOW(), NOW()),

('Wago', '750-880/025-001', 'Controller ETHERNET; 3rd Generation; SD Card; Remote Technology; Extended Temperature',
 'PLC', '750 Series', 3, 2,
 TRUE, FALSE, TRUE, FALSE,
 640, 832, 1024,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Remote technology + extended temperature variant of 750-880.',
 NOW(), NOW()),

('Wago', '750-880/025-002', 'Controller ETHERNET; 3rd Generation; SD Card; Remote Technology; Extended Temperature; ECO',
 'PLC', '750 Series', 3, 2,
 TRUE, FALSE, TRUE, TRUE,
 128, 64, 256,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 250,
 51, 100, 70,
 100,
 'ECO + remote technology + extended temperature variant of 750-880.',
 NOW(), NOW()),

('Wago', '750-881', 'Controller ETHERNET; 3rd Generation; 2 x ETHERNET',
 'PLC', '750 Series', 3, 2,
 FALSE, FALSE, FALSE, FALSE,
 640, 832, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Two Ethernet interfaces with integrated switch. Modbus TCP and EtherNet/IP capable. IEC 61131-3.',
 NOW(), NOW()),

('Wago', '750-882', 'Controller ETHERNET; 3rd Generation; Media Redundancy',
 'PLC', '750 Series', 3, 2,
 FALSE, TRUE, FALSE, FALSE,
 640, 832, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Two separate Ethernet interfaces for media redundancy (distinct IP + MAC). Modbus TCP. IEC 61131-3.',
 NOW(), NOW()),

-- flexROOM
('Wago', '750-884', 'Controller flexROOM®',
 'PLC', '750 Series', 3, 2,
 TRUE, FALSE, FALSE, FALSE,
 640, 832, 1024,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 '1 MB data memory. SD card. Optimised for building automation (HVAC, lighting, blinds). IEC 61131-3.',
 NOW(), NOW()),

('Wago', '750-884/000-008', 'Controller flexROOM®; FG8',
 'PLC', '750 Series', 3, 2,
 TRUE, FALSE, FALSE, FALSE,
 640, 832, 1024,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'FG8 variant of flexROOM®. 1 MB data memory. SD card. Building automation.',
 NOW(), NOW()),

-- Media Redundancy + SD
('Wago', '750-885', 'Controller ETHERNET; 3rd Generation; SD Card; Media Redundancy',
 'PLC', '750 Series', 3, 2,
 TRUE, TRUE, FALSE, FALSE,
 640, 832, 1024,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-885/025-000', 'Controller ETHERNET; 3rd Generation; SD Card; Media Redundancy; Extended Temperature',
 'PLC', '750 Series', 3, 2,
 TRUE, TRUE, TRUE, FALSE,
 640, 832, 1024,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'SD card, media redundancy, extended temperature. IEC 61131-3.',
 NOW(), NOW()),

-- KNX IP
('Wago', '750-889', 'Controller KNX IP',
 'PLC', '750 Series', 3, 2,
 FALSE, FALSE, FALSE, FALSE,
 1024, NULL, 1024,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 '32-bit processor. 1024 KB program memory, 1024 KB data memory, 32 KB permanent memory. Max 253 communication objects, 254 group addresses. MODBUS also supported.',
 NOW(), NOW()),

-- Modbus TCP 4th Gen (SD Card variants)
('Wago', '750-890', 'Controller Modbus TCP; 4th Generation; 2 x ETHERNET; SD Card',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, FALSE, FALSE,
 640, 832, 8192,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 '8 MB data memory. SD card for parameter transfer and FTP file storage. RTC with battery backup.',
 NOW(), NOW()),

('Wago', '750-890/025-000', 'Controller Modbus TCP; 4th Generation; 2 x ETHERNET; SD Card; Extended Temperature',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, TRUE, FALSE,
 640, 832, 8192,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Extended temperature variant of 750-890.',
 NOW(), NOW()),

('Wago', '750-890/025-001', 'Controller Modbus TCP; 4th Generation; 2 x ETHERNET; SD Card; Extended Temperature',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, TRUE, FALSE,
 640, 832, 8192,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Extended temperature variant. 2x Ethernet, SD card.',
 NOW(), NOW()),

('Wago', '750-890/025-002', 'Controller Modbus TCP; 4th Generation; Remote Technology; Extended Temperature; ECO',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, TRUE, TRUE,
 128, 64, 256,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 250,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-890/040-000', 'Controller Modbus TCP; G4; 2x ETHERNET, SD Card; XTR',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, TRUE, FALSE,
 640, 832, 8192,
 'IP20', -40, 70,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-891', 'Controller Modbus TCP; 4th Generation; 2 x ETHERNET',
 'PLC', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, FALSE,
 640, 832, 256,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 'Line topology via integrated switch. HTTP, BootP, DHCP, DNS, SNTP, SNMP, FTP. IEC 61131-3.',
 NOW(), NOW()),

-- EtherNet/IP 4th Gen (SD Card)
('Wago', '750-893', 'Controller EtherNet/IP; 4th Generation; 2 x ETHERNET; SD Card',
 'PLC', '750 Series', 4, 2,
 TRUE, FALSE, FALSE, FALSE,
 640, 832, 8192,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 '8 MB data memory. SD card slot. RTC with battery backup. IEC 61131-3.',
 NOW(), NOW()),

-- ── Basic Controller 100 ─────────────────────────────────────────────────

('Wago', '750-8000', 'Basic Controller 100; 2x ETHERNET; ECO',
 'PLC', 'Basic Controller 100', 4, 2,
 FALSE, FALSE, FALSE, TRUE,
 128, 128, 1024,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 300,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-8001', 'Basic Controller 100; 2x ETHERNET; SD Card',
 'PLC', 'Basic Controller 100', 4, 2,
 TRUE, FALSE, FALSE, FALSE,
 128, 128, 1024,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 350,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- ── PFC100 ─────────────────────────────────────────────────────────────────

('Wago', '750-8110', 'Controller PFC100; 2x ETHERNET; ECO',
 'PLC', 'PFC100', 1, 2,
 FALSE, FALSE, FALSE, TRUE,
 256, 256, 4096,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 350,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-8111', 'Controller PFC100; 2x ETHERNET',
 'PLC', 'PFC100', 1, 2,
 FALSE, FALSE, FALSE, FALSE,
 256, 256, 4096,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-8112', 'Controller PFC100; 2x ETHERNET, RS-232/RS-485',
 'PLC', 'PFC100', 1, 2,
 FALSE, FALSE, FALSE, FALSE,
 256, 256, 4096,
 'IP20', 0, 55,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-8112/025-000', 'Controller PFC100; 2x ETHERNET, RS-232/RS-485; Extended Temperature',
 'PLC', 'PFC100', 1, 2,
 FALSE, FALSE, TRUE, FALSE,
 256, 256, 4096,
 'IP20', -20, 60,
 250, 1800,
 18, 32, 400,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- ── PFC200 ─────────────────────────────────────────────────────────────────

-- G1
('Wago', '750-8208', 'Controller PFC200; G1; 2x ETHERNET, RS-232/RS-485, CAN, CANopen, PROFIBUS Master',
 'PLC', 'PFC200', 1, 2,
 FALSE, FALSE, FALSE, FALSE,
 1024, 512, 4096,
 'IP20', 0, 55,
 250, 2000,
 18, 32, 500,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-8208/025-000', 'Controller PFC200; G1; 2x ETHERNET, RS-232/RS-485, CAN, CANopen, PROFIBUS Master; Extended Temperature',
 'PLC', 'PFC200', 1, 2,
 FALSE, FALSE, TRUE, FALSE,
 1024, 512, 4096,
 'IP20', -20, 60,
 250, 2000,
 18, 32, 500,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-8208/025-001', 'Controller PFC200; G1; PROFIBUS Master; Telecontrol; Extended Temperature',
 'PLC', 'PFC200', 1, 2,
 FALSE, FALSE, TRUE, FALSE,
 1024, 512, 4096,
 'IP20', -20, 60,
 250, 2000,
 18, 32, 500,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- G2 (4x Ethernet)
('Wago', '750-8210', 'Controller PFC200; G2; 4x ETHERNET',
 'PLC', 'PFC200', 2, 4,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 65, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8210/025-000', 'Controller PFC200; G2; 4x ETHERNET; Extended Temperature',
 'PLC', 'PFC200', 2, 4,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 65, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8210/040-000', 'Controller PFC200 XTR; G2; 4x ETHERNET',
 'PLC', 'PFC200', 2, 4,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -40, 70,
 250, 2500,
 18, 32, 600,
 65, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- G2 (2x Ethernet + 2x SFP)
('Wago', '750-8211', 'Controller PFC200; G2; 2x ETHERNET, 2x SFP',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8211/040-000', 'Controller PFC200 XTR; G2; 2x ETHERNET, 2x SFP',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -40, 70,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- G2 (2x Ethernet + RS-232/RS-485)
('Wago', '750-8212', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8212/000-100', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485; BACnet/IP',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8212/025-000', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485; Extended Temperature',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8212/025-001', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485; Telecontrol; Extended Temperature',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8212/025-002', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485; Telecontrol ECO; Extended Temperature',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, TRUE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8212/040-000', 'Controller PFC200 XTR; G2; 2x ETHERNET, RS-232/RS-485',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -40, 70,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8212/040-001', 'Controller PFC200 XTR; G2; 2x ETHERNET, RS-232/RS-485; Telecontrol',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -40, 70,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8212/040-010', 'Controller PFC200 XTR; G2; 2x ETHERNET M12, RS-232/RS-485',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -40, 70,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- G2 (CAN/CANopen variants)
('Wago', '750-8213', 'Controller PFC200; G2; 2x ETHERNET, CAN, CANopen',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8213/040-010', 'Controller PFC200 XTR; G2; 2x ETHERNET M12, CAN, CANopen',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -40, 70,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8214', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485, CAN, CANopen',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- G2 (4x Ethernet + CAN + USB)
('Wago', '750-8215', 'Controller PFC200; G2; 4x ETHERNET, CAN, CANopen, USB',
 'PLC', 'PFC200', 2, 4,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 65, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- G2 (PROFIBUS Slave variants)
('Wago', '750-8216', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485, CAN, CANopen, PROFIBUS Slave',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8216/025-000', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485, CAN, CANopen, PROFIBUS Slave; Extended Temperature',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8216/025-001', 'Controller PFC200; G2; PROFIBUS Slave; Telecontrol; Extended Temperature',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8216/040-000', 'Controller PFC200 XTR; G2; 2x ETHERNET, RS-232/RS-485, CAN, CANopen, PROFIBUS Slave',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -40, 70,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- G2 (4G Mobile Radio variants)
('Wago', '750-8217', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485, 4G Mobile Radio',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8217/025-000', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485, 4G Mobile Radio; Extended Temperature',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8217/600-000', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485, 4G Mobile Radio; Global Variant',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, FALSE, FALSE,
 2048, 1024, 8192,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '750-8217/625-000', 'Controller PFC200; G2; 2x ETHERNET, RS-232/RS-485, 4G Mobile Radio; Global Variant; Extended Temperature',
 'PLC', 'PFC200', 2, 2,
 FALSE, FALSE, TRUE, FALSE,
 2048, 1024, 8192,
 'IP20', -20, 60,
 250, 2500,
 18, 32, 600,
 51, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- ── PFC300 ─────────────────────────────────────────────────────────────────

('Wago', '750-8302', 'Controller PFC300; 2x ETHERNET, RS-485; PROFINET Controller; EtherCAT Master',
 'PLC', 'PFC300', 1, 2,
 FALSE, FALSE, FALSE, FALSE,
 4096, 2048, 16384,
 'IP20', 0, 55,
 250, 2500,
 18, 32, 800,
 65, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- ── Compact Controller 100 ────────────────────────────────────────────────

('Wago', '751-9401', 'Compact Controller 100; 8DI 4DO 2AI 2AO 2RTD 1RS485; 2x ETHERNET, CAN, CANopen; SD',
 'PLC', 'Compact Controller 100', 1, 2,
 TRUE, FALSE, TRUE, FALSE,
 256, 256, 4096,
 'IP20', -20, 60,
 64, 1800,
 18, 32, 500,
 140, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '751-9402', 'Compact Controller 100; 8DI 8DIO 2AI 2AIO 2RTD 2RS485; 2x ETHERNET; SD',
 'PLC', 'Compact Controller 100', 1, 2,
 TRUE, FALSE, TRUE, FALSE,
 256, 256, 4096,
 'IP20', -20, 60,
 64, 1800,
 18, 32, 500,
 140, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

('Wago', '751-9403', 'Compact Controller 100; 8DI 4DO 2AO 2RTD 1RS485 1DALI; 2x ETHERNET; SD',
 'PLC', 'Compact Controller 100', 1, 2,
 TRUE, FALSE, TRUE, FALSE,
 256, 256, 4096,
 'IP20', -20, 60,
 64, 1800,
 18, 32, 500,
 140, 100, 70,
 1000,
 NULL,
 NOW(), NOW()),

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. Couplers (47 rows)                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── PROFIBUS Couplers ────────────────────────────────────────────────────

('Wago', '750-303', 'Fieldbus Coupler PROFIBUS DP; 12 Mbit/s',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 55,
 64, 1750,
 18, 30, 100,
 51, 100, 70,
 NULL,
 'PROFIBUS DP/V1 slave coupler. Up to 12 Mbit/s. Max 64 modules, 1750 mA bus power.',
 NOW(), NOW()),

('Wago', '750-331', 'Fieldbus Coupler PROFIBUS DP; Fiber Optic; 1.5 MBd',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-333', 'Fieldbus Coupler PROFIBUS DP; 2nd Generation; 12 MBd',
 'COUPLER', '750 Series', 2, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-333/025-000', 'Fieldbus Coupler PROFIBUS DP; 2nd Generation; 12 MBd; Extended Temperature',
 'COUPLER', '750 Series', 2, 0,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 60,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-333/040-000', 'Fieldbus Coupler PROFIBUS DP; 2nd Generation; 12 MBd; Extreme',
 'COUPLER', '750 Series', 2, 0,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -40, 70,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-343', 'Fieldbus Coupler PROFIBUS DP; 12 MBd; ECO',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, TRUE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

-- ── INTERBUS Couplers ────────────────────────────────────────────────────

('Wago', '750-304', 'Fieldbus Coupler INTERBUS',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-344', 'Fieldbus Coupler INTERBUS; 500 kbit/s; ECO',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, TRUE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

-- ── DeviceNet Couplers ───────────────────────────────────────────────────

('Wago', '750-306', 'Fieldbus Coupler DeviceNet',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-306/000-005', 'Fieldbus Coupler DeviceNet',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-306/000-006', 'Fieldbus Coupler DeviceNet',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-346', 'Fieldbus Coupler DeviceNet; ECO',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, TRUE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

-- ── CANopen Couplers ─────────────────────────────────────────────────────

('Wago', '750-307', 'Fieldbus Coupler CANopen',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-337', 'Fieldbus Coupler CANopen',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 55,
 64, 1750,
 18, 30, 100,
 51, 100, 70,
 NULL,
 'CANopen slave coupler. Up to 1 Mbit/s. Max 64 modules, 1750 mA bus power.',
 NOW(), NOW()),

('Wago', '750-337/025-000', 'Fieldbus Coupler CANopen; MCS; Extended Temperature',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 60,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-338', 'Fieldbus Coupler CANopen; D-Sub',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-338/040-000', 'Fieldbus Coupler CANopen; D-Sub; Extreme',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -40, 70,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-347', 'Fieldbus Coupler CANopen; MCS; ECO',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, TRUE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-348', 'Fieldbus Coupler CANopen; D-Sub; ECO',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, TRUE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

-- ── CC-Link Couplers ─────────────────────────────────────────────────────

('Wago', '750-310', 'Fieldbus Coupler CC-Link',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-325', 'Fieldbus Coupler CC-Link',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

-- ── MODBUS RTU Couplers ──────────────────────────────────────────────────

('Wago', '750-315/300-000', 'Fieldbus Coupler MODBUS; RS-485; 115.2 kBd',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '750-316/300-000', 'Fieldbus Coupler MODBUS; RS-232; 115.2 kBd',
 'COUPLER', '750 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

-- ── BACnet Couplers ──────────────────────────────────────────────────────

('Wago', '750-332', 'Fieldbus Coupler BACnet/IP; 4th Generation',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- ── PROFINET Couplers ────────────────────────────────────────────────────

('Wago', '750-340', 'Fieldbus Coupler PROFINET IO; 1st Generation',
 'COUPLER', '750 Series', 1, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-375', 'Fieldbus Coupler PROFINET IO; 2 x ETHERNET',
 'COUPLER', '750 Series', NULL, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 55,
 64, 1750,
 18, 30, 100,
 51, 100, 70,
 100,
 'PROFINET IO device coupler. 2-port integrated switch. Conformance class B. Max 64 modules, 1750 mA bus power.',
 NOW(), NOW()),

('Wago', '750-375/025-000', 'Fieldbus Coupler PROFINET IO; 3rd Generation; Extended Temperature; Advanced',
 'COUPLER', '750 Series', 3, 2,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 60,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-377', 'Fieldbus Coupler PROFINET IO; 3rd Generation; ECO Advanced',
 'COUPLER', '750 Series', 3, 2,
 FALSE, FALSE, FALSE, TRUE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-377/025-000', 'Fieldbus Coupler PROFINET IO; 3rd Generation; Extended Temperature; ECO Advanced',
 'COUPLER', '750 Series', 3, 2,
 FALSE, FALSE, TRUE, TRUE,
 NULL, NULL, NULL,
 'IP20', -20, 60,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- ── EtherNet/IP Couplers ─────────────────────────────────────────────────

('Wago', '750-341', 'Fieldbus Coupler EtherNet/IP; 2 x ETHERNET',
 'COUPLER', '750 Series', NULL, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 55,
 64, 1750,
 18, 30, 100,
 51, 100, 70,
 100,
 'EtherNet/IP adapter coupler. 2-port integrated switch for line topology. Max 64 modules, 1750 mA bus power.',
 NOW(), NOW()),

('Wago', '750-363', 'Fieldbus Coupler EtherNet/IP; 4th Generation; ECO',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, TRUE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 50,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-363/040-000', 'Fieldbus Coupler EtherNet/IP; 4th Generation; Extreme',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -40, 70,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-365/040-010', 'Fieldbus Coupler EtherNet/IP M12; 4th Generation; Extreme',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -40, 70,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-366', 'Fieldbus Coupler EtherNet/IP; 4th Generation; DLR',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- ── Modbus TCP Couplers ──────────────────────────────────────────────────

('Wago', '750-342', 'Fieldbus Coupler ETHERNET; 1st Generation',
 'COUPLER', '750 Series', 1, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 100,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-352', 'Fieldbus Coupler Modbus TCP; 2 x ETHERNET',
 'COUPLER', '750 Series', NULL, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 55,
 64, 1750,
 18, 30, 100,
 51, 100, 70,
 100,
 'Connects WAGO-I/O-SYSTEM 750 to Modbus TCP. Integrated 2-port switch for line topology. Max 64 modules, 1750 mA bus power.',
 NOW(), NOW()),

('Wago', '750-352/040-000', 'Fieldbus Coupler ETHERNET; 3rd Generation; Extreme',
 'COUPLER', '750 Series', 3, 2,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -40, 70,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-362', 'Fieldbus Coupler Modbus TCP; 4th Generation',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-362/000-001', 'Fieldbus Coupler Modbus TCP; 4th Generation',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-362/040-000', 'Fieldbus Coupler Modbus TCP; 4th Generation; Extreme',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -40, 70,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-364/040-010', 'Fieldbus Coupler Modbus TCP M12; 4th Generation; Extreme',
 'COUPLER', '750 Series', 4, 2,
 FALSE, FALSE, TRUE, FALSE,
 NULL, NULL, NULL,
 'IP20', -40, 70,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- ── EtherCAT Couplers ────────────────────────────────────────────────────

('Wago', '750-354', 'Fieldbus Coupler EtherCAT',
 'COUPLER', '750 Series', NULL, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', -20, 55,
 64, 1750,
 18, 30, 150,
 51, 100, 70,
 100,
 'EtherCAT slave coupler. 100 Mbit/s. Max 64 modules, 1750 mA bus power. Supports distributed clocks.',
 NOW(), NOW()),

('Wago', '750-354/000-001', 'Fieldbus Coupler EtherCAT; ID-Switch',
 'COUPLER', '750 Series', NULL, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '750-354/000-002', 'Fieldbus Coupler EtherCAT; ID-Switch; 100 Mbit/s; Diagnostics',
 'COUPLER', '750 Series', NULL, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 64, 1750,
 24, 24, 150,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

-- ── 767 Compact Fieldbus Stations ────────────────────────────────────────

('Wago', '767-1101', 'Compact Fieldbus Station PROFIBUS DP; 8-Channel Digital Input 24 VDC',
 'COUPLER', '767 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 8, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW()),

('Wago', '767-1301', 'Compact Fieldbus Station ETHERNET; 8-Channel Digital Input 24 VDC',
 'COUPLER', '767 Series', NULL, 2,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 8, 1750,
 24, 24, 100,
 51, 100, 70,
 100,
 NULL,
 NOW(), NOW()),

('Wago', '767-1501', 'Compact Fieldbus Station CANopen; 8-Channel Digital Input 24 VDC',
 'COUPLER', '767 Series', NULL, 0,
 FALSE, FALSE, FALSE, FALSE,
 NULL, NULL, NULL,
 'IP20', 0, 55,
 8, 1750,
 24, 24, 100,
 51, 100, 70,
 NULL,
 NULL,
 NOW(), NOW())

ON CONFLICT (vendor_name, article_number) DO UPDATE SET
  description            = EXCLUDED.description,
  type                   = EXCLUDED.type,
  series                 = EXCLUDED.series,
  generation             = EXCLUDED.generation,
  ethernet_ports         = EXCLUDED.ethernet_ports,
  has_sd_card            = EXCLUDED.has_sd_card,
  has_media_redundancy   = EXCLUDED.has_media_redundancy,
  extended_temp          = EXCLUDED.extended_temp,
  eco                    = EXCLUDED.eco,
  program_memory_kb      = EXCLUDED.program_memory_kb,
  ram_memory_kb          = EXCLUDED.ram_memory_kb,
  data_memory_kb         = EXCLUDED.data_memory_kb,
  ip_rating              = EXCLUDED.ip_rating,
  temp_min_c             = EXCLUDED.temp_min_c,
  temp_max_c             = EXCLUDED.temp_max_c,
  max_modules            = EXCLUDED.max_modules,
  bus_power_budget_ma    = EXCLUDED.bus_power_budget_ma,
  supply_voltage_min_v   = EXCLUDED.supply_voltage_min_v,
  supply_voltage_max_v   = EXCLUDED.supply_voltage_max_v,
  internal_current_ma    = EXCLUDED.internal_current_ma,
  width_mm               = EXCLUDED.width_mm,
  height_mm              = EXCLUDED.height_mm,
  depth_mm               = EXCLUDED.depth_mm,
  data_rate_mbit         = EXCLUDED.data_rate_mbit,
  notes                  = EXCLUDED.notes,
  updated_at             = NOW();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. Protocol Assignments (216 rows)                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── Coupler Protocols ────────────────────────────────────────────────────

-- 750-303: PROFIBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFIBUS' FROM device_catalog WHERE article_number = '750-303' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-304: INTERBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'INTERBUS' FROM device_catalog WHERE article_number = '750-304' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-306, 750-306/000-005, 750-306/000-006: DEVICENET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'DEVICENET' FROM device_catalog WHERE article_number IN ('750-306', '750-306/000-005', '750-306/000-006') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-307: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number = '750-307' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-310: CC_LINK
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CC_LINK' FROM device_catalog WHERE article_number = '750-310' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-315/300-000: MODBUS_RTU
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_RTU' FROM device_catalog WHERE article_number = '750-315/300-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-316/300-000: MODBUS_RTU
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_RTU' FROM device_catalog WHERE article_number = '750-316/300-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-325: CC_LINK
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CC_LINK' FROM device_catalog WHERE article_number = '750-325' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-331: PROFIBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFIBUS' FROM device_catalog WHERE article_number = '750-331' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-332: BACNET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'BACNET' FROM device_catalog WHERE article_number = '750-332' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-333, 750-333/025-000, 750-333/040-000: PROFIBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFIBUS' FROM device_catalog WHERE article_number IN ('750-333', '750-333/025-000', '750-333/040-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-337, 750-337/025-000: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number IN ('750-337', '750-337/025-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-338, 750-338/040-000: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number IN ('750-338', '750-338/040-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-340: PROFINET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFINET' FROM device_catalog WHERE article_number = '750-340' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-341: ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog WHERE article_number = '750-341' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-342: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-342' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-343: PROFIBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFIBUS' FROM device_catalog WHERE article_number = '750-343' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-344: INTERBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'INTERBUS' FROM device_catalog WHERE article_number = '750-344' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-346: DEVICENET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'DEVICENET' FROM device_catalog WHERE article_number = '750-346' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-347: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number = '750-347' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-348: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number = '750-348' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-352: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-352' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-352/040-000: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-352/040-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-354, 750-354/000-001, 750-354/000-002: ETHERCAT
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERCAT' FROM device_catalog WHERE article_number IN ('750-354', '750-354/000-001', '750-354/000-002') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-362, 750-362/000-001, 750-362/040-000: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number IN ('750-362', '750-362/000-001', '750-362/040-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-363: ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog WHERE article_number = '750-363' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-363/040-000: ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog WHERE article_number = '750-363/040-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-364/040-010: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-364/040-010' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-365/040-010: ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog WHERE article_number = '750-365/040-010' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-366: ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog WHERE article_number = '750-366' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-375, 750-375/025-000: PROFINET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFINET' FROM device_catalog WHERE article_number IN ('750-375', '750-375/025-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-377, 750-377/025-000: PROFINET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFINET' FROM device_catalog WHERE article_number IN ('750-377', '750-377/025-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 767-1101: PROFIBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFIBUS' FROM device_catalog WHERE article_number = '767-1101' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 767-1301: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '767-1301' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 767-1501: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number = '767-1501' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- ── PLC Protocols ────────────────────────────────────────────────────────

-- 750-806: DEVICENET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'DEVICENET' FROM device_catalog WHERE article_number = '750-806' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-815/300-000: MODBUS_RTU
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_RTU' FROM device_catalog WHERE article_number = '750-815/300-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-815/325-000: MODBUS_RTU
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_RTU' FROM device_catalog WHERE article_number = '750-815/325-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-816/300-000: MODBUS_RTU
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_RTU' FROM device_catalog WHERE article_number = '750-816/300-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-823: ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog WHERE article_number = '750-823' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-829: BACNET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'BACNET' FROM device_catalog WHERE article_number = '750-829' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-832, 750-832/000-002: BACNET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'BACNET' FROM device_catalog WHERE article_number IN ('750-832', '750-832/000-002') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-833, 750-833/025-000: PROFIBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'PROFIBUS' FROM device_catalog WHERE article_number IN ('750-833', '750-833/025-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-837, 750-837/021-000: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number IN ('750-837', '750-837/021-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-838, 750-838/021-000, 750-838/040-000: CANOPEN
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CANOPEN' FROM device_catalog WHERE article_number IN ('750-838', '750-838/021-000', '750-838/040-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-842: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-842' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-843: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-843' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-862: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-862' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-880, 750-880/025-000, 750-880/025-001, 750-880/025-002: MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-880', '750-880/025-000', '750-880/025-001', '750-880/025-002') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-881: MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-881' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-882: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-882' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-884, 750-884/000-008: MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-884', '750-884/000-008') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-885: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-885' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-885/025-000: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-885/025-000' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-889: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-889' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-890, 750-890/025-000, 750-890/025-001, 750-890/025-002, 750-890/040-000: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number IN ('750-890', '750-890/025-000', '750-890/025-001', '750-890/025-002', '750-890/040-000') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-891: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number = '750-891' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-893: ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'ETHERNETIP' FROM device_catalog WHERE article_number = '750-893' AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8000, 750-8001: MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'MODBUS_TCP' FROM device_catalog WHERE article_number IN ('750-8000', '750-8001') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8110, 750-8111: MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8110', '750-8111') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8112, 750-8112/025-000: MODBUS_RTU + MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8112', '750-8112/025-000') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 751-9401: MODBUS_RTU + MODBUS_TCP + CANOPEN + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('CANOPEN'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '751-9401' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 751-9402, 751-9403: MODBUS_RTU + MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('751-9402', '751-9403') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8208, 750-8208/025-000, 750-8208/025-001: MODBUS_RTU + MODBUS_TCP + PROFIBUS + CANOPEN + ETHERNETIP + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('PROFIBUS'::bus_protocol), ('CANOPEN'::bus_protocol), ('ETHERNETIP'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8208', '750-8208/025-000', '750-8208/025-001') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8210, 750-8210/025-000, 750-8210/040-000: MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8210', '750-8210/025-000', '750-8210/040-000') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8211, 750-8211/040-000: MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8211', '750-8211/040-000') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8212: MODBUS_RTU + MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8212' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8212/000-100: MODBUS_RTU + MODBUS_TCP + BACNET
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('BACNET'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8212/000-100' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8212/025-000, 750-8212/025-001, 750-8212/025-002: MODBUS_RTU + MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8212/025-000', '750-8212/025-001', '750-8212/025-002') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8212/040-000, 750-8212/040-001: MODBUS_RTU + MODBUS_TCP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8212/040-000', '750-8212/040-001') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8212/040-010: MODBUS_RTU + MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8212/040-010' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8213: MODBUS_TCP + CANOPEN + ETHERNETIP + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('CANOPEN'::bus_protocol), ('ETHERNETIP'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8213' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8213/040-010: MODBUS_TCP + CANOPEN + ETHERNETIP + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('CANOPEN'::bus_protocol), ('ETHERNETIP'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8213/040-010' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8214: MODBUS_RTU + MODBUS_TCP + CANOPEN + ETHERNETIP + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('CANOPEN'::bus_protocol), ('ETHERNETIP'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8214' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8215: MODBUS_TCP + CANOPEN + ETHERNETIP + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_TCP'::bus_protocol), ('CANOPEN'::bus_protocol), ('ETHERNETIP'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8215' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8216: MODBUS_RTU + MODBUS_TCP + PROFIBUS + CANOPEN + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('PROFIBUS'::bus_protocol), ('CANOPEN'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8216' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8216/025-000, 750-8216/025-001: MODBUS_RTU + MODBUS_TCP + PROFIBUS + CANOPEN + ETHERNETIP + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('PROFIBUS'::bus_protocol), ('CANOPEN'::bus_protocol), ('ETHERNETIP'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8216/025-000', '750-8216/025-001') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8216/040-000: MODBUS_RTU + MODBUS_TCP + PROFIBUS + CANOPEN + CANBUS
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('PROFIBUS'::bus_protocol), ('CANOPEN'::bus_protocol), ('CANBUS'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8216/040-000' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8217, 750-8217/025-000, 750-8217/600-000, 750-8217/625-000: MODBUS_RTU + MODBUS_TCP + ETHERNETIP
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('ETHERNETIP'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number IN ('750-8217', '750-8217/025-000', '750-8217/600-000', '750-8217/625-000') AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

-- 750-8302: MODBUS_RTU + MODBUS_TCP + PROFINET + ETHERCAT
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT dc.id, proto.protocol FROM device_catalog dc
CROSS JOIN (VALUES ('MODBUS_RTU'::bus_protocol), ('MODBUS_TCP'::bus_protocol), ('PROFINET'::bus_protocol), ('ETHERCAT'::bus_protocol)) AS proto(protocol)
WHERE dc.article_number = '750-8302' AND dc.vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. Approvals (20 rows)                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Note: GL and DNV_GL were consolidated into DNV (DNV+GL merged 2013, rebranded 2021).

INSERT INTO approval (code, name) VALUES
  ('ABS',   'ABS (American Bureau of Shipping)'),
  ('ATEX',  'ATEX Directive (Explosive Atmospheres)'),
  ('BR_EX', 'BR-Ex (Brazilian Explosive Atmospheres)'),
  ('BSH',   'BSH (Federal Maritime Authority)'),
  ('BV',    'BV (Bureau Veritas)'),
  ('CE',    'CE Marking (EU)'),
  ('DNV',   'DNV (Maritime Classification)'),
  ('EAC',   'EAC (Eurasian Conformity)'),
  ('IECEx', 'IECEx Scheme (Explosive Atmospheres)'),
  ('KC',    'KC (Korea Certification)'),
  ('KR',    'KR (Korean Register of Shipping)'),
  ('LR',    'LR (Lloyd''s Register)'),
  ('NKK',   'NKK (Nippon Kaiji Kyokai / ClassNK)'),
  ('PRS',   'PRS (Polish Register of Shipping)'),
  ('RINA',  'RINA (Registro Italiano Navale)'),
  ('RoHS',  'RoHS Directive'),
  ('SIL2',  'IEC 61508 SIL 2'),
  ('SIL3',  'IEC 61508 SIL 3'),
  ('UKCA',  'UKCA (UK Conformity Assessed)'),
  ('UL',    'UL Listed (Underwriters Laboratories)')
ON CONFLICT (code) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. Device ↔ Approval links (per-product)                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Source: WAGO datasheets + live website scraping (2026-03-12)
-- Full module approval links: prisma/seed_approval_links.sql

-- CE + RoHS: all WAGO devices
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.vendor_name = 'Wago' AND a.code IN ('CE', 'RoHS')
ON CONFLICT DO NOTHING;

-- EAC: Eurasian conformity — all PFC200 + most couplers/PLCs
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'EAC' AND split_part(dc.article_number, '/', 1) IN (
  '750-8000','750-8001','750-8110','750-8111','750-8112',
  '750-8208','750-8210','750-8211','750-8212','750-8213','750-8214','750-8215',
  '750-8216','750-8217'
) ON CONFLICT DO NOTHING;

-- KC: Korea Certification — all PFC200
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'KC' AND split_part(dc.article_number, '/', 1) IN (
  '750-8000','750-8001','750-8110','750-8111','750-8112',
  '750-8208','750-8210','750-8211','750-8212','750-8213','750-8214','750-8215',
  '750-8216','750-8217'
) ON CONFLICT DO NOTHING;

-- UKCA: UK conformity — PFC200 with full cert set
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'UKCA' AND split_part(dc.article_number, '/', 1) IN (
  '750-8210','750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- UL: most devices
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'UL' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-315','750-316','750-331','750-333','750-337','750-338',
  '750-340','750-341','750-342','750-343','750-344','750-346','750-347','750-348',
  '750-352','750-354','750-362','750-363','750-366','750-375','750-377','750-806',
  '750-815','750-816','750-823','750-829','750-832','750-833','750-837','750-838',
  '750-842','750-843','750-862','750-880','750-881','750-882','750-885','750-889',
  '750-890','750-891','750-893','750-8208','750-8210','750-8211','750-8212',
  '750-8213','750-8214','750-8215','750-8216','750-8217'
) ON CONFLICT DO NOTHING;

-- ATEX: explosion-protected devices (NOT 750-8210, 750-8211 — they lack hazloc certs)
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'ATEX' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-304','750-306','750-307','750-310','750-331','750-333','750-337',
  '750-338','750-340','750-342','750-343','750-344','750-346','750-347','750-348',
  '750-352','750-354','750-362','750-363','750-366','750-806','750-823','750-829',
  '750-832','750-833','750-837','750-838','750-842','750-843','750-862','750-880',
  '750-881','750-882','750-885','750-889','750-890','750-891','750-893',
  '750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- IECEx: international Ex scheme (NOT 750-8210, 750-8211)
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'IECEx' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-304','750-306','750-307','750-310','750-331','750-333','750-337',
  '750-338','750-340','750-342','750-343','750-344','750-346','750-347','750-348',
  '750-352','750-354','750-362','750-363','750-366','750-806','750-823','750-829',
  '750-832','750-833','750-837','750-838','750-842','750-843','750-862','750-880',
  '750-881','750-882','750-885','750-889','750-890','750-891','750-893',
  '750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- DNV: maritime classification (GL + DNV GL merged → DNV)
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'DNV' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-315','750-316','750-333','750-337','750-338','750-341',
  '750-342','750-343','750-347','750-348','750-352','750-362','750-363','750-366',
  '750-375','750-377','750-806','750-815','750-816','750-823','750-829','750-832',
  '750-833','750-837','750-838','750-842','750-843','750-862','750-880','750-881',
  '750-882','750-885','750-889','750-890','750-891','750-893',
  '750-8208','750-8210','750-8211','750-8212','750-8213','750-8214','750-8215',
  '750-8216','750-8217'
) ON CONFLICT DO NOTHING;

-- BSH: Federal Maritime Authority
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'BSH' AND split_part(dc.article_number, '/', 1) IN (
  '750-8210','750-8211','750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- ABS: American Bureau of Shipping
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'ABS' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-333','750-337','750-341','750-342','750-343','750-347',
  '750-348','750-352','750-806','750-815','750-816',
  '750-833','750-837','750-842','750-843','750-880','750-881','750-882',
  '750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- BV: Bureau Veritas
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'BV' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-315','750-316','750-333','750-337','750-338','750-341',
  '750-342','750-343','750-347','750-348','750-352','750-806','750-815','750-816',
  '750-833','750-837','750-838','750-842','750-843','750-880','750-881','750-882',
  '750-8210','750-8211','750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- LR: Lloyd's Register
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'LR' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-333','750-337','750-341','750-342','750-343','750-347',
  '750-348','750-352','750-806','750-815','750-816',
  '750-833','750-837','750-838','750-842','750-843','750-880','750-881','750-882',
  '750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- RINA: Registro Italiano Navale
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'RINA' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-315','750-316','750-333','750-337','750-338','750-341',
  '750-342','750-343','750-347','750-348','750-352','750-806','750-815','750-816',
  '750-833','750-837','750-838','750-842','750-843','750-880','750-881','750-882',
  '750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- KR: Korean Register
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'KR' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-333','750-337','750-341','750-342','750-343','750-347',
  '750-348','750-352','750-806','750-815','750-816',
  '750-833','750-837','750-842','750-843','750-880','750-881','750-882',
  '750-8210','750-8211','750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- NKK: ClassNK / Nippon Kaiji Kyokai
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'NKK' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-315','750-316','750-333','750-337','750-338','750-341',
  '750-342','750-343','750-347','750-348','750-352','750-806','750-815','750-816',
  '750-833','750-837','750-838','750-842','750-843','750-880','750-881','750-882',
  '750-8210','750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;

-- PRS: Polish Register of Shipping
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id FROM device_catalog dc CROSS JOIN approval a
WHERE a.code = 'PRS' AND split_part(dc.article_number, '/', 1) IN (
  '750-303','750-306','750-315','750-316','750-333','750-337','750-338','750-341',
  '750-342','750-343','750-347','750-348','750-352','750-806','750-815','750-816',
  '750-833','750-837','750-838','750-842','750-843','750-880','750-881','750-882',
  '750-8210','750-8211','750-8212','750-8213','750-8214','750-8215','750-8216'
) ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. Summary                                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

SELECT type, count(*) AS devices FROM device_catalog WHERE vendor_name = 'Wago' GROUP BY type ORDER BY type;
SELECT count(*) AS protocol_assignments FROM device_catalog_protocol dp JOIN device_catalog dc ON dc.id = dp.device_catalog_id WHERE dc.vendor_name = 'Wago';
SELECT count(*) AS approvals FROM approval;
SELECT count(*) AS device_approval_links FROM device_catalog_approval;
