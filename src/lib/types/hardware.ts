/**
 * Shared hardware types used across project hardware UI components.
 *
 * These are client-side view types derived from getHardware query shapes.
 * All fields are optional-safe (nullable) to handle varying query includes.
 */

// ── Catalog shapes ──────────────────────────────────────────────────────────

// Front-panel rendering + LED layout per WAGO module/coupler. Imported from
// a local WAGO-IO-CHECK 3 install; see scripts/import_wago_modules.py.
export type WagoLedItem = {
  index: number;
  color: string;     // numeric (0/1/10) for monochrome, named (GNGR / GEGR / RTGR) for bicolour
  flag: string;      // usually "0" or "1"
  label: string | null;
};

export type WagoFrontPanel = {
  kind: "coupler" | "terminal";
  descriptions: { en: string | null; de: string | null; fr: string | null };
  moduleType: number | null;
  moduleIcon: number | null;
  supportedModes?: number | null;
  bootDelayS?: number | null;
  consumptionMa: number | null;
  voltageV: number | null;
  lk1: number | null;
  lk2: number | null;
  pe: number | null;
  adjustable: boolean;
  settingsApp: string | null;
  settingsAppName: string | null;
  image: { url: string; width: number; height: number; sourceBmp: string } | null;
  leds: {
    rows: number | null;
    cols: number | null;
    max: number | null;
    rect: string | null;     // "x1,y1,x2,y2" image coords
    items: WagoLedItem[];
  } | null;
};

export type IoCardCatalog = {
  id: number;
  articleNumber: string;
  vendorName: string;
  description: string | null;
  cardType: string;
  maxInputChannels: number | null;
  maxOutputChannels: number | null;
  busCurrentConsumptionMa?: number | null;
  providesNetwork?: boolean;
  protocols?: { protocol: string }[];
  approvals?: { approvalId: number }[];
  // Prisma's JsonValue is wider than WagoFrontPanel; treat as unknown at the
  // tRPC boundary and narrow at the read site (see RackStripView).
  frontPanel?: unknown;
};

export type DeviceCatalog = {
  id: number;
  articleNumber: string;
  vendorName: string;
  maxModules: number | null;
  busPowerBudgetMa?: number | null;
  ethernetPorts?: number | null;
  protocols?: { protocol: string }[];
  frontPanel?: unknown;
};

// ── Hardware entities ───────────────────────────────────────────────────────

export type IoCard = {
  id: number;
  slotPosition: number;
  cardType: string;
  subgroup?: string | null;
  typeCode?: string | null;
  instanceNumber?: number | null;
  name: string | null;
  catalog: IoCardCatalog | null;
};

export type Port = {
  id: number;
  portNumber: number;
  label: string | null;
  ipAddress: string | null;
  ipNetworkId: number | null;
};

export type BusNode = {
  id: number;
  role?: string;
  nodeAddress?: number | null;
  ipAddress?: string | null;
  description?: string | null;
  plc: { id: number; name: string } | null;
  carrier: { id: number; name: string; cabinetNumber?: number | null; carrierNumber?: number | null } | null;
};

export type ComponentInstance = {
  id: number;
  name: string;
  tag: string | null;
  notes?: string | null;
  busId?: number | null;
  nodeRole?: string | null;
  nodeAddress?: number | null;
  canIdOffset?: number | null;
  functionBlockOverride?: string | null;
  component: {
    id: number;
    name: string;
    manufacturer: string | null;
    model: string | null;
  };
};

export type Bus = {
  id: number;
  protocol: string;
  role?: string;
  nodeAddress?: number | null;
  description: string | null;
  ipNetworkId?: number | null;
  ioCardId?: number | null;
  ioCard?: { id: number; name: string | null; slotPosition: number } | null;
  nodes?: BusNode[];
  carriers?: Carrier[];
  instances?: ComponentInstance[];
  // Protocol-specific params
  baudRateKbit?: number | null;
  baudRateBps?: number | null;
  serialParity?: string | null;
  serialStopBits?: number | null;
  ipAddress?: string | null;
  ipPort?: number | null;
  canMode?: string | null;
  canHeartbeatMs?: number | null;
  canSyncPeriodMs?: number | null;
  cyclePeriodMs?: number | null;
};

export type Carrier = {
  id: number;
  name: string;
  busId?: number | null;
  cabinetNumber?: number | null;
  carrierNumber?: number | null;
  firmwareVersion?: string | null;
  modbusInputBase?: number | null;
  modbusOutputBase?: number | null;
  notes?: string | null;
  catalog: DeviceCatalog | null;
  cards: IoCard[];
  ports?: Port[];
};

export type Plc = {
  id: number;
  name: string;
  ipAddress?: string | null;
  notes?: string | null;
  catalog: DeviceCatalog | null;
  buses: Bus[];
  carriers: Carrier[];
  ports?: Port[];
};

export type IpNetwork = {
  id: number;
  name: string | null;
  buses?: { id: number; protocol: string; description: string | null }[];
};

// ── Selection ───────────────────────────────────────────────────────────────

export type SelectedNode =
  | { type: "plc"; id: number }
  | { type: "network"; id: number; plcId?: number }
  | { type: "ipNetwork"; id: number }
  | { type: "carrier"; id: number }
  | { type: "instance"; id: number };
