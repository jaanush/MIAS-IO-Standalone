"use client";

import { useState, useRef } from "react";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";

type Register = {
  address: number;
  registerType: "HOLDING_REGISTER" | "INPUT_REGISTER" | "COIL" | "DISCRETE_INPUT";
  dataType: "INT16" | "UINT16" | "INT32" | "UINT32" | "FLOAT32" | "BOOL" | "WORD" | "DWORD";
  name: string;
  description: string;
  unit: string | null;
  scaleFactor: number | null;
  offset: number | null;
  readWrite: "R" | "W" | "RW";
  bitPosition: number | null;
};

type Props = {
  componentId: number;
  componentName: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

const REG_TYPE_SHORT: Record<string, string> = {
  HOLDING_REGISTER: "HR", INPUT_REGISTER: "IR", COIL: "C", DISCRETE_INPUT: "DI",
};

const RW_COLOR: Record<string, string> = {
  R: "bg-blue-50 text-blue-700 border-blue-200",
  W: "bg-orange-50 text-orange-700 border-orange-200",
  RW: "bg-green-50 text-green-700 border-green-200",
};

export function ImportModbusDialog({ componentId, componentName, open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "sheets" | "review" | "done">("upload");
  const [fileData, setFileData] = useState<{ base64: string; name: string; mime: string } | null>(null);
  const [sheets, setSheets] = useState<{ name: string; rowCount: number }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [registers, setRegisters] = useState<Register[]>([]);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const listSheets = trpc.components.modbusListSheets.useMutation({
    onSuccess: (data) => {
      if (data.sheets.length > 1) {
        setSheets(data.sheets);
        setSelectedSheets(new Set(data.sheets.map((s) => s.name)));
        setStep("sheets");
      } else {
        // Single sheet or non-Excel — go straight to extract
        doExtract();
      }
    },
  });

  const extract = trpc.components.modbusExtract.useMutation({
    onSuccess: (data) => {
      setRegisters(data.registers);
      setDeviceName(data.deviceName);
      setNotes(data.notes);
      setStep("review");
    },
  });

  const importMut = trpc.components.modbusImport.useMutation({
    onSuccess: () => {
      setStep("done");
      onImported();
    },
  });

  function doExtract(sheetsFilter?: string[]) {
    if (!fileData) return;
    extract.mutate({
      fileBase64: fileData.base64,
      fileName: fileData.name,
      mimeType: fileData.mime,
      selectedSheets: sheetsFilter,
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      const data = { base64, name: file.name, mime: file.type || "application/octet-stream" };
      setFileData(data);

      // For Excel files, list sheets first
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        listSheets.mutate({ fileBase64: base64, fileName: file.name });
      } else {
        // Non-Excel — go straight to AI extraction
        extract.mutate({ fileBase64: base64, fileName: file.name, mimeType: data.mime });
      }
    };
    reader.readAsDataURL(file);
  }

  function handleImport() {
    const filtered = registers.filter((_, i) => !excluded.has(i));
    importMut.mutate({ componentId, registers: filtered });
  }

  function toggleSheet(name: string) {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleExclude(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function handleClose() {
    if (extract.isPending || importMut.isPending || listSheets.isPending) return;
    setStep("upload");
    setFileData(null);
    setSheets([]);
    setSelectedSheets(new Set());
    setRegisters([]);
    setDeviceName(null);
    setNotes(null);
    setExcluded(new Set());
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const includedCount = registers.length - excluded.size;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Modbus Register Map — {componentName}</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a Modbus register map. Structured Excel files are parsed directly.
              PDFs and images use AI extraction.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.txt"
              onChange={handleFileUpload}
              disabled={listSheets.isPending || extract.isPending}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            />
            {(listSheets.isPending || extract.isPending) && (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {listSheets.isPending ? "Reading sheets..." : "Extracting registers..."}
                </span>
              </div>
            )}
            {(listSheets.error || extract.error) && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(listSheets.error || extract.error)?.message}
              </p>
            )}
          </div>
        )}

        {step === "sheets" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select which sheets to import registers from:
            </p>
            <div className="rounded-md border divide-y">
              {sheets.map((s) => (
                <label key={s.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={selectedSheets.has(s.name)}
                    onChange={() => toggleSheet(s.name)}
                  />
                  <span className="text-sm font-medium flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.rowCount} rows</span>
                </label>
              ))}
            </div>
            {extract.isPending && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Extracting registers...</span>
              </div>
            )}
            {extract.error && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {extract.error.message}
              </p>
            )}
            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => { setStep("upload"); setSheets([]); }}>Back</Button>
              <Button
                onClick={() => doExtract([...selectedSheets])}
                disabled={selectedSheets.size === 0 || extract.isPending}
              >
                Extract from {selectedSheets.size} sheet{selectedSheets.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
              {deviceName && <div><span className="text-muted-foreground">Device:</span> <span className="font-medium">{deviceName}</span></div>}
              <div>
                <span className="text-muted-foreground">Extracted:</span>{" "}
                <span className="font-medium">{registers.length}</span> registers
                {excluded.size > 0 && <span className="text-amber-600"> ({excluded.size} excluded)</span>}
              </div>
              {notes && <div className="text-xs text-muted-foreground mt-1">{notes}</div>}
            </div>

            <div className="overflow-x-auto rounded-md border max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-2 py-1.5 font-medium w-8"></th>
                    <th className="px-2 py-1.5 font-medium">Addr</th>
                    <th className="px-2 py-1.5 font-medium">Type</th>
                    <th className="px-2 py-1.5 font-medium">Data</th>
                    <th className="px-2 py-1.5 font-medium">R/W</th>
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Description</th>
                    <th className="px-2 py-1.5 font-medium">Unit</th>
                    <th className="px-2 py-1.5 font-medium">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  {registers.map((reg, i) => {
                    const isExcluded = excluded.has(i);
                    return (
                      <tr key={i} className={`border-b last:border-0 ${isExcluded ? "opacity-30" : "hover:bg-accent/20"}`}>
                        <td className="px-2 py-1">
                          <input type="checkbox" className="h-3.5 w-3.5 rounded border-input cursor-pointer" checked={!isExcluded} onChange={() => toggleExclude(i)} />
                        </td>
                        <td className="px-2 py-1 font-mono tabular-nums">{reg.address}</td>
                        <td className="px-2 py-1"><Badge variant="outline" className="text-[10px] px-1 py-0">{REG_TYPE_SHORT[reg.registerType] ?? reg.registerType}</Badge></td>
                        <td className="px-2 py-1 font-mono">{reg.dataType}</td>
                        <td className="px-2 py-1"><Badge variant="outline" className={`text-[10px] px-1 py-0 ${RW_COLOR[reg.readWrite] ?? ""}`}>{reg.readWrite}</Badge></td>
                        <td className="px-2 py-1 font-mono truncate max-w-[150px]">{reg.name}</td>
                        <td className="px-2 py-1 truncate max-w-[200px]">{reg.description}</td>
                        <td className="px-2 py-1 text-muted-foreground">{reg.unit ?? "—"}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">
                          {reg.scaleFactor != null ? `×${reg.scaleFactor}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {importMut.error && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importMut.error.message}
              </p>
            )}

            <div className="flex justify-between items-center pt-1">
              <Button variant="outline" onClick={() => { setStep(sheets.length > 1 ? "sheets" : "upload"); setRegisters([]); setExcluded(new Set()); }}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleImport} disabled={includedCount === 0 || importMut.isPending}>
                  {importMut.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing...</>
                  ) : (
                    <><Check className="h-4 w-4 mr-1" /> Import {includedCount} registers</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-green-600 font-medium">
              Imported {includedCount} registers as component signals.
            </p>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
