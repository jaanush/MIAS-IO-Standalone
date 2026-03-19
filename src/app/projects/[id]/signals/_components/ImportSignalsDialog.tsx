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

// ── Hardware tree types ────────────────────────────────────────────────────────

type ParsedSlot = {
  slotPosition: number;
  articleNumber: string;
};

type ParsedCarrier = {
  groupLetter: string;
  name: string;
  slots: ParsedSlot[];
};

type ParsedPlc = {
  name: string;
  location: string | null;
  carriers: ParsedCarrier[];
};

// ── Signal row type ────────────────────────────────────────────────────────────

type ParsedRow = {
  description: string;
  signalType: "DISCRETE" | "ANALOG";
  direction: "INPUT" | "OUTPUT";
  componentTag: string | null;
  channelPosition: number | null;
  cardRef: string | null;
  trigger: "NO" | "NC";
  inputTypeCode: string | null;
  engineeringUnitSymbol: string | null;
  systemCode: string | null;
  systemName: string | null;
  gvlName: string | null;
  notes: string | null;
  rawIoType: string;
};

type ParseResult = {
  hardware: ParsedPlc[];
  signals: ParsedRow[];
};

type Props = {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function cellString(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return "";
  return String(cell.v ?? "").trim();
}

function cellNum(sheet: XLSX.WorkSheet, row: number, col: number): number | null {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return null;
  const n = Number(cell.v);
  return isNaN(n) ? null : n;
}

function extractCode(text: string): string | null {
  const m = text.match(/\((\d+)\)/);
  return m ? m[1] : null;
}

function stripCodeSuffix(text: string): string {
  return text.replace(/\s*\(\d+\)\s*$/, "").trim();
}

function resolveInputTypeCode(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (s === "PT100") return "PT100";
  if (s === "PT1000") return "PT1000";
  if (s === "4-20MA" || s === "4-20 MA" || s === "4–20MA" || s === "4–20 MA") return "MA_4_20";
  if (s === "0-20MA" || s === "0-20 MA" || s === "0–20MA" || s === "0–20 MA") return "MA_0_20";
  return null;
}

function resolveTrigger(raw: string): "NO" | "NC" {
  const s = raw.trim().toUpperCase();
  if (s === "NC" || s === "NO RELAY") return "NC";
  return "NO";
}

function parseCardRef(ref: string): { plcName: string; groupLetter: string; slotPosition: number } | null {
  const m = ref.match(/^([^:]+):([A-Za-z])(\d+)$/);
  if (!m) return null;
  return { plcName: m[1].trim(), groupLetter: m[2].toUpperCase(), slotPosition: Number(m[3]) };
}

function parseSheet(sheet: XLSX.WorkSheet): ParseResult {
  const ref = sheet["!ref"];
  const range = ref ? XLSX.utils.decode_range(ref) : null;
  const maxRow = range ? range.e.r : 2000;

  const plcMap = new Map<string, { location: string | null; carriers: Map<string, Map<number, string>> }>();
  const signals: ParsedRow[] = [];

  for (let rowIdx = 4; rowIdx <= maxRow; rowIdx++) {
    const plcNameCell = cellString(sheet, rowIdx, 3); // col D
    const cardRefRaw = cellString(sheet, rowIdx, 5);  // col F
    const articleNumber = cellString(sheet, rowIdx, 7); // col H
    const ioType = cellString(sheet, rowIdx, 9).trim().toUpperCase(); // col J

    if (cardRefRaw) {
      const parsed = parseCardRef(cardRefRaw);
      if (parsed && articleNumber) {
        const effectivePlcName = plcNameCell || parsed.plcName;
        const plcLocation = cellString(sheet, rowIdx, 4) || null; // col E

        if (!plcMap.has(effectivePlcName)) {
          plcMap.set(effectivePlcName, { location: plcLocation, carriers: new Map() });
        }
        const plcEntry = plcMap.get(effectivePlcName)!;
        if (!plcEntry.location && plcLocation) plcEntry.location = plcLocation;

        if (!plcEntry.carriers.has(parsed.groupLetter)) {
          plcEntry.carriers.set(parsed.groupLetter, new Map());
        }
        const slotMap = plcEntry.carriers.get(parsed.groupLetter)!;
        if (!slotMap.has(parsed.slotPosition)) {
          slotMap.set(parsed.slotPosition, articleNumber);
        }
      }
    }

    const isDiscrete = ioType === "DI" || ioType === "DO";
    const isAnalog = ioType === "AI" || ioType === "AO";
    if (!isDiscrete && !isAnalog) continue;

    const description = cellString(sheet, rowIdx, 2);
    if (!description) continue;

    const systemRaw = cellString(sheet, rowIdx, 0);
    const componentTag = cellString(sheet, rowIdx, 1) || null;
    const channelRaw = cellNum(sheet, rowIdx, 6);
    const signalTypeRaw = cellString(sheet, rowIdx, 10);
    const euSymbol = cellString(sheet, rowIdx, 12) || null;
    const gvlName = cellString(sheet, rowIdx, 13) || null;
    const notes = cellString(sheet, rowIdx, 14) || null;

    signals.push({
      description,
      signalType: isDiscrete ? "DISCRETE" : "ANALOG",
      direction: ioType === "DI" || ioType === "AI" ? "INPUT" : "OUTPUT",
      componentTag,
      channelPosition: channelRaw != null ? channelRaw - 1 : null,
      cardRef: cardRefRaw || null,
      trigger: isDiscrete ? resolveTrigger(signalTypeRaw) : "NO",
      inputTypeCode: isAnalog ? resolveInputTypeCode(signalTypeRaw) : null,
      engineeringUnitSymbol: euSymbol,
      systemCode: extractCode(systemRaw),
      systemName: systemRaw ? stripCodeSuffix(systemRaw) : null,
      gvlName,
      notes,
      rawIoType: ioType,
    });
  }

  const hardware: ParsedPlc[] = [];
  for (const [plcName, plcData] of plcMap.entries()) {
    const carriers: ParsedCarrier[] = [];
    for (const [groupLetter, slotMap] of plcData.carriers.entries()) {
      const slots: ParsedSlot[] = [];
      for (const [slotPosition, articleNumber] of slotMap.entries()) {
        slots.push({ slotPosition, articleNumber });
      }
      slots.sort((a, b) => a.slotPosition - b.slotPosition);
      carriers.push({ groupLetter, name: `${plcName}-${groupLetter}`, slots });
    }
    carriers.sort((a, b) => a.groupLetter.localeCompare(b.groupLetter));
    hardware.push({ name: plcName, location: plcData.location, carriers });
  }

  return { hardware, signals };
}

/** Map ModuleCatalog cardType to signal type + direction. Returns null for MIXED/ambiguous types. */
function cardTypeToSignalInfo(
  cardType: string | undefined
): { signalType: "DISCRETE" | "ANALOG"; direction: "INPUT" | "OUTPUT" } | null {
  switch (cardType) {
    case "DI":      return { signalType: "DISCRETE", direction: "INPUT" };
    case "DO":      return { signalType: "DISCRETE", direction: "OUTPUT" };
    case "AI":      return { signalType: "ANALOG",   direction: "INPUT" };
    case "AO":      return { signalType: "ANALOG",   direction: "OUTPUT" };
    case "RELAY":   return { signalType: "DISCRETE", direction: "OUTPUT" };
    case "COUNTER": return { signalType: "DISCRETE", direction: "INPUT" };
    default:        return null; // MIXED, PWM, SERIAL, IO_LINK, SUPPLY — fall back to col J
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ImportSignalsDialog({ projectId, open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Catalog selections for hardware matching
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
  const bulkCreate = trpc.signal.bulkCreate.useMutation();
  const systemUpsert = trpc.signal.systemUpsert.useMutation();
  const gvlUpsert = trpc.signal.gvlUpsert.useMutation();
  const createPlc = trpc.projectHardware.plcCreate.useMutation();
  const createCarrier = trpc.projectHardware.carrierCreate.useMutation();
  const createNetwork = trpc.projectHardware.networkCreate.useMutation();
  const assignCard = trpc.projectHardware.cardAssign.useMutation();

  // Auto-detect matched protocols from selected PLC + coupler catalog entries
  const matchedProtocols = useMemo<BusProtocol[]>(() => {
    const plcEntry = plcCatalog.find((p) => p.id === selectedPlcCatalogId);
    const couplerEntry = couplerCatalog.find((c) => c.id === selectedCouplerCatalogId);
    if (!plcEntry || !couplerEntry) return [];
    const plcProtocols = new Set(plcEntry.protocols.map((p) => p.protocol as BusProtocol));
    const couplerProtocols = new Set(couplerEntry.protocols.map((p) => p.protocol as BusProtocol));
    return [...plcProtocols].filter((p) => couplerProtocols.has(p));
  }, [selectedPlcCatalogId, selectedCouplerCatalogId, plcCatalog, couplerCatalog]);

  // When matched protocols update, auto-select if there's exactly one match
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

        let sheet: XLSX.WorkSheet | undefined;
        const targetName = workbook.SheetNames.find(
          (n) => n.trim().toUpperCase() === "EXTERNAL IO-LIST"
        );
        if (targetName) {
          sheet = workbook.Sheets[targetName];
        } else if (workbook.SheetNames.length > 1) {
          sheet = workbook.Sheets[workbook.SheetNames[1]];
        } else {
          sheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        if (!sheet) {
          setParseError("Could not find a valid sheet in the workbook.");
          return;
        }

        const result = parseSheet(sheet);
        if (result.signals.length === 0 && result.hardware.length === 0) {
          setParseError(
            "No valid data found. Check that data starts at row 5 and col J contains DI/DO/AI/AO."
          );
          return;
        }
        setParseResult(result);
        setSelectedProtocol(null);
      } catch (err) {
        setParseError(
          `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`
        );
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
    const moduleCardTypeMap = new Map<string, string>(modules.map((m) => [m.articleNumber, m.cardType]));
    const systemMap = new Map<string, number>(systems.map((s) => [s.code, s.id]));
    const gvlMap = new Map<string, number>(gvls.map((g) => [g.name, g.id]));
    const euMap = new Map<string, number>(engineeringUnits.map((eu) => [eu.symbol, eu.id]));
    const inputTypeMap = new Map<string, number>(inputTypes.map((t) => [t.code, t.id]));

    // cardRef → ioCard.id
    const cardRefMap = new Map<string, number>();
    // cardRef → { signalType, direction } derived from card's catalog cardType
    type CardSignalInfo = { signalType: "DISCRETE" | "ANALOG"; direction: "INPUT" | "OUTPUT" } | null;
    const cardSignalTypeMap = new Map<string, CardSignalInfo>();

    try {
      // ── Phase 1: Hardware ──────────────────────────────────────────────────
      for (const parsedPlc of parseResult.hardware) {
        setImportStatus(`Creating PLC ${parsedPlc.name}…`);
        const plc = await createPlc.mutateAsync({
          projectId,
          catalogId: selectedPlcCatalogId ?? null,
          name: parsedPlc.name,
          notes: parsedPlc.location ? `Location: ${parsedPlc.location}` : null,
        });

        // Create a local carrier for the PLC's own IO bus
        setImportStatus(`Creating local carrier for ${parsedPlc.name}…`);
        await createCarrier.mutateAsync({
          plcId: plc.id,
          name: `${parsedPlc.name}-LOCAL`,
          catalogId: selectedPlcCatalogId ?? null,
          plcNetworkId: null,
        });

        // Create one network for all carrier groups on this PLC (if protocol known)
        let networkId: number | null = null;
        if (effectiveProtocol && parsedPlc.carriers.length > 0) {
          setImportStatus(`Creating ${effectiveProtocol} network on ${parsedPlc.name}…`);
          const network = await createNetwork.mutateAsync({
            plcId: plc.id,
            protocol: effectiveProtocol,
            role: "MASTER",
            ioCardId: null,
            description: null,
          });
          networkId = network.id;
        }

        for (const parsedCarrier of parsedPlc.carriers) {
          setImportStatus(`Creating carrier ${parsedCarrier.name}…`);
          const carrier = await createCarrier.mutateAsync({
            plcId: plc.id,
            name: parsedCarrier.name,
            catalogId: selectedCouplerCatalogId ?? null,
            plcNetworkId: networkId,
          });

          for (const parsedSlot of parsedCarrier.slots) {
            const catalogId = moduleMap.get(parsedSlot.articleNumber);
            if (!catalogId) {
              console.warn(`Module not found in catalog: ${parsedSlot.articleNumber} — slot skipped`);
              continue;
            }
            setImportStatus(
              `Slot ${parsedSlot.slotPosition} (${parsedSlot.articleNumber}) on ${parsedCarrier.name}…`
            );
            const card = await assignCard.mutateAsync({
              carrierId: carrier.id,
              slotPosition: parsedSlot.slotPosition,
              catalogId,
            });
            const refKey = `${parsedPlc.name}:${parsedCarrier.groupLetter}${parsedSlot.slotPosition}`;
            cardRefMap.set(refKey, card.id);
            cardSignalTypeMap.set(refKey, cardTypeToSignalInfo(moduleCardTypeMap.get(parsedSlot.articleNumber)));
          }
        }
      }

      // ── Phase 2: Signals (bulk) ────────────────────────────────────────────
      setImportStatus(`Preparing ${parseResult.signals.length} signals…`);

      // Pre-upsert all unique systems and GVLs
      const uniqueSysCodes = [...new Set(parseResult.signals.map((r) => r.systemCode).filter(Boolean))] as string[];
      for (const code of uniqueSysCodes) {
        if (!systemMap.has(code)) {
          const row = parseResult.signals.find((r) => r.systemCode === code)!;
          const result = await systemUpsert.mutateAsync({ code, name: row.systemName ?? code, description: null });
          systemMap.set(code, result.id);
        }
      }
      const uniqueGvls = [...new Set(parseResult.signals.map((r) => r.gvlName).filter(Boolean))] as string[];
      for (const name of uniqueGvls) {
        if (!gvlMap.has(name)) {
          const result = await gvlUpsert.mutateAsync({ name, description: null });
          gvlMap.set(name, result.id);
        }
      }

      const signalBatch = parseResult.signals.map((row) => {
        const cardInfo = row.cardRef ? (cardSignalTypeMap.get(row.cardRef) ?? null) : null;
        return {
          signalType: cardInfo?.signalType ?? row.signalType,
          origin: "IEC" as const,
          description: row.description,
          componentTag: row.componentTag,
          direction: cardInfo?.direction ?? row.direction,
          systemId: row.systemCode ? (systemMap.get(row.systemCode) ?? null) : null,
          gvlId: row.gvlName ? (gvlMap.get(row.gvlName) ?? null) : null,
          notes: row.notes,
          ioCardId: row.cardRef ? (cardRefMap.get(row.cardRef) ?? null) : null,
          channelPosition: row.channelPosition,
          trigger: row.trigger,
          inputTypeId: row.inputTypeCode ? (inputTypeMap.get(row.inputTypeCode) ?? null) : null,
          engineeringUnitId: row.engineeringUnitSymbol ? (euMap.get(row.engineeringUnitSymbol) ?? null) : null,
        };
      });

      setImportStatus(`Creating ${signalBatch.length} signals…`);
      await bulkCreate.mutateAsync({ projectId, signals: signalBatch });

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

  const totalCarriers = parseResult?.hardware.reduce((sum, p) => sum + p.carriers.length, 0) ?? 0;
  const totalSlots = parseResult?.hardware.reduce(
    (sum, p) => sum + p.carriers.reduce((s2, c) => s2 + c.slots.length, 0), 0
  ) ?? 0;
  const hasHardware = (parseResult?.hardware.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
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
              Sheet &quot;EXTERNAL IO-list&quot; (or sheet 2). Header row 4, data from row 5.
            </p>
          </div>

          {parseError && (
            <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {parseError}
            </p>
          )}

          {parseResult && (
            <div className="space-y-4">
              {/* Hardware configuration */}
              {hasHardware && (
                <div className="rounded-md border p-4 space-y-4 bg-muted/20">
                  <p className="text-sm font-semibold">
                    Hardware:{" "}
                    {parseResult.hardware.length} PLC{parseResult.hardware.length !== 1 ? "s" : ""},{" "}
                    {totalCarriers} carrier{totalCarriers !== 1 ? "s" : ""},{" "}
                    {totalSlots} module slot{totalSlots !== 1 ? "s" : ""}
                  </p>

                  {/* Slot preview */}
                  <div className="rounded border divide-y text-xs max-h-36 overflow-y-auto bg-background">
                    {parseResult.hardware.map((plc) => (
                      <div key={plc.name} className="px-3 py-2">
                        <div className="font-semibold">
                          {plc.name}{plc.location ? ` — ${plc.location}` : ""}
                        </div>
                        {plc.carriers.map((carrier) => (
                          <div key={carrier.groupLetter} className="pl-4 text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">{carrier.name}</span>
                            {": "}
                            {carrier.slots.map((s) => `[${s.slotPosition}] ${s.articleNumber}`).join("  ")}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Catalog matching */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">PLC Type (optional)</Label>
                      <Select
                        value={selectedPlcCatalogId ? String(selectedPlcCatalogId) : "none"}
                        onValueChange={(v) => {
                          setSelectedPlcCatalogId(v === "none" ? null : Number(v));
                          setSelectedProtocol(null);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Unknown" />
                        </SelectTrigger>
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
                        onValueChange={(v) => {
                          setSelectedCouplerCatalogId(v === "none" ? null : Number(v));
                          setSelectedProtocol(null);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Unknown" />
                        </SelectTrigger>
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
                          <span className="ml-1 text-green-600">
                            ({matchedProtocols.length} match{matchedProtocols.length !== 1 ? "es" : ""})
                          </span>
                        )}
                      </Label>
                      <Select
                        value={effectiveProtocol ?? "none"}
                        onValueChange={(v) => setSelectedProtocol(v === "none" ? null : v as BusProtocol)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Local (no network)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Local (no network)</SelectItem>
                          {(matchedProtocols.length > 0 ? matchedProtocols : BUS_PROTOCOLS).map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {effectiveProtocol && (
                    <p className="text-xs text-muted-foreground">
                      One <span className="font-medium text-foreground">{effectiveProtocol}</span> network
                      will be created on each PLC; all {totalCarriers} carrier{totalCarriers !== 1 ? "s" : ""} will connect through it.
                    </p>
                  )}
                  {!effectiveProtocol && (
                    <p className="text-xs text-amber-600">
                      No protocol selected — carriers will be created as local (direct-attached).
                      Select PLC + coupler types to auto-detect, or pick a protocol manually.
                    </p>
                  )}
                </div>
              )}

              {/* Signal preview */}
              {parseResult.signals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {parseResult.signals.length} signal{parseResult.signals.length !== 1 ? "s" : ""}
                    {parseResult.signals.length > 20 ? " — showing first 20" : ""}
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-2 py-1.5 font-medium">Description</th>
                          <th className="px-2 py-1.5 font-medium">Type</th>
                          <th className="px-2 py-1.5 font-medium">Dir</th>
                          <th className="px-2 py-1.5 font-medium">Card ref</th>
                          <th className="px-2 py-1.5 font-medium">Ch</th>
                          <th className="px-2 py-1.5 font-medium">System</th>
                          <th className="px-2 py-1.5 font-medium">GVL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.signals.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-2 py-1 max-w-xs truncate">{row.description}</td>
                            <td className="px-2 py-1">{row.rawIoType}</td>
                            <td className="px-2 py-1">{row.direction}</td>
                            <td className="px-2 py-1 font-mono">{row.cardRef ?? "—"}</td>
                            <td className="px-2 py-1">{row.channelPosition != null ? row.channelPosition : "—"}</td>
                            <td className="px-2 py-1">{row.systemCode ?? "—"}</td>
                            <td className="px-2 py-1">{row.gvlName ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import status */}
          {importStatus && (
            <p className="text-sm text-muted-foreground">{importStatus}</p>
          )}

          {importError && (
            <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {importError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!parseResult || importing}>
              {importing
                ? (importStatus ?? "Importing…")
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
