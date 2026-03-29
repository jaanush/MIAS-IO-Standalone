/**
 * Central source of truth for all enum-like string constants that mirror the
 * database schema.  Import from here instead of repeating inline arrays.
 *
 * Usage in Zod:   z.enum(BUS_PROTOCOLS)
 * Usage in TS:    type X = BusProtocol   (= typeof BUS_PROTOCOLS[number])
 */

// ── Bus protocols & network ────────────────────────────────────────────────────

export const BUS_PROTOCOLS = [
  "MODBUS_RTU",
  "MODBUS_TCP",
  "PROFIBUS",
  "PROFINET",
  "CANBUS",
  "CANOPEN",
  "J1939",
  "ETHERNETIP",
  "DEVICENET",
  "BACNET",
  "ETHERCAT",
  "IO_LINK",
  "INTERBUS",
  "CC_LINK",
] as const;
export type BusProtocol = (typeof BUS_PROTOCOLS)[number];

export const NETWORK_NODE_ROLES = ["CLIENT", "SERVER"] as const;
export type NetworkNodeRole = (typeof NETWORK_NODE_ROLES)[number];

/** Protocols that run over Ethernet (host = a network port). */
export const ETHERNET_PROTOCOL_SET = new Set<string>([
  "MODBUS_TCP",
  "PROFINET",
  "ETHERNETIP",
  "BACNET",
  "ETHERCAT",
]);

/** Fieldbus protocols (serial / CAN, not Ethernet). */
export const FIELDBUS_PROTOCOLS = [
  "MODBUS_RTU",
  "PROFIBUS",
  "CANBUS",
  "CANOPEN",
  "J1939",
  "DEVICENET",
] as const;
export type FieldbusProtocol = (typeof FIELDBUS_PROTOCOLS)[number];

/** Origins / protocols that involve CAN-layer addressing. */
export const CAN_ORIGIN_SET = new Set<string>(["CANBUS", "CANOPEN", "J1939"]);

export const NETWORK_ROLES = ["MASTER", "SLAVE", "ADAPTER", "SCANNER"] as const;
export type NetworkRole = (typeof NETWORK_ROLES)[number];

export const SERIAL_PARITY = ["NONE", "EVEN", "ODD"] as const;
export type SerialParity = (typeof SERIAL_PARITY)[number];

export const CAN_MODES = ["TRANSPARENT", "MAPPED", "SNIFFER"] as const;
export type CanMode = (typeof CAN_MODES)[number];

// ── Signal ─────────────────────────────────────────────────────────────────────

export const SIGNAL_ORIGINS = [
  "IEC",
  "MODBUS_RTU",
  "MODBUS_TCP",
  "CANBUS",
  "CANOPEN",
  "J1939",
  "PROFIBUS",
  "PROFINET",
  "ETHERNETIP",
  "DEVICENET",
  "BACNET",
  "INTERNAL",
] as const;
export type SignalOrigin = (typeof SIGNAL_ORIGINS)[number];

export const SIGNAL_TYPES = ["DISCRETE", "ANALOG"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_DIRECTIONS = ["INPUT", "OUTPUT"] as const;
export type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];

export const IO_TYPES = ["DI", "DO", "AI", "AO"] as const;
export type IoType = (typeof IO_TYPES)[number];

export const TRIGGER_TYPES = ["NO", "NC"] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const SWITCHING_TYPES = ["HIGH_SIDE", "LOW_SIDE", "BOTH"] as const;
export type SwitchingType = (typeof SWITCHING_TYPES)[number];

export const WIRE_CONFIGS = ["TWO_WIRE", "THREE_WIRE", "FOUR_WIRE"] as const;
export type WireConfig = (typeof WIRE_CONFIGS)[number];

export const BYTE_ORDERS = ["BIG_ENDIAN", "LITTLE_ENDIAN"] as const;
export type ByteOrder = (typeof BYTE_ORDERS)[number];

// ── Data types ─────────────────────────────────────────────────────────────────

export const RAW_DATA_TYPES = [
  "BOOL", "BYTE", "WORD", "DWORD", "LWORD",
  "INT", "DINT", "LINT", "UINT", "UDINT", "ULINT",
  "REAL", "LREAL",
] as const;
export type RawDataType = (typeof RAW_DATA_TYPES)[number];

export const PLC_DATA_TYPES = [
  "BOOL", "BYTE", "WORD", "DWORD", "LWORD",
  "SINT", "INT", "DINT", "LINT",
  "USINT", "UINT", "UDINT", "ULINT",
  "REAL", "LREAL",
  "TIME", "DATE", "TOD", "DT",
  "STRING", "WSTRING",
  "SAFEBOOL", "SAFEINT", "SAFEDINT", "SAFETIME", "SAFEWORD",
] as const;
export type PlcDataType = (typeof PLC_DATA_TYPES)[number];

// ── Modbus ─────────────────────────────────────────────────────────────────────

export const MODBUS_REGISTER_TYPES = [
  "COIL",
  "DISCRETE_INPUT",
  "HOLDING_REGISTER",
  "INPUT_REGISTER",
] as const;
export type ModbusRegisterType = (typeof MODBUS_REGISTER_TYPES)[number];

// ── Alarms ─────────────────────────────────────────────────────────────────────

export const ALARM_SEVERITIES = ["INFO", "WARNING", "ALARM", "CRITICAL"] as const;
export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number];

export const DISCRETE_ALARM_CONDITIONS = ["ON_TRIGGER", "OFF_TRIGGER"] as const;
export type DiscreteAlarmCondition = (typeof DISCRETE_ALARM_CONDITIONS)[number];

export const ANALOG_ALARM_CONDITIONS = ["HIGH", "HIGH_HIGH", "LOW", "LOW_LOW"] as const;
export type AnalogAlarmCondition = (typeof ANALOG_ALARM_CONDITIONS)[number];

// ── Hardware ───────────────────────────────────────────────────────────────────

export const CARD_TYPES = [
  "DI", "DO", "AI", "AO",
  "MIXED", "COUNTER", "PWM", "SERIAL", "IO_LINK", "SUPPLY", "RELAY",
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const COMPONENT_STATUS = ["DRAFT", "ACTIVE", "DEPRECATED"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUS)[number];

export const CATALOG_DEVICE_TYPES = ["PLC", "COUPLER"] as const;
export type CatalogDeviceType = (typeof CATALOG_DEVICE_TYPES)[number];

export const CATALOG_LIFECYCLES = ["ACTIVE", "NRND", "LAST_BUY", "DISCONTINUED", "OBSOLETE", "UNKNOWN"] as const;
export type CatalogLifecycle = (typeof CATALOG_LIFECYCLES)[number];

export const PLC_SERIES = [
  "750 Series",
  "Basic Controller 100",
  "Compact Controller 100",
  "PFC100",
  "PFC200",
  "PFC300",
  "Edge Controller",
] as const;
export type PlcSeries = (typeof PLC_SERIES)[number];

// ── PDO (CANopen) ─────────────────────────────────────────────────────────────

export const PDO_DIRECTIONS = ["TPDO", "RPDO"] as const;
export type PdoDirection = (typeof PDO_DIRECTIONS)[number];

// ── Wiring Recipes ───────────────────────────────────────────────────────────

export const WIRING_SOURCE_TYPES = ["SIGNAL", "SIGNAL_RAW", "SIGNAL_SENSOR_FAULT", "INSTANCE_FB", "LITERAL", "EXPRESSION"] as const;
export type WiringSourceType = (typeof WIRING_SOURCE_TYPES)[number];

// ── CODESYS integration ───────────────────────────────────────────────────────

export const CODESYS_TASK_STATUSES = ["QUEUED", "CLAIMED", "SUCCESS", "FAILURE"] as const;
export type CodesysTaskStatus = (typeof CODESYS_TASK_STATUSES)[number];

export const GVL_GENERATION_MODES = ["FLAT_VARS", "FB_INSTANCES"] as const;
export type GvlGenerationMode = (typeof GVL_GENERATION_MODES)[number];

// ── Users & projects ───────────────────────────────────────────────────────────

export const USER_ROLES = ["ADMIN", "ENGINEER", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_STATUS = ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const MEMBER_ROLES = ["OWNER", "MEMBER", "VIEWER"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
