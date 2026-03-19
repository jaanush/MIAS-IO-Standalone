"use client";

import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
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
import { BUS_PROTOCOLS, type BusProtocol } from "@/lib/enums";

// ── Types ────────────────────────────────────────────────────────────────────

type ParsedSlot = { slotPosition: number; articleNumber: string };
type ParsedCarrier = { key: string; name: string; slots: ParsedSlot[] };
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
  cardRef: string | null;       // "PLC:CarrierKey"
  channelPosition: number | null;
};

type ParseResult = {
  hardware: ParsedPlc[];
  signals: ParsedRow[];
  busDevices: ParsedBusDevice[];
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
 * Parse the Position column: "N3:D02:BI01" → { plc: "N3", carrier: "D02", cardId: "BI01" }
 */
function parsePosition(pos: string): { plc: string; carrier: string; cardId: string } | null {
  const parts = pos.split(":");
  if (parts.length < 3) return null;
  return { plc: parts[0].trim(), carrier: parts[1].trim(), cardId: parts[2].trim() };
}

/**
 * Extract a slot number from a card identifier like "BI01" → 1, "BM03" → 3
 */
function cardIdToSlot(cardId: string): number {
  const m = cardId.match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function parseSheet(rows: any[][]): ParseResult {
  // Headers at row 6, data starts at row 8 (row 7 is blank)
  const plcMap = new Map<string, { cabinet: string | null; carriers: Map<string, Map<number, string>> }>();
  const signals: ParsedRow[] = [];

  for (let i = 8; i < rows.length; i++) {
    const ioType = cellStr(rows, i, 9).toUpperCase();
    const isDiscrete = ioType === "DI" || ioType === "DO";
    const isAnalog = ioType === "AI" || ioType === "AO";
    if (!isDiscrete && !isAnalog) continue;

    const description = cellStr(rows, i, 8);
    if (!description) continue;

    const position = cellStr(rows, i, 24);
    const cardType = cellStr(rows, i, 23);
    const channel = cellNum(rows, i, 26);
    const cabinet = cellStr(rows, i, 22) || null;

    // Build hardware tree from Position column
    let cardRef: string | null = null;
    if (position) {
      const parsed = parsePosition(position);
      if (parsed && cardType) {
        const plcName = parsed.plc;
        if (!plcMap.has(plcName)) {
          plcMap.set(plcName, { cabinet, carriers: new Map() });
        }
        const plcEntry = plcMap.get(plcName)!;
        if (!plcEntry.cabinet && cabinet) plcEntry.cabinet = cabinet;

        const carrierKey = parsed.carrier;
        if (!plcEntry.carriers.has(carrierKey)) {
          plcEntry.carriers.set(carrierKey, new Map());
        }
        const slotMap = plcEntry.carriers.get(carrierKey)!;
        const slotNum = cardIdToSlot(parsed.cardId);
        if (slotNum > 0 && !slotMap.has(slotNum)) {
          slotMap.set(slotNum, cardType);
        }
        cardRef = `${plcName}:${carrierKey}:${slotNum}`;
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
    });
  }

  // Build hardware array
  const hardware: ParsedPlc[] = [];
  for (const [plcName, plcData] of plcMap.entries()) {
    const carriers: ParsedCarrier[] = [];
    for (const [carrierKey, slotMap] of plcData.carriers.entries()) {
      const slots: ParsedSlot[] = [];
      for (const [slotPosition, articleNumber] of slotMap.entries()) {
        slots.push({ slotPosition, articleNumber });
      }
      slots.sort((a, b) => a.slotPosition - b.slotPosition);
      carriers.push({ key: carrierKey, name: `${plcName}-${carrierKey}`, slots });
    }
    carriers.sort((a, b) => a.key.localeCompare(b.key));
    hardware.push({ name: plcName, cabinet: plcData.cabinet, carriers });
  }

  return { hardware, signals, busDevices: [] };
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

  const [selectedPlcCatalogId, setSelectedPlcCatalogId] = useState<number | null>(null);
  const [selectedCouplerCatalogId, setSelectedCouplerCatalogId] = useState<number | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<BusProtocol | null>(null);

  const { data: systems = [] } = trpc.signal.systemList.useQuery(undefined, { enabled: open });
  const { data: gvls = [] } = trpc.signal.gvlList.useQuery(undefined, { enabled: open });
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
  const createNetwork = trpc.projectHardware.networkCreate.useMutation();
  const assignCard = trpc.projectHardware.cardAssign.useMutation();
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
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames.find(
          (n) => n.trim().toLowerCase() === "hardwired io"
        );
        if (!sheetName) {
          setParseError('Sheet "Hardwired IO" not found in the workbook.');
          return;
        }

        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        const result = parseSheet(rows);

        // Also parse Serial IO sheet for bus devices
        const serialSheetName = workbook.SheetNames.find(
          (n) => n.trim().toLowerCase() === "serial io"
        );
        if (serialSheetName) {
          const serialWs = workbook.Sheets[serialSheetName];
          const serialRows = XLSX.utils.sheet_to_json(serialWs, { header: 1, defval: "" }) as any[][];
          result.busDevices = parseSerialIO(serialRows);
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
    const cardRefToId = new Map<string, number>(); // "PLC:Carrier:Slot" → ioCard.id
    let firstPlcId: number | null = null;

    try {
      // ── Phase 1: Hardware ──────────────────────────────────────────────
      for (const parsedPlc of parseResult.hardware) {
        setImportStatus(`Creating PLC ${parsedPlc.name}...`);
        const plc = await createPlc.mutateAsync({
          projectId,
          catalogId: selectedPlcCatalogId ?? null,
          name: parsedPlc.name,
          notes: parsedPlc.cabinet ? `Cabinet: ${parsedPlc.cabinet}` : null,
        });
        if (!firstPlcId) firstPlcId = plc.id;

        // Local carrier
        await createCarrier.mutateAsync({
          plcId: plc.id,
          name: `${parsedPlc.name}-LOCAL`,
          catalogId: selectedPlcCatalogId ?? null,
          plcNetworkId: null,
        });

        let networkId: number | null = null;
        if (effectiveProtocol && parsedPlc.carriers.length > 0) {
          setImportStatus(`Creating ${effectiveProtocol} network on ${parsedPlc.name}...`);
          const network = await createNetwork.mutateAsync({
            plcId: plc.id,
            protocol: effectiveProtocol,
            role: "MASTER",
            ioCardId: null,
            description: null,
          });
          networkId = network.id;
        }

        for (const carrier of parsedPlc.carriers) {
          setImportStatus(`Creating carrier ${carrier.name}...`);
          const created = await createCarrier.mutateAsync({
            plcId: plc.id,
            name: carrier.name,
            catalogId: selectedCouplerCatalogId ?? null,
            plcNetworkId: networkId,
          });

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
            });
            cardRefToId.set(`${parsedPlc.name}:${carrier.key}:${slot.slotPosition}`, card.id);
          }
        }
      }

      // ── Phase 2: Signals ───────────────────────────────────────────────
      const total = parseResult.signals.length;
      for (let i = 0; i < total; i++) {
        const row = parseResult.signals[i];
        setImportStatus(`Importing signal ${i + 1} of ${total}...`);

        // Upsert system from name
        let systemId: number | null = null;
        if (row.system) {
          if (systemMap.has(row.system)) {
            systemId = systemMap.get(row.system)!;
          } else {
            const result = await systemUpsert.mutateAsync({
              code: row.system.substring(0, 10).replace(/\s+/g, "_").toUpperCase(),
              name: row.system,
              description: null,
            });
            systemMap.set(row.system, result.id);
            systemId = result.id;
          }
        }

        const engineeringUnitId = row.engineeringUnitSymbol
          ? (euMap.get(row.engineeringUnitSymbol) ?? null) : null;
        const inputTypeId = row.inputTypeCode
          ? (inputTypeMap.get(row.inputTypeCode) ?? null) : null;
        const ioCardId = row.cardRef ? (cardRefToId.get(row.cardRef) ?? null) : null;

        const signalData = {
          projectId,
          signalType: row.signalType,
          origin: "IEC" as const,
          description: row.description,
          direction: row.direction,
          systemId,
          ioCardId,
          channelPosition: row.channelPosition,
          cabinetLocation: row.cabinet,
          drawingRef: row.mimic,
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
          inputTypeId,
          engineeringUnitId,
          scaleMin: row.rangelow,
          scaleMax: row.rangeHigh,
        };
        try {
          await createSignal.mutateAsync(signalData);
        } catch (err) {
          // If unique constraint on (ioCardId, channelPosition), retry without card assignment
          if (String(err).includes("Unique constraint")) {
            await createSignal.mutateAsync({ ...signalData, ioCardId: null, channelPosition: null });
          } else {
            throw err;
          }
        }
      }

      // ── Phase 3: Bus devices (Serial IO) ─────────────────────────────
      if (parseResult.busDevices.length > 0 && firstPlcId) {
        for (const bus of parseResult.busDevices) {
          setImportStatus(`Creating bus device: ${bus.systemName}...`);

          // Create network on the first PLC
          const network = await createNetwork.mutateAsync({
            plcId: firstPlcId,
            protocol: bus.protocol,
            role: "MASTER",
            ioCardId: null,
            description: `${bus.systemName} serial connection`,
          });

          // Create a project-scoped skeleton HardwareComponent for this device type
          const component = await componentCreate.mutateAsync({
            projectId,
            name: bus.systemName,
            busProtocol: bus.protocol,
            status: "DRAFT",
            description: bus.comments ?? `${bus.protocol} device — imported from MPV Serial IO`,
          });

          // Create a ComponentInstance on the network (no signals yet)
          await instanceCreate.mutateAsync({
            projectId,
            componentId: component.id,
            plcNetworkId: network.id,
            name: bus.systemName,
            notes: bus.comments,
          });
        }
      }

      await utils.signal.list.invalidate({ projectId });
      await utils.projectHardware.getHardware.invalidate({ projectId });
      onImported();
      onClose();
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

              {/* Hardware config */}
              {hasHardware && (
                <div className="rounded-md border p-4 space-y-4 bg-muted/20">
                  <div className="rounded border divide-y text-xs max-h-36 overflow-y-auto bg-background">
                    {parseResult.hardware.map((plc) => (
                      <div key={plc.name} className="px-3 py-2">
                        <div className="font-semibold">
                          {plc.name}{plc.cabinet ? ` — ${plc.cabinet}` : ""}
                        </div>
                        {plc.carriers.map((carrier) => (
                          <div key={carrier.key} className="pl-4 text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">{carrier.name}</span>
                            {": "}
                            {carrier.slots.map((s) => `[${s.slotPosition}] ${s.articleNumber}`).join("  ")}
                          </div>
                        ))}
                      </div>
                    ))}
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
                        onValueChange={(v) => { setSelectedCouplerCatalogId(v === "none" ? null : Number(v)); setSelectedProtocol(null); }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unknown" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unknown / skip</SelectItem>
                          {couplerCatalog.map((c) => (
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
                        onValueChange={(v) => setSelectedProtocol(v === "none" ? null : v as BusProtocol)}
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

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={handleClose} disabled={importing}>Cancel</Button>
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
