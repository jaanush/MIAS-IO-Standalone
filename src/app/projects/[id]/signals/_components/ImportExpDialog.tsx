"use client";

import { useState, useRef, useMemo } from "react";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";

// ── Parser types ──────────────────────────────────────────────────────────────

type ParsedChannel = {
  sectionName: string;
  indexInParent: number;
  symbolicName: string;
  comment: string;
  channelMode: "I" | "Q";
  iecAddress: string;
};

type ParsedModule = {
  indexInParent: number;
  moduleName: string;
  articleNumber: string | null;
  channels: ParsedChannel[];
  isFieldbus: boolean;
};

type ExpParseResult = {
  modules: ParsedModule[];
  warnings: string[];
};

// ── Parser ────────────────────────────────────────────────────────────────────

function parseExpFile(text: string): ExpParseResult {
  const lines = text.split(/\r?\n/);
  const modules: ParsedModule[] = [];
  const warnings: string[] = [];
  let i = 0;

  function peek(): string {
    return i < lines.length ? lines[i].trim() : "";
  }

  function advance(): string {
    return i < lines.length ? lines[i++].trim() : "";
  }

  function parseValue(line: string): string {
    const idx = line.indexOf(":");
    if (idx < 0) return "";
    let val = line.substring(idx + 1).trim();
    // Strip surrounding single quotes
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    return val;
  }

  function parseChannel(): ParsedChannel | null {
    // We're on the line after _CHANNEL
    let sectionName = "";
    let indexInParent = 0;
    let symbolicName = "";
    let comment = "";
    let channelMode: "I" | "Q" = "I";
    let iecAddress = "";

    while (i < lines.length) {
      const line = peek();
      if (line === "_END_CHANNEL") {
        advance();
        break;
      }
      advance();
      if (line.startsWith("_SECTION_NAME:")) sectionName = parseValue(line);
      else if (line.startsWith("_INDEX_IN_PARENT:")) indexInParent = Number(parseValue(line)) || 0;
      else if (line.startsWith("_SYMBOLIC_NAME:")) symbolicName = parseValue(line);
      else if (line.startsWith("_COMMENT:")) comment = parseValue(line);
      else if (line.startsWith("_CHANNEL_MODE:")) channelMode = parseValue(line) === "Q" ? "Q" : "I";
      else if (line.startsWith("_IECADR:")) iecAddress = parseValue(line);
    }

    return { sectionName, indexInParent, symbolicName, comment, channelMode, iecAddress };
  }

  function parseModule(isFieldbus: boolean): ParsedModule | null {
    let moduleName = "";
    let indexInParent = 0;
    const channels: ParsedChannel[] = [];
    let depth = 1; // Track nesting depth to handle child modules

    while (i < lines.length) {
      const line = peek();

      if (line === "_END_MODULE") {
        advance();
        depth--;
        if (depth <= 0) break;
        continue;
      }

      if (line.startsWith("_MODULE:")) {
        // Nested child module — could be a sub-module or fieldbus variable container
        advance();
        depth++;
        // Check if this is a fieldbus variables container
        const childIsFieldbus = isFieldbus;
        // Parse the child as a separate module
        const childModule = parseModule(childIsFieldbus);
        if (childModule && childModule.channels.length > 0) {
          modules.push(childModule);
        }
        depth--; // Child already consumed its _END_MODULE
        continue;
      }

      if (line === "_CHANNEL") {
        advance();
        const ch = parseChannel();
        if (ch) channels.push(ch);
        continue;
      }

      advance();
      if (line.startsWith("_MODULE_NAME:")) {
        moduleName = parseValue(line);
        // Detect fieldbus variables section
        if (moduleName.toLowerCase().includes("fieldbus")) isFieldbus = true;
      } else if (line.startsWith("_INDEX_IN_PARENT:")) {
        indexInParent = Number(parseValue(line)) || 0;
      }
    }

    // Extract article number from module name
    const articleMatch = moduleName.match(/(\d{3,4}-\d{3,5}(?:\/\d{4}-\d{4})?)/);
    const articleNumber = articleMatch ? articleMatch[1] : null;

    return {
      indexInParent,
      moduleName,
      articleNumber,
      channels,
      isFieldbus,
    };
  }

  // Skip to PLC_CONFIGURATION
  while (i < lines.length && !peek().startsWith("PLC_CONFIGURATION")) advance();

  // Find the root and K_Bus modules, then parse children
  while (i < lines.length) {
    const line = peek();

    if (line.startsWith("_MODULE:")) {
      advance();
      const mod = parseModule(false);
      if (mod && mod.channels.length > 0) {
        modules.push(mod);
      }
      continue;
    }

    advance();
  }

  return { modules, warnings };
}

// ── Channel type classification ───────────────────────────────────────────────

function classifyChannel(ch: ParsedChannel): {
  signalType: "DISCRETE" | "ANALOG";
  direction: "INPUT" | "OUTPUT";
} {
  const sec = ch.sectionName.toUpperCase();
  const isAnalog = sec.includes("WORD") || sec.includes("DWORD");
  const direction = ch.channelMode === "Q" ? "OUTPUT" as const : "INPUT" as const;
  return {
    signalType: isAnalog ? "ANALOG" : "DISCRETE",
    direction,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function ImportExpDialog({ projectId, open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<ExpParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [plcName, setPlcName] = useState("CoDeSys PLC");
  const [includeFieldbus, setIncludeFieldbus] = useState(false);

  const { data: modules = [] } = trpc.hardware.moduleList.useQuery(undefined, { enabled: open });

  const utils = trpc.useUtils();
  const bulkCreate = trpc.signal.bulkCreate.useMutation();
  const createPlc = trpc.projectHardware.plcCreate.useMutation();
  const assignCard = trpc.projectHardware.cardAssign.useMutation();

  // Normalize article numbers: strip leading zeros from each part (0750-0530 → 750-530)
  // and strip sub-part suffix (750-0511/0000-0002 → 750-511)
  function normalizeArticle(art: string): string {
    const base = art.split("/")[0];
    return base.split("-").map((p) => p.replace(/^0+/, "") || "0").join("-");
  }

  // Build normalized article → catalog lookup
  const moduleMapNorm = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of modules) {
      map.set(normalizeArticle(m.articleNumber), m.id);
      // Also keep full article number for exact matches
      map.set(m.articleNumber, m.id);
    }
    return map;
  }, [modules]);

  function lookupCatalog(articleNumber: string | null): number | null {
    if (!articleNumber) return null;
    return moduleMapNorm.get(articleNumber) ?? moduleMapNorm.get(normalizeArticle(articleNumber)) ?? null;
  }

  // Filtered modules for display
  const physicalModules = useMemo(() =>
    parseResult?.modules.filter((m) => !m.isFieldbus) ?? [], [parseResult]);
  const fieldbusModules = useMemo(() =>
    parseResult?.modules.filter((m) => m.isFieldbus) ?? [], [parseResult]);

  // Stats
  const matchedCount = physicalModules.filter((m) => lookupCatalog(m.articleNumber) != null).length;
  const unmatchedCount = physicalModules.filter((m) => m.articleNumber && lookupCatalog(m.articleNumber) == null).length;
  const noArticleCount = physicalModules.filter((m) => !m.articleNumber).length;
  const totalChannels = physicalModules.reduce((n, m) => n + m.channels.filter((c) => c.symbolicName).length, 0);
  const fieldbusChannels = fieldbusModules.reduce((n, m) => n + m.channels.filter((c) => c.symbolicName).length, 0);

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
        const text = ev.target!.result as string;
        const result = parseExpFile(text);
        if (result.modules.length === 0) {
          setParseError("No modules or channels found in the file. Is this a valid CoDeSys 2 .EXP export?");
          return;
        }
        setParseResult(result);
      } catch (err) {
        setParseError(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parseResult) return;
    setImporting(true);
    setImportError(null);
    setImportStatus(null);

    try {
      // Phase 1: Create PLC (with auto-created LOCAL carrier)
      setImportStatus("Creating PLC…");
      const plc = await createPlc.mutateAsync({
        projectId,
        name: plcName.trim() || "CoDeSys PLC",
      });

      // The LOCAL carrier is auto-created by plcCreate — get it
      const carrierId = plc.carriers[0]?.id;
      if (!carrierId) throw new Error("PLC created but no LOCAL carrier found");

      // Phase 2: Assign cards to carrier slots
      const cardIdBySlot = new Map<number, number>(); // module indexInParent → ioCard.id

      for (const mod of physicalModules) {
        const catalogId = lookupCatalog(mod.articleNumber);
        if (!catalogId) continue;

        setImportStatus(`Assigning slot ${mod.indexInParent}: ${mod.articleNumber}…`);
        try {
          const card = await assignCard.mutateAsync({
            carrierId,
            slotPosition: mod.indexInParent - 1, // Convert 1-based to 0-based
            catalogId,
          });
          cardIdBySlot.set(mod.indexInParent, card.id);
        } catch (err) {
          console.warn(`Failed to assign slot ${mod.indexInParent} (${mod.articleNumber}):`, err);
        }
      }

      // Phase 3: Build signal batch
      const signalBatch: Array<{
        signalType: "DISCRETE" | "ANALOG";
        origin: "IEC";
        tag: string;
        description: string;
        direction: "INPUT" | "OUTPUT";
        ioCardId: number | null;
        channelPosition: number | null;
      }> = [];

      for (const mod of physicalModules) {
        const cardId = cardIdBySlot.get(mod.indexInParent) ?? null;
        for (const ch of mod.channels) {
          if (!ch.symbolicName) continue; // Skip unnamed/reserve channels
          const { signalType, direction } = classifyChannel(ch);
          signalBatch.push({
            signalType,
            origin: "IEC",
            tag: ch.symbolicName,
            description: ch.comment || ch.symbolicName,
            direction,
            ioCardId: cardId,
            channelPosition: ch.indexInParent - 1, // 0-based
          });
        }
      }

      // Include fieldbus channels if opted in
      if (includeFieldbus) {
        for (const mod of fieldbusModules) {
          for (const ch of mod.channels) {
            if (!ch.symbolicName) continue;
            const { signalType, direction } = classifyChannel(ch);
            signalBatch.push({
              signalType,
              origin: "IEC",
              tag: ch.symbolicName,
              description: ch.comment || ch.symbolicName,
              direction,
              ioCardId: null, // Fieldbus — no physical card
              channelPosition: null,
            });
          }
        }
      }

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
    setPlcName("CoDeSys PLC");
    setIncludeFieldbus(false);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle>Import CoDeSys 2 Hardware Configuration</DialogTitle>
        </DialogHeader>

        {/* File picker */}
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept=".exp,.EXP"
            onChange={handleFileChange}
            className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {parseError && (
            <p className="text-sm text-destructive">{parseError}</p>
          )}
        </div>

        {/* Preview */}
        {parseResult && (
          <>
            {/* Summary badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">{physicalModules.length} modules</Badge>
              <Badge variant="secondary">{totalChannels} signals</Badge>
              {matchedCount > 0 && (
                <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {matchedCount} matched
                </Badge>
              )}
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {unmatchedCount} unmatched
                </Badge>
              )}
              {noArticleCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  <MinusCircle className="h-3 w-3 mr-1" /> {noArticleCount} skipped (no article)
                </Badge>
              )}
              {fieldbusChannels > 0 && (
                <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                  {fieldbusChannels} fieldbus signals
                </Badge>
              )}
            </div>

            {/* Config */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium whitespace-nowrap">PLC Name</label>
                <Input
                  className="h-7 text-sm w-48"
                  value={plcName}
                  onChange={(e) => setPlcName(e.target.value)}
                  placeholder="CoDeSys PLC"
                />
              </div>
              {fieldbusChannels > 0 && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFieldbus}
                    onChange={(e) => setIncludeFieldbus(e.target.checked)}
                  />
                  Include {fieldbusChannels} fieldbus signals (unbound)
                </label>
              )}
            </div>

            {/* Module list */}
            <div className="flex-1 overflow-auto rounded-md border min-h-0 max-h-[40vh]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs border-b z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium w-10">Slot</th>
                    <th className="px-2 py-1.5 text-left font-medium w-28">Article</th>
                    <th className="px-2 py-1.5 text-left font-medium">Module</th>
                    <th className="px-2 py-1.5 text-center font-medium w-14">Signals</th>
                    <th className="px-2 py-1.5 text-center font-medium w-20">Catalog</th>
                  </tr>
                </thead>
                <tbody>
                  {physicalModules.map((mod, idx) => {
                    const matched = lookupCatalog(mod.articleNumber);
                    const namedChannels = mod.channels.filter((c) => c.symbolicName).length;
                    return (
                      <tr key={idx} className={cn("border-b last:border-0", !mod.articleNumber && "text-muted-foreground/50")}>
                        <td className="px-2 py-1 tabular-nums">{mod.indexInParent}</td>
                        <td className="px-2 py-1 font-mono">{mod.articleNumber ?? "—"}</td>
                        <td className="px-2 py-1 truncate max-w-[300px]" title={mod.moduleName}>{mod.moduleName}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{namedChannels}</td>
                        <td className="px-2 py-1 text-center">
                          {!mod.articleNumber ? (
                            <span className="text-muted-foreground/40">—</span>
                          ) : matched ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {fieldbusModules.length > 0 && (
                    <tr className="border-t-2 border-muted">
                      <td colSpan={5} className="px-2 py-1.5 text-muted-foreground font-medium">
                        Fieldbus Variables ({fieldbusChannels} signals)
                        {!includeFieldbus && <span className="font-normal ml-2 italic">— will be skipped</span>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <div className="text-xs text-amber-600 space-y-0.5">
                {parseResult.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
          </>
        )}

        {/* Import status / errors */}
        {importStatus && (
          <p className="text-xs text-muted-foreground">{importStatus}</p>
        )}
        {importError && (
          <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {importError}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parseResult || importing || physicalModules.length === 0}
          >
            {importing
              ? "Importing…"
              : `Import ${physicalModules.length} modules + ${totalChannels + (includeFieldbus ? fieldbusChannels : 0)} signals`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
