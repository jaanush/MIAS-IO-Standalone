/**
 * Shared hardware types used across project hardware UI components.
 *
 * These are client-side view types derived from getHardware query shapes.
 * All fields are optional-safe (nullable) to handle varying query includes.
 */

// ── Catalog shapes ──────────────────────────────────────────────────────────

export type IoCardCatalog = {
  id: number;
  articleNumber: string;
  vendorName: string;
  cardType: string;
  maxInputChannels: number | null;
  maxOutputChannels: number | null;
  busCurrentConsumptionMa?: number | null;
  providesNetwork?: boolean;
  protocols?: { protocol: string }[];
  approvals?: { approvalId: number }[];
};

export type DeviceCatalog = {
  id: number;
  articleNumber: string;
  vendorName: string;
  maxModules: number | null;
  busPowerBudgetMa?: number | null;
  ethernetPorts?: number | null;
  protocols?: { protocol: string }[];
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
