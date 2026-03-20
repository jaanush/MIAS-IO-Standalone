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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Check, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

export interface TargetField {
  key: string;
  label: string;
  required?: boolean;
  description?: string;
}

type SheetInfo = { name: string; rowCount: number; headers: string[]; sampleRows: string[][] };
type ColumnMapping = { sourceColumn: string; targetField: string };
type RowFilter = { column: string; operator: "==" | "!="; value: string };
type MappedRow = Record<string, string>;

interface ImportPreset {
  name: string;
  sheetHint: string;
  mappings: ColumnMapping[];
  filters: RowFilter[];
}

const LS_PRESETS_KEY = "mias-import-presets";

function loadPresets(): ImportPreset[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PRESETS_KEY) ?? "[]");
  } catch { return []; }
}

function savePresets(presets: ImportPreset[]) {
  localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(presets));
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Unique key for this import type — presets are scoped by this */
  presetKey?: string;
  /** Target fields the user maps Excel columns to */
  targetFields: TargetField[];
  /** Called with the final mapped rows — the parent handles the actual DB import */
  onImport: (rows: MappedRow[]) => Promise<void>;
}

// ── Component ──────────────────────────────────────────────────────────

export function StructuredImportDialog({ open, onClose, title, presetKey, targetFields, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "sheet" | "map" | "preview" | "done">("upload");
  const [fileBase64, setFileBase64] = useState<string>("");
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [filters, setFilters] = useState<RowFilter[]>([]);
  const [previewRows, setPreviewRows] = useState<MappedRow[]>([]);
  const [previewStats, setPreviewStats] = useState({ total: 0, filtered: 0 });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  const scopedKey = presetKey ?? title;
  const presets = useMemo(() => loadPresets().filter((p) => p.name.startsWith(scopedKey + ":")), [scopedKey]);

  const readSheets = trpc.import.readSheets.useMutation({
    onSuccess: (data) => {
      setSheets(data);
      if (data.length === 1) {
        setSelectedSheet(data[0].name);
        initMappings(data[0]);
        setStep("map");
      } else {
        setStep("sheet");
      }
    },
  });

  const extractRows = trpc.import.extractRows.useMutation({
    onSuccess: (data) => {
      setPreviewRows(data.rows);
      setPreviewStats({ total: data.totalRows, filtered: data.filteredOut });
      setStep("preview");
    },
  });

  const columnValues = trpc.import.columnValues.useMutation();

  const currentSheet = sheets.find((s) => s.name === selectedSheet);
  const headers = currentSheet?.headers ?? [];

  function initMappings(sheet: SheetInfo) {
    // Auto-map: match target field labels/keys to sheet headers (case-insensitive)
    const auto: ColumnMapping[] = [];
    for (const tf of targetFields) {
      const match = sheet.headers.find((h) => {
        const hl = h.toLowerCase();
        return hl === tf.key.toLowerCase() ||
          hl === tf.label.toLowerCase() ||
          hl.includes(tf.key.toLowerCase()) ||
          tf.key.toLowerCase().includes(hl);
      });
      if (match) {
        auto.push({ sourceColumn: match, targetField: tf.key });
      }
    }
    setMappings(auto);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(",")[1];
      setFileBase64(b64);
      readSheets.mutate({ fileBase64: b64 });
    };
    reader.readAsDataURL(file);
  }

  function applyPreset(preset: ImportPreset) {
    // Try to find the hinted sheet
    const hintedSheet = sheets.find((s) => s.name === preset.sheetHint);
    if (hintedSheet) {
      setSelectedSheet(hintedSheet.name);
    }
    // Apply mappings (only if source columns exist in current headers)
    const currentHeaders = (hintedSheet ?? sheets.find((s) => s.name === selectedSheet))?.headers ?? [];
    const validMappings = preset.mappings.filter((m) => currentHeaders.includes(m.sourceColumn));
    setMappings(validMappings);
    setFilters(preset.filters);
    if (hintedSheet || selectedSheet) setStep("map");
  }

  function saveCurrentPreset() {
    if (!presetName.trim()) return;
    const preset: ImportPreset = {
      name: `${scopedKey}:${presetName.trim()}`,
      sheetHint: selectedSheet,
      mappings,
      filters,
    };
    const all = loadPresets().filter((p) => p.name !== preset.name);
    all.push(preset);
    savePresets(all);
    setShowSavePreset(false);
    setPresetName("");
  }

  function deletePreset(name: string) {
    savePresets(loadPresets().filter((p) => p.name !== name));
  }

  function selectSheet(name: string) {
    setSelectedSheet(name);
    const sheet = sheets.find((s) => s.name === name);
    if (sheet) initMappings(sheet);
    setStep("map");
  }

  function setMapping(targetField: string, sourceColumn: string) {
    setMappings((prev) => {
      const without = prev.filter((m) => m.targetField !== targetField);
      if (sourceColumn) without.push({ sourceColumn, targetField });
      return without;
    });
  }

  function addFilter() {
    if (headers.length === 0) return;
    setFilters((prev) => [...prev, { column: headers[0], operator: "==", value: "" }]);
  }

  function updateFilter(idx: number, update: Partial<RowFilter>) {
    setFilters((prev) => prev.map((f, i) => i === idx ? { ...f, ...update } : f));
  }

  function removeFilter(idx: number) {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  }

  function doExtract() {
    extractRows.mutate({
      fileBase64,
      sheetName: selectedSheet,
      mappings,
      filters: filters.filter((f) => f.value), // skip empty value filters
    });
  }

  async function doImport() {
    setImporting(true);
    setImportError(null);
    try {
      await onImport(previewRows);
      setStep("done");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    if (importing || readSheets.isPending || extractRows.isPending) return;
    setStep("upload");
    setFileBase64("");
    setSheets([]);
    setSelectedSheet("");
    setMappings([]);
    setFilters([]);
    setPreviewRows([]);
    setImportError(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const mappedTargets = new Set(mappings.map((m) => m.targetField));
  const requiredMissing = targetFields.filter((f) => f.required && !mappedTargets.has(f.key));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload an Excel (.xlsx) or CSV file.</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={readSheets.isPending}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            />
            {readSheets.isPending && (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Reading file...</span>
              </div>
            )}
            {readSheets.error && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{readSheets.error.message}</p>
            )}
          </div>
        )}

        {/* Step 2: Sheet selection */}
        {step === "sheet" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select a sheet to import from:</p>
            {presets.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Or apply a saved preset:</p>
                <div className="flex gap-2 flex-wrap">
                  {presets.map((p) => (
                    <Button key={p.name} variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset(p)}>
                      {p.name.replace(scopedKey + ":", "")} ({p.sheetHint})
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-md border divide-y">
              {sheets.map((s) => (
                <button
                  key={s.name}
                  onClick={() => selectSheet(s.name)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 text-left"
                >
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.headers.slice(0, 5).join(", ")}{s.headers.length > 5 ? "..." : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{s.rowCount} rows</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
          </div>
        )}

        {/* Step 3: Column mapping + filters */}
        {step === "map" && (
          <div className="space-y-5">
            <div className="text-sm text-muted-foreground">
              Sheet: <span className="font-medium text-foreground">{selectedSheet}</span> ({currentSheet?.rowCount} rows)
            </div>

            {/* Presets */}
            {(presets.length > 0 || mappings.length > 0) && (
              <div className="flex items-center gap-2 flex-wrap">
                {presets.map((p) => {
                  const displayName = p.name.replace(scopedKey + ":", "");
                  return (
                    <div key={p.name} className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset(p)}>
                        {displayName}
                      </Button>
                      <button type="button" onClick={() => deletePreset(p.name)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {mappings.length > 0 && !showSavePreset && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setShowSavePreset(true)}>
                    Save as preset...
                  </Button>
                )}
                {showSavePreset && (
                  <div className="flex items-center gap-1">
                    <Input className="h-7 text-xs w-32" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveCurrentPreset(); if (e.key === "Escape") setShowSavePreset(false); }} />
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={saveCurrentPreset} disabled={!presetName.trim()}>Save</Button>
                    <button type="button" onClick={() => setShowSavePreset(false)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            )}

            {/* Column mapping */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Column Mapping</h3>
              <div className="grid gap-2">
                {targetFields.map((tf) => {
                  const current = mappings.find((m) => m.targetField === tf.key)?.sourceColumn ?? "";
                  return (
                    <div key={tf.key} className="flex items-center gap-3">
                      <div className="w-40 text-right">
                        <span className="text-sm">{tf.label}</span>
                        {tf.required && <span className="text-destructive ml-0.5">*</span>}
                      </div>
                      <Select value={current || "__none__"} onValueChange={(v) => setMapping(tf.key, v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="— not mapped —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— not mapped —</SelectItem>
                          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Row Filters</h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addFilter}>
                  <Plus className="h-3 w-3 mr-1" /> Add filter
                </Button>
              </div>
              {filters.length === 0 && (
                <p className="text-xs text-muted-foreground">No filters — all rows will be imported.</p>
              )}
              {filters.map((f, idx) => (
                <FilterRow
                  key={idx}
                  filter={f}
                  headers={headers}
                  fileBase64={fileBase64}
                  sheetName={selectedSheet}
                  onChange={(update) => updateFilter(idx, update)}
                  onRemove={() => removeFilter(idx)}
                />
              ))}
            </div>

            {/* Sample data */}
            {currentSheet && currentSheet.sampleRows.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground">Sample Data (first 5 rows)</h3>
                <div className="overflow-x-auto rounded border max-h-36 overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/40">
                        {currentSheet.headers.map((h) => (
                          <th key={h} className="px-1.5 py-1 font-medium text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentSheet.sampleRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {currentSheet.headers.map((_, j) => (
                            <td key={j} className="px-1.5 py-0.5 truncate max-w-[120px]">{row[j] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {extractRows.error && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{extractRows.error.message}</p>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep(sheets.length > 1 ? "sheet" : "upload")}>Back</Button>
              <Button onClick={doExtract} disabled={requiredMissing.length > 0 || extractRows.isPending}>
                {extractRows.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Extracting...</> : "Preview"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <span className="font-medium">{previewRows.length}</span> rows to import
              {previewStats.filtered > 0 && (
                <span className="text-muted-foreground"> ({previewStats.filtered} filtered out of {previewStats.total})</span>
              )}
            </div>

            <div className="overflow-x-auto rounded-md border max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b bg-muted/40">
                    {targetFields.filter((f) => mappedTargets.has(f.key)).map((f) => (
                      <th key={f.key} className="px-2 py-1.5 font-medium text-left whitespace-nowrap">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-accent/20">
                      {targetFields.filter((f) => mappedTargets.has(f.key)).map((f) => (
                        <td key={f.key} className="px-2 py-1 truncate max-w-[200px]">{row[f.key] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > 50 && (
              <p className="text-xs text-muted-foreground">Showing first 50 of {previewRows.length} rows</p>
            )}

            {importError && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{importError}</p>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={doImport} disabled={previewRows.length === 0 || importing}>
                  {importing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing...</> : <><Check className="h-4 w-4 mr-1" /> Import {previewRows.length} rows</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-green-600 font-medium">Import complete.</p>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Filter row with value autocomplete ─────────────────────────────────

function FilterRow({ filter, headers, fileBase64, sheetName, onChange, onRemove }: {
  filter: RowFilter;
  headers: string[];
  fileBase64: string;
  sheetName: string;
  onChange: (update: Partial<RowFilter>) => void;
  onRemove: () => void;
}) {
  const [values, setValues] = useState<string[]>([]);
  const columnValues = trpc.import.columnValues.useMutation({
    onSuccess: (data) => setValues(data),
  });

  function onColumnChange(col: string) {
    onChange({ column: col, value: "" });
    setValues([]);
    columnValues.mutate({ fileBase64, sheetName, columnHeader: col });
  }

  // Load values on mount if column is set
  const loadedCol = useRef("");
  if (filter.column && filter.column !== loadedCol.current && !columnValues.isPending) {
    loadedCol.current = filter.column;
    columnValues.mutate({ fileBase64, sheetName, columnHeader: filter.column });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={filter.column} onValueChange={onColumnChange}>
        <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filter.operator} onValueChange={(v) => onChange({ operator: v as "==" | "!=" })}>
        <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="==">==</SelectItem>
          <SelectItem value="!=">!=</SelectItem>
        </SelectContent>
      </Select>
      {values.length > 0 ? (
        <Select value={filter.value || "__none__"} onValueChange={(v) => onChange({ value: v === "__none__" ? "" : v })}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select value..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— select —</SelectItem>
            {values.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input className="h-8 text-xs flex-1" value={filter.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="Value..." />
      )}
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
