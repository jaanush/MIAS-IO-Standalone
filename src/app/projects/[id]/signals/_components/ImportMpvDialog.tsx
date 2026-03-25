"use client";

import { useState, useRef, useMemo } from "react";
import { readArrayBuffer } from "@/lib/xlsx-reader";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BUS_PROTOCOLS, ETHERNET_PROTOCOL_SET, type BusProtocol } from "@/lib/enums";

// ── Types ────────────────────────────────────────────────────────────────────

type ParsedSlot = { slotPosition: number; articleNumber: string; subgroup: string | null; typeCode: string | null; instanceNumber: number | null };
type ParsedCarrier = { key: string; name: string; cabinetNumber: number | null; carrierNumber: number | null; hwType: "plc" | "distio"; slots: ParsedSlot[] };
type ParsedPlc = { name: string; cabinet: string | null; carriers: ParsedCarrier[] };

type ParsedBusDevice = {
  systemName: string;
  protocol: "MODBUS_TCP" | "MODBUS_RTU";
  comments: string | null;
};

type ParsedRow = {
  description: string;
  signalType: "DISCRETE" | "ANALOG";
  direction: "INPUT" | "OUTPUT";
  rawIoType: string;
  // ISA fields
  instrumentTag: string | null;
  signalClassification: string | null;
  system: string | null;
  subsystem: string | null;
  element: string | null;
  signalFunction: string | null;
  // Signal config
  trigger: "NO" | "NC";
  inputTypeCode: string | null;
  engineeringUnitSymbol: string | null;
  cabinet: string | null;
  supplierName: string | null;
  supplierSensorType: string | null;
  normalValue: string | null;
  rangelow: number | null;
  rangeHigh: number | null;
  alarmSetpoint: string | null;
  alarmDelay: string | null;
  mimic: string | null;
  notes: string | null;
  // Hardware ref
  cardRef: string | null;       // "distIO:slotNumber"
  channelPosition: number | null;
  // Hardware identifier (from position column)
  hwCabinet: number | null;
  hwCarrier: number | null;
  hwTypeCode: string | null;
  hwInstance: number | null;
};

type ParseResult = {
  hardware: ParsedPlc[];
  signals: ParsedRow[];
  busDevices: ParsedBusDevice[];
  warnings: string[];
};

type Props = {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellStr(rows: any[][], row: number, col: number): string {
  return String(rows[row]?.[col] ?? "").trim();
}

function cellNum(rows: any[][], row: number, col: number): number | null {
  const v = rows[row]?.[col];
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function resolveTrigger(logic: string, sigType: string): "NO" | "NC" {
  const s = sigType.trim().toUpperCase();
  if (s === "NC" || s === "NO RELAY") return "NC";
  if (logic.includes("0=ALARM") || logic.includes("0=")) return "NC";
  return "NO";
}

/**
 * Generate a PLC-safe tag from a signal description.
 * Replaces spaces/special chars with underscores, strips leading digits.
 */
function generateTag(description: string): string {
  let tag = description
    .replace(/[^A-Za-z0-9\s]/g, "")  // remove special chars
    .trim()
    .replace(/\s+/g, "_");            // spaces → underscores
  // ST identifiers can't start with a digit
  if (/^\d/.test(tag)) tag = `x_${tag}`;
  // Truncate to 150 chars (DB limit)
  return tag.substring(0, 150);
}

function resolveInputTypeCode(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\u2013/g, "-");
  if (s === "PT100") return "PT100";
  if (s === "PT1000") return "PT1000";
  if (s.includes("4-20MA") || s.includes("4-20 MA")) return "MA_4_20";
  if (s.includes("0-20MA") || s.includes("0-20 MA")) return "MA_0_20";
  if (s.includes("0-10V") || s.includes("0-10 V")) return "V_0_10";
  return null;
}

/**
 * Parse Position column: "N3:D02:BI01" → structured identifier components
 * Format: N<cabinet>:D<carrier>:<typeCode><instance>
 */
function parsePosition(pos: string): {
  cabinet: string; distIO: string; slotId: string;
  cabinetNumber: number | null; carrierNumber: number | null;
  subgroup: string | null; typeCode: string | null; instanceNumber: number | null;
} | null {
  const parts = pos.split(":");
  if (parts.length < 3) return null;
  const cabinet = parts[0].trim();
  const distIO = parts[1].trim();
  const slotId = parts[2].trim();
  // Extract numeric cabinet: N3 → 3
  const cabMatch = cabinet.match(/^N(\d)$/i);
  const cabinetNumber = cabMatch ? parseInt(cabMatch[1], 10) : null;
  // Extract numeric carrier: D02 → 2, also handle DO2 (letter O vs zero)
  const carMatch = distIO.match(/^D[Oo]?(\d{1,2})$/i);
  const carrierNumber = carMatch ? parseInt(carMatch[1], 10) : null;
  // Extract subgroup + typeCode + instance from slot ID
  // Formats: BI01 → subgroup=B, typeCode=I, instance=1
  //          I01 → subgroup=null, typeCode=I, instance=1
  const slotMatch = slotId.match(/^([A-Za-z])([A-Za-z])(\d{1,2})$/);
  if (slotMatch) {
    return { cabinet, distIO, slotId, cabinetNumber, carrierNumber,
      subgroup: slotMatch[1].toUpperCase(), typeCode: slotMatch[2].toUpperCase(),
      instanceNumber: parseInt(slotMatch[3], 10) };
  }
  // Single-letter format: I01
  const singleMatch = slotId.match(/^([A-Za-z])(\d{1,2})$/);
  if (singleMatch) {
    return { cabinet, distIO, slotId, cabinetNumber, carrierNumber,
      subgroup: null, typeCode: singleMatch[1].toUpperCase(),
      instanceNumber: parseInt(singleMatch[2], 10) };
  }
  return { cabinet, distIO, slotId, cabinetNumber, carrierNumber, subgroup: null, typeCode: null, instanceNumber: null };
}

/** Build a normalized carrier key from parsed position: "cabinet:carrier" e.g. "3:2" */
function carrierKey(parsed: { cabinetNumber: number | null; carrierNumber: number | null; distIO: string }): string {
  if (parsed.cabinetNumber != null && parsed.carrierNumber != null) {
    return `${parsed.cabinetNumber}:${parsed.carrierNumber}`;
  }
  // Fallback for unparseable positions — use raw distIO (rare)
  return parsed.distIO;
}

function parseSheet(rows: any[][]): ParseResult {
  // Headers at row 6, data starts at row 8 (row 7 is blank)
  type SlotInfo = { articleNumber: string; subgroup: string | null; typeCode: string | null; instanceNumber: number | null };
  type CarrierInfo = { cabinetNumber: number | null; carrierNumber: number | null; displayName: string; slots: Map<string, SlotInfo> };
  const carrierMap = new Map<string, CarrierInfo>(); // normalized "cabinet:carrier" → info
  const slotNumberMap = new Map<string, Map<string, number>>(); // carrier key → slotId → sequential slot number
  const signals: ParsedRow[] = [];

  // First pass: collect all slots per carrier (keyed by cabinet:carrierNumber)
  for (let i = 8; i < rows.length; i++) {
    const position = cellStr(rows, i, 24);
    const articleNumber = cellStr(rows, i, 23);
    if (!position || !articleNumber) continue;
    const parsed = parsePosition(position);
    if (!parsed) continue;

    const ck = carrierKey(parsed);
    if (!carrierMap.has(ck)) {
      const displayName = parsed.cabinetNumber != null && parsed.carrierNumber != null
        ? `N${parsed.cabinetNumber}:D${String(parsed.carrierNumber).padStart(2, "0")}`
        : parsed.distIO;
      carrierMap.set(ck, {
        cabinetNumber: parsed.cabinetNumber,
        carrierNumber: parsed.carrierNumber,
        displayName,
        slots: new Map(),
      });
    }
    const carrier = carrierMap.get(ck)!;
    if (!carrier.slots.has(parsed.slotId)) {
      carrier.slots.set(parsed.slotId, {
        articleNumber,
        subgroup: parsed.subgroup,
        typeCode: parsed.typeCode,
        instanceNumber: parsed.instanceNumber,
      });
    }
  }

  // Assign sequential slot numbers per carrier (sorted by slotId)
  for (const [ck, info] of carrierMap) {
    const sorted = [...info.slots.keys()].sort();
    const numMap = new Map<string, number>();
    sorted.forEach((slotId, idx) => numMap.set(slotId, idx));
    slotNumberMap.set(ck, numMap);
  }

  // Second pass: build signals
  for (let i = 8; i < rows.length; i++) {
    const ioType = cellStr(rows, i, 9).toUpperCase();
    const isDiscrete = ioType === "DI" || ioType === "DO";
    const isAnalog = ioType === "AI" || ioType === "AO";
    if (!isDiscrete && !isAnalog) continue;

    const description = cellStr(rows, i, 8);
    if (!description) continue;

    const position = cellStr(rows, i, 24);
    const channel = cellNum(rows, i, 26);
    const cabinet = cellStr(rows, i, 22) || null;

    // Build card reference + extract hw identifiers from position
    let cardRef: string | null = null;
    let hwCabinet: number | null = null;
    let hwCarrier: number | null = null;
    let hwTypeCode: string | null = null;
    let hwInstance: number | null = null;
    if (position) {
      const parsed = parsePosition(position);
      if (parsed) {
        const ck = carrierKey(parsed);
        const slotNum = slotNumberMap.get(ck)?.get(parsed.slotId);
        if (slotNum != null) cardRef = `${ck}:${slotNum}`;
        hwCabinet = parsed.cabinetNumber;
        hwCarrier = parsed.carrierNumber;
        hwTypeCode = parsed.subgroup && parsed.typeCode ? `${parsed.subgroup}${parsed.typeCode}` : parsed.typeCode;
        hwInstance = parsed.instanceNumber;
      }
    }

    const logic = cellStr(rows, i, 10);
    const ingSignalType = cellStr(rows, i, 11);

    signals.push({
      description,
      signalType: isDiscrete ? "DISCRETE" : "ANALOG",
      direction: ioType === "DI" || ioType === "AI" ? "INPUT" : "OUTPUT",
      rawIoType: ioType,
      instrumentTag: cellStr(rows, i, 1) || null,
      signalClassification: cellStr(rows, i, 2) || null,
      system: cellStr(rows, i, 4) || null,
      subsystem: cellStr(rows, i, 5) || null,
      element: cellStr(rows, i, 6) || null,
      signalFunction: cellStr(rows, i, 7) || null,
      trigger: isDiscrete ? resolveTrigger(logic, ingSignalType) : "NO",
      inputTypeCode: isAnalog ? resolveInputTypeCode(ingSignalType) : null,
      engineeringUnitSymbol: cellStr(rows, i, 17) || null,
      cabinet,
      supplierName: cellStr(rows, i, 18) || null,
      supplierSensorType: cellStr(rows, i, 19) || null,
      normalValue: cellStr(rows, i, 31) || null,
      rangelow: cellNum(rows, i, 15),
      rangeHigh: cellNum(rows, i, 16),
      alarmSetpoint: cellStr(rows, i, 27) || null,
      alarmDelay: cellStr(rows, i, 28) || null,
      mimic: cellStr(rows, i, 3) || null,
      notes: cellStr(rows, i, 34) || null,
      cardRef,
      channelPosition: channel != null ? channel - 1 : null,
      hwCabinet, hwCarrier, hwTypeCode, hwInstance,
    });
  }

  // Build hardware: all carriers grouped under one PLC
  const carriers: ParsedCarrier[] = [];
  for (const [ck, info] of [...carrierMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    const numMap = slotNumberMap.get(ck)!;
    const parsedSlots: ParsedSlot[] = [];
    for (const [slotId, slotInfo] of info.slots) {
      parsedSlots.push({
        slotPosition: numMap.get(slotId)!,
        articleNumber: slotInfo.articleNumber,
        subgroup: slotInfo.subgroup,
        typeCode: slotInfo.typeCode,
        instanceNumber: slotInfo.instanceNumber,
      });
    }
    parsedSlots.sort((a, b) => a.slotPosition - b.slotPosition);
    carriers.push({
      key: ck,
      name: info.displayName,
      cabinetNumber: info.cabinetNumber,
      carrierNumber: info.carrierNumber,
      hwType: "distio",
      slots: parsedSlots,
    });
  }

  const hardware: ParsedPlc[] = carriers.length > 0
    ? [{ name: "PLC-1", cabinet: null, carriers }]
    : [];

  // Check for duplicate hardware address (full identifier + channel)
  const warnings: string[] = [];
  const channelSeen = new Map<string, number[]>();
  for (let idx = 0; idx < signals.length; idx++) {
    const sig = signals[idx];
    if (sig.hwCabinet == null || sig.hwCarrier == null || !sig.hwTypeCode || sig.hwInstance == null || sig.channelPosition == null) continue;
    const hwId = `N${sig.hwCabinet}:D${String(sig.hwCarrier).padStart(2, "0")}:${sig.hwTypeCode}${String(sig.hwInstance).padStart(2, "0")}:CH${sig.channelPosition}`;
    const rowNums = channelSeen.get(hwId);
    if (rowNums) rowNums.push(idx + 9);
    else channelSeen.set(hwId, [idx + 9]);
  }
  for (const [hwId, rowNums] of channelSeen) {
    if (rowNums.length > 1) {
      warnings.push(`Duplicate ${hwId} on rows: ${rowNums.join(", ")}`);
    }
  }

  return { hardware, signals, busDevices: [], warnings };
}

function parseSerialIO(rows: any[][]): ParsedBusDevice[] {
  const devices: ParsedBusDevice[] = [];
  // Header row 6, data from row 8. Each system is one row with System + Signal columns.
  for (let i = 8; i < rows.length; i++) {
    const system = cellStr(rows, i, 4);
    const signal = cellStr(rows, i, 7); // protocol description
    if (!system || !signal) continue;

    const upper = signal.toUpperCase();
    let protocol: "MODBUS_TCP" | "MODBUS_RTU";
    if (upper.includes("TCP")) {
      protocol = "MODBUS_TCP";
    } else if (upper.includes("RTU") || upper.includes("RS485") || upper.includes("RS-485")) {
      protocol = "MODBUS_RTU";
    } else {
      continue; // skip unknown protocols (e.g. "NO INFORMATION")
    }

    const comments = cellStr(rows, i, 28) || null;
    devices.push({ systemName: system, protocol, comments });
  }
  return devices;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImportMpvDialog({ projectId, open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [postImportWarnings, setPostImportWarnings] = useState<string[]>([]);

  const [selectedPlcCatalogId, setSelectedPlcCatalogId] = useState<number | null>(null);
  const [selectedCouplerCatalogId, setSelectedCouplerCatalogId] = useState<number | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<BusProtocol | null>(null);
  const [carrierHwTypes, setCarrierHwTypes] = useState<Map<string, "plc" | "distio">>(new Map());

  const { data: systems = [] } = trpc.signal.systemList.useQuery(undefined, { enabled: open });
  const { data: gvls = [] } = trpc.signal.gvlList.useQuery(undefined, { enabled: open });
  const { data: plcDataTypes = [] } = trpc.signal.plcDataTypeList.useQuery(undefined, { enabled: open });
  const { data: engineeringUnits = [] } = trpc.signal.engineeringUnits.useQuery(undefined, { enabled: open });
  const { data: inputTypes = [] } = trpc.signal.analogInputTypes.useQuery(undefined, { enabled: open });
  const { data: modules = [] } = trpc.hardware.moduleList.useQuery(undefined, { enabled: open });
  const { data: plcCatalog = [] } = trpc.hardware.plcCatalogList.useQuery(undefined, { enabled: open });
  const { data: couplerCatalog = [] } = trpc.hardware.couplerCatalogList.useQuery(undefined, { enabled: open });

  const utils = trpc.useUtils();
  const createSignal = trpc.signal.create.useMutation();
  const systemUpsert = trpc.signal.systemUpsert.useMutation();
  const createPlc = trpc.projectHardware.plcCreate.useMutation();
  const createCarrier = trpc.projectHardware.carrierCreate.useMutation();
  const createBus = trpc.projectHardware.busCreate.useMutation();
  const createIpNetwork = trpc.projectHardware.ipNetworkCreate.useMutation();
  const upsertBusNode = trpc.projectHardware.busNodeUpsert.useMutation();
  const savePlcPort = trpc.projectHardware.plcPortSave.useMutation();
  const saveCarrierPort = trpc.projectHardware.carrierPortSave.useMutation();
  const assignCard = trpc.projectHardware.cardAssign.useMutation();
  const bulkCreate = trpc.signal.bulkCreate.useMutation();
  const gvlUpsert = trpc.signal.gvlUpsert.useMutation();
  const componentCreate = trpc.components.componentCreate.useMutation();
  const instanceCreate = trpc.projectHardware.instanceCreate.useMutation();

  const matchedProtocols = useMemo<BusProtocol[]>(() => {
    const plcEntry = plcCatalog.find((p) => p.id === selectedPlcCatalogId);
    const couplerEntry = couplerCatalog.find((c) => c.id === selectedCouplerCatalogId);
    if (!plcEntry || !couplerEntry) return [];
    const plcProtos = new Set(plcEntry.protocols.map((p) => p.protocol as BusProtocol));
    const couplerProtos = new Set(couplerEntry.protocols.map((p) => p.protocol as BusProtocol));
    return [...plcProtos].filter((p) => couplerProtos.has(p));
  }, [selectedPlcCatalogId, selectedCouplerCatalogId, plcCatalog, couplerCatalog]);

  const effectiveProtocol: BusProtocol | null =
    selectedProtocol ?? (matchedProtocols.length === 1 ? matchedProtocols[0] : null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParseResult(null);
    setImportError(null);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = ev.target!.result as ArrayBuffer;
        const workbook = await readArrayBuffer(data);

        const sheetName = workbook.sheetNames.find(
          (n) => n.trim().toLowerCase() === "hardwired io"
        );
        if (!sheetName) {
          setParseError('Sheet "Hardwired IO" not found in the workbook.');
          return;
        }

        const ws = workbook.getSheet(sheetName);
        if (!ws) {
          setParseError('Sheet "Hardwired IO" not found in the workbook.');
          return;
        }
        const rows = ws.toRows();
        const result = parseSheet(rows);

        // Also parse Serial IO sheet for bus devices
        const serialSheetName = workbook.sheetNames.find(
          (n) => n.trim().toLowerCase() === "serial io"
        );
        if (serialSheetName) {
          const serialWs = workbook.getSheet(serialSheetName);
          if (serialWs) {
            const serialRows = serialWs.toRows();
            result.busDevices = parseSerialIO(serialRows);
          }
        }

        if (result.signals.length === 0 && result.busDevices.length === 0) {
          setParseError("No signals or bus devices found.");
          return;
        }
        setParseResult(result);
        setSelectedProtocol(null);
      } catch (err) {
        setParseError(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!parseResult) return;
    setImporting(true);
    setImportError(null);
    setImportStatus(null);

    const moduleMap = new Map<string, number>(modules.map((m) => [m.articleNumber, m.id]));
    const systemMap = new Map<string, number>(systems.map((s) => [s.name, s.id]));
    const euMap = new Map<string, number>(engineeringUnits.map((eu) => [eu.symbol, eu.id]));
    const inputTypeMap = new Map<string, number>(inputTypes.map((t) => [t.code, t.id]));
    const cardRefToId = new Map<string, number>(); // "cabinet:carrier:slotNumber" → ioCard.id
    const importWarnings: string[] = [];
    let firstPlcId: number | null = null;

    try {
      // ── Phase 1: Hardware ──────────────────────────────────────────────
      const isEthernet = effectiveProtocol && ETHERNET_PROTOCOL_SET.has(effectiveProtocol);

      // For ethernet protocols, create one shared IP Network
      let ipNetworkId: number | null = null;
      if (isEthernet && parseResult.hardware.some((p) => p.carriers.length > 0)) {
        setImportStatus("Creating IP Network...");
        const ipNet = await createIpNetwork.mutateAsync({
          projectId,
          name: `${effectiveProtocol} Network`,
        });
        ipNetworkId = ipNet.id;
      }

      // Create one bus per protocol (shared across all PLCs)
      let busId: number | null = null;
      if (effectiveProtocol && parseResult.hardware.some((p) => p.carriers.length > 0)) {
        setImportStatus(`Creating ${effectiveProtocol} bus...`);
        const bus = await createBus.mutateAsync({
          projectId,
          protocol: effectiveProtocol,
          role: "MASTER",
          ipNetworkId: ipNetworkId,
          description: null,
        });
        busId = bus.id;
      }

      for (const parsedPlc of parseResult.hardware) {
        setImportStatus(`Creating PLC ${parsedPlc.name}...`);
        const plc = await createPlc.mutateAsync({
          projectId,
          catalogId: selectedPlcCatalogId ?? null,
          name: parsedPlc.name,
          notes: parsedPlc.cabinet ? `Cabinet: ${parsedPlc.cabinet}` : null,
        });
        if (!firstPlcId) firstPlcId = plc.id;

        // Connect PLC to bus via BusNode
        if (busId && parsedPlc.carriers.length > 0) {
          await upsertBusNode.mutateAsync({ busId, plcId: plc.id, role: "SERVER" });
          // Assign IP Network to PLC's first ethernet port
          if (ipNetworkId) {
            await savePlcPort.mutateAsync({ plcId: plc.id, portNumber: 0, ipNetworkId });
          }
        }

        for (const carrier of parsedPlc.carriers) {
          setImportStatus(`Creating carrier ${carrier.name}...`);
          const created = await createCarrier.mutateAsync({
            plcId: plc.id,
            name: carrier.name,
            catalogId: selectedCouplerCatalogId ?? null,
            busId: carrier.hwType === "distio" ? busId : null,
            cabinetNumber: carrier.cabinetNumber,
            carrierNumber: carrier.carrierNumber,
          });

          // Connect carrier to bus via BusNode
          if (busId && carrier.hwType === "distio") {
            await upsertBusNode.mutateAsync({ busId, carrierId: created.id, role: "CLIENT" });
            // Assign IP Network to carrier's first ethernet port
            if (ipNetworkId) {
              await saveCarrierPort.mutateAsync({ carrierId: created.id, portNumber: 0, ipNetworkId });
            }
          }

          for (const slot of carrier.slots) {
            const catalogId = moduleMap.get(slot.articleNumber);
            if (!catalogId) {
              console.warn(`Module not found: ${slot.articleNumber} — skipped`);
              continue;
            }
            setImportStatus(`Slot ${slot.slotPosition} (${slot.articleNumber}) on ${carrier.name}...`);
            const card = await assignCard.mutateAsync({
              carrierId: created.id,
              slotPosition: slot.slotPosition,
              catalogId,
              subgroup: slot.subgroup ?? undefined,
              typeCode: slot.typeCode ?? undefined,
              instanceNumber: slot.instanceNumber ?? undefined,
            });
            if (!card.typeCode) {
              importWarnings.push(`Card ${slot.articleNumber} on ${carrier.name} slot ${slot.slotPosition + 1}: no type code (add ${card.cardType} to Module Type Codes)`);
            }
            cardRefToId.set(`${carrier.key}:${slot.slotPosition}`, card.id);
          }
        }
      }

      // ── Phase 2: Signals (bulk) ────────────────────────────────────────
      setImportStatus(`Preparing ${parseResult.signals.length} signals...`);

      // Pre-upsert all unique systems
      const uniqueSystems = [...new Set(parseResult.signals.map((r) => r.system).filter(Boolean))] as string[];
      for (const sys of uniqueSystems) {
        if (!systemMap.has(sys)) {
          const result = await systemUpsert.mutateAsync({
            code: sys.substring(0, 10).replace(/\s+/g, "_").toUpperCase(),
            name: sys,
            description: null,
          });
          systemMap.set(sys, result.id);
        }
      }

      // Resolve default GVL (upsert GVL_Physical)
      let defaultGvlId = gvls.find((g) => g.name === "GVL_Physical")?.id ?? null;
      if (!defaultGvlId) {
        const result = await gvlUpsert.mutateAsync({ name: "GVL_Physical", description: null });
        defaultGvlId = result.id;
      }

      // Resolve default PLC data types
      const boolTypeId = plcDataTypes.find((t) => t.code === "BOOL")?.id ?? null;
      const realTypeId = plcDataTypes.find((t) => t.code === "REAL")?.id ?? null;

      const signalBatch = parseResult.signals.map((row) => ({
        signalType: row.signalType,
        origin: "IEC" as const,
        tag: generateTag(row.description),
        description: row.description,
        direction: row.direction,
        systemId: row.system ? (systemMap.get(row.system) ?? null) : null,
        ioCardId: row.cardRef ? (cardRefToId.get(row.cardRef) ?? null) : null,
        channelPosition: row.channelPosition,
        cabinetLocation: row.cabinet,
        drawingRef: row.mimic,
        gvlId: defaultGvlId,
        notes: row.notes,
        instrumentTag: row.instrumentTag,
        signalClassification: row.signalClassification,
        subsystem: row.subsystem,
        element: row.element,
        signalFunction: row.signalFunction,
        supplierName: row.supplierName,
        supplierSensorType: row.supplierSensorType,
        normalValue: row.normalValue,
        trigger: row.trigger,
        inputTypeId: row.inputTypeCode ? (inputTypeMap.get(row.inputTypeCode) ?? null) : null,
        engineeringUnitId: row.engineeringUnitSymbol ? (euMap.get(row.engineeringUnitSymbol) ?? null) : null,
        plcDataTypeId: row.signalType === "DISCRETE" ? boolTypeId : realTypeId,
        scaleMin: row.rangelow,
        scaleMax: row.rangeHigh,
      }));

      setImportStatus(`Creating ${signalBatch.length} signals...`);
      await bulkCreate.mutateAsync({ projectId, signals: signalBatch });

      // ── Phase 3: Bus devices (Serial IO) ─────────────────────────────
      if (parseResult.busDevices.length > 0) {
        // Create one bus per protocol at project level, connect PLC via BusNode
        const busByProtocol = new Map<string, number>();

        for (const busDevice of parseResult.busDevices) {
          setImportStatus(`Creating bus device: ${busDevice.systemName}...`);

          let devBusId = busByProtocol.get(busDevice.protocol);
          if (!devBusId) {
            const devBus = await createBus.mutateAsync({
              projectId,
              protocol: busDevice.protocol,
              role: "MASTER",
              description: `${busDevice.protocol} bus`,
            });
            devBusId = devBus.id;
            busByProtocol.set(busDevice.protocol, devBusId);

            // Connect first PLC as master node on this fieldbus
            if (firstPlcId) {
              await upsertBusNode.mutateAsync({ busId: devBusId, plcId: firstPlcId, role: "SERVER" });
            }
          }

          const component = await componentCreate.mutateAsync({
            projectId,
            name: busDevice.systemName,
            busProtocol: busDevice.protocol,
            status: "DRAFT",
            description: busDevice.comments ?? `${busDevice.protocol} device — imported from MPV Serial IO`,
          });

          await instanceCreate.mutateAsync({
            projectId,
            componentId: component.id,
            busId: devBusId,
            name: busDevice.systemName,
            notes: busDevice.comments,
          });
        }
      }

      await utils.signal.list.invalidate({ projectId });
      await utils.projectHardware.getHardware.invalidate({ projectId });
      onImported();
      if (importWarnings.length > 0) {
        setPostImportWarnings(importWarnings);
        setImportStatus("Import complete with warnings");
      } else {
        onClose();
      }
    } catch (err) {
      setImportError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    if (importing) return;
    setParseResult(null);
    setParseError(null);
    setImportError(null);
    setImportStatus(null);
    setPostImportWarnings([]);
    setSelectedPlcCatalogId(null);
    setSelectedCouplerCatalogId(null);
    setSelectedProtocol(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const totalCarriers = parseResult?.hardware.reduce((s, p) => s + p.carriers.length, 0) ?? 0;
  const totalSlots = parseResult?.hardware.reduce(
    (s, p) => s + p.carriers.reduce((s2, c) => s2 + c.slots.length, 0), 0
  ) ?? 0;
  const hasHardware = (parseResult?.hardware.length ?? 0) > 0;
  const diCount = parseResult?.signals.filter((s) => s.rawIoType === "DI").length ?? 0;
  const doCount = parseResult?.signals.filter((s) => s.rawIoType === "DO").length ?? 0;
  const aiCount = parseResult?.signals.filter((s) => s.rawIoType === "AI").length ?? 0;
  const aoCount = parseResult?.signals.filter((s) => s.rawIoType === "AO").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from MPV IO-list</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Excel File (.xlsx)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={importing}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            />
            <p className="text-xs text-muted-foreground">
              Sheet &quot;Hardwired IO&quot;. Header row 7, data from row 9.
            </p>
          </div>

          {parseError && (
            <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {parseError}
            </p>
          )}

          {parseResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-md border p-3 bg-muted/20 text-sm">
                <span className="font-semibold">{parseResult.signals.length}</span> signals
                {" "}(DI: {diCount}, DO: {doCount}, AI: {aiCount}, AO: {aoCount})
                {hasHardware && (
                  <> &middot; <span className="font-semibold">{parseResult.hardware.length}</span> PLC{parseResult.hardware.length !== 1 ? "s" : ""}
                  , {totalCarriers} carrier{totalCarriers !== 1 ? "s" : ""}
                  , {totalSlots} module slot{totalSlots !== 1 ? "s" : ""}</>
                )}
              </div>

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {parseResult.warnings.length} warning{parseResult.warnings.length !== 1 ? "s" : ""}
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5 max-h-24 overflow-y-auto">
                    {parseResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hardware config */}
              {hasHardware && (
                <div className="rounded-md border p-4 space-y-4 bg-muted/20">
                  <div className="rounded border divide-y text-xs max-h-48 overflow-y-auto bg-background">
                    {parseResult.hardware.map((plc) =>
                      plc.carriers.map((carrier) => {
                        const hwType = carrierHwTypes.get(carrier.key) ?? carrier.hwType;
                        const hwLabel = carrier.cabinetNumber != null && carrier.carrierNumber != null
                          ? `N${carrier.cabinetNumber}:D${String(carrier.carrierNumber).padStart(2, "0")}`
                          : carrier.key;
                        return (
                          <div key={carrier.key} className="px-3 py-2 flex items-center gap-3">
                            <span className="font-mono font-semibold w-16 shrink-0">{hwLabel}</span>
                            <Select
                              value={hwType}
                              onValueChange={(v) => {
                                const next = new Map(carrierHwTypes);
                                next.set(carrier.key, v as "plc" | "distio");
                                setCarrierHwTypes(next);
                                carrier.hwType = v as "plc" | "distio";
                              }}
                            >
                              <SelectTrigger className="h-6 rounded border border-input bg-background px-1.5 text-xs w-24 shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="distio">Dist-IO</SelectItem>
                                <SelectItem value="plc">PLC (local)</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground truncate flex-1">
                              {carrier.slots.length} card{carrier.slots.length !== 1 ? "s" : ""}
                              {carrier.slots.length > 0 && ": "}
                              {carrier.slots.slice(0, 4).map((s) => {
                                const sg = s.subgroup ?? "";
                                const tc = s.typeCode ?? "";
                                const id = tc && s.instanceNumber != null
                                  ? `${sg}${tc}${String(s.instanceNumber).padStart(2, "0")}`
                                  : `S${s.slotPosition}`;
                                return `${id}`;
                              }).join(", ")}
                              {carrier.slots.length > 4 && ` +${carrier.slots.length - 4} more`}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">PLC Type (optional)</Label>
                      <Select
                        value={selectedPlcCatalogId ? String(selectedPlcCatalogId) : "none"}
                        onValueChange={(v) => { setSelectedPlcCatalogId(v === "none" ? null : Number(v)); setSelectedProtocol(null); }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unknown" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unknown / skip</SelectItem>
                          {plcCatalog.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.articleNumber}{p.description ? ` — ${p.description}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coupler Type (optional)</Label>
                      <Select
                        value={selectedCouplerCatalogId ? String(selectedCouplerCatalogId) : "none"}
                        onValueChange={(v) => { setSelectedCouplerCatalogId(v === "none" ? null : Number(v)); }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unknown" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unknown / skip</SelectItem>
                          {couplerCatalog
                            .filter((c) => !effectiveProtocol || c.protocols.some((p) => p.protocol === effectiveProtocol))
                            .map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.articleNumber}{c.description ? ` — ${c.description}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Bus Protocol
                        {matchedProtocols.length > 0 && (
                          <span className="ml-1 text-green-600">({matchedProtocols.length} match{matchedProtocols.length !== 1 ? "es" : ""})</span>
                        )}
                      </Label>
                      <Select
                        value={effectiveProtocol ?? "none"}
                        onValueChange={(v) => {
                          const proto = v === "none" ? null : v as BusProtocol;
                          setSelectedProtocol(proto);
                          // Clear coupler if it doesn't support the new protocol
                          if (proto && selectedCouplerCatalogId) {
                            const coupler = couplerCatalog.find((c) => c.id === selectedCouplerCatalogId);
                            if (coupler && !coupler.protocols.some((p) => p.protocol === proto)) {
                              setSelectedCouplerCatalogId(null);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Local (no network)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Local (no network)</SelectItem>
                          {(matchedProtocols.length > 0 ? matchedProtocols : BUS_PROTOCOLS).map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Signal preview */}
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {parseResult.signals.length > 20 ? "Showing first 20 of " : ""}
                  {parseResult.signals.length} signal{parseResult.signals.length !== 1 ? "s" : ""}
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-2 py-1.5 font-medium">TAG</th>
                        <th className="px-2 py-1.5 font-medium">Description</th>
                        <th className="px-2 py-1.5 font-medium">Type</th>
                        <th className="px-2 py-1.5 font-medium">System</th>
                        <th className="px-2 py-1.5 font-medium">Position</th>
                        <th className="px-2 py-1.5 font-medium">Ch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.signals.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-2 py-1 font-mono text-[11px]">{row.instrumentTag ?? "—"}</td>
                          <td className="px-2 py-1 max-w-xs truncate">{row.description}</td>
                          <td className="px-2 py-1">{row.rawIoType}</td>
                          <td className="px-2 py-1 truncate max-w-[120px]">{row.system ?? "—"}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{row.cardRef ?? "—"}</td>
                          <td className="px-2 py-1">{row.channelPosition != null ? row.channelPosition + 1 : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bus devices preview */}
              {parseResult.busDevices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {parseResult.busDevices.length} bus device{parseResult.busDevices.length !== 1 ? "s" : ""} (Serial IO)
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-2 py-1.5 font-medium">System</th>
                          <th className="px-2 py-1.5 font-medium">Protocol</th>
                          <th className="px-2 py-1.5 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.busDevices.map((dev, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-2 py-1">{dev.systemName}</td>
                            <td className="px-2 py-1 font-mono text-[11px]">{dev.protocol}</td>
                            <td className="px-2 py-1 text-muted-foreground truncate max-w-xs">{dev.comments ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each device will create a network + skeleton component on the first PLC. Add signals later.
                  </p>
                </div>
              )}
            </div>
          )}

          {importStatus && <p className="text-sm text-muted-foreground">{importStatus}</p>}
          {importError && (
            <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {importError}
            </p>
          )}
          {postImportWarnings.length > 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {postImportWarnings.length} card{postImportWarnings.length !== 1 ? "s" : ""} missing type code
              </p>
              <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5 max-h-32 overflow-y-auto">
                {postImportWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                Add missing card types in Misc &gt; Module Type Codes, then re-import or edit cards manually.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={handleClose} disabled={importing}>{postImportWarnings.length > 0 ? "Close" : "Cancel"}</Button>
            <Button onClick={handleImport} disabled={!parseResult || importing}>
              {importing
                ? (importStatus ?? "Importing...")
                : parseResult
                ? `Import${hasHardware ? " hardware +" : ""} ${parseResult.signals.length} signals`
                : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
