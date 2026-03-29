"use client";

import { use, useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Upload, Network, FileSpreadsheet, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SignalGrid } from "../_components/SignalGrid";
import { ImportDbcDialog } from "../_components/ImportDbcDialog";
import { ImportModbusDialog } from "../../_components/ImportModbusDialog";
import { StructuredImportDialog, type TargetField } from "@/components/structured-import-dialog";
import { useRouter } from "next/navigation";

const MODBUS_TARGET_FIELDS: TargetField[] = [
  { key: "address", label: "Modbus Address", required: true },
  { key: "registerType", label: "Register Type" },
  { key: "bit", label: "Bit Position" },
  { key: "name", label: "Signal Name", required: true },
  { key: "description", label: "Description" },
  { key: "dataType", label: "Data Type" },
  { key: "access", label: "Access (R/W)" },
  { key: "unit", label: "Unit" },
  { key: "scale", label: "Scale Factor" },
];

function resolveRegisterType(raw: string | undefined, address: string | undefined): "HOLDING_REGISTER" | "INPUT_REGISTER" | "COIL" | "DISCRETE_INPUT" {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("holding")) return "HOLDING_REGISTER";
  if (r.includes("input")) return "INPUT_REGISTER";
  if (r.includes("coil")) return "COIL";
  if (r.includes("discrete")) return "DISCRETE_INPUT";
  const addr = parseInt(address ?? "", 10);
  if (addr >= 40000) return "HOLDING_REGISTER";
  if (addr >= 30000) return "INPUT_REGISTER";
  return "HOLDING_REGISTER";
}

function resolveDataType(raw: string | undefined, bit: string | undefined): "INT16" | "UINT16" | "INT32" | "UINT32" | "FLOAT32" | "BOOL" | "WORD" | "DWORD" {
  const r = (raw ?? "").toUpperCase();
  if (r === "BOOL" || (bit && bit !== "--" && bit !== "")) return "BOOL";
  if (r === "INT" || r === "INT16") return "INT16";
  if (r === "UINT" || r === "UINT16" || r === "WORD") return "UINT16";
  if (r === "DINT" || r === "INT32") return "INT32";
  if (r === "UDINT" || r === "UINT32" || r === "DWORD") return "UINT32";
  if (r === "REAL" || r === "FLOAT" || r === "FLOAT32") return "FLOAT32";
  return "INT16";
}

function resolveAccess(raw: string | undefined): "R" | "W" | "RW" {
  const r = (raw ?? "").toUpperCase().replace(/[^RWO]/g, "");
  if (r.includes("W") && r.includes("R")) return "RW";
  if (r.includes("W")) return "W";
  return "R";
}

export default function ComponentSignalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = Number(rawId);

  const [showImportDbc, setShowImportDbc] = useState(false);
  const [showImportModbus, setShowImportModbus] = useState(false);
  const [showStructuredImport, setShowStructuredImport] = useState(false);

  const { data, isLoading, refetch } = trpc.components.componentById.useQuery({ id });
  const importMut = trpc.components.modbusImport.useMutation();
  const { data: effectiveSignals = [] } = trpc.components.effectiveSignals.useQuery(
    { componentId: id },
    { enabled: !!data?.parentId }
  );

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Component not found.</div>;

  const inherited = data.parentId ? effectiveSignals.filter((s: any) => s.inherited) : [];

  return (
    <div className="flex flex-col flex-1">
      {/* Inherited signals (read-only, collapsible) */}
      {inherited.length > 0 && (
        <InheritedSignalsSection inherited={inherited} parentId={data.parentId!} parentName={data.parent?.name ?? "parent"} />
      )}

      <section className="px-8 py-6 space-y-3 flex-1">
        <div className="flex items-center justify-between max-w-5xl">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {data.parentId ? "Own Signals" : "Signals"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.signals.length} signal{data.signals.length !== 1 ? "s" : ""} defined
              {data.parent ? ` + ${effectiveSignals.filter((s: any) => s.inherited).length} inherited` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowStructuredImport(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Structured Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowImportModbus(true)}>
              <Network className="h-4 w-4 mr-1" /> AI Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowImportDbc(true)}>
              <Upload className="h-4 w-4 mr-1" /> DBC
            </Button>
          </div>
        </div>
        <SignalGrid
          componentId={id}
          signals={data.signals}
          onRefresh={() => refetch()}
        />
      </section>

      {showStructuredImport && data && (
        <StructuredImportDialog
          open
          onClose={() => setShowStructuredImport(false)}
          title={`Structured Import — ${data.name}`}
          targetFields={MODBUS_TARGET_FIELDS}
          onImport={async (rows) => {
            const signals = rows.map((row) => ({
              address: parseInt(row.address, 10) || 0,
              registerType: resolveRegisterType(row.registerType, row.address),
              dataType: resolveDataType(row.dataType, row.bit),
              name: (row.name || "").replace(/[^A-Za-z0-9_]/g, "_").substring(0, 100),
              description: row.description || row.name || "",
              unit: row.unit || null,
              scaleFactor: row.scale ? parseFloat(row.scale) : null,
              offset: null,
              readWrite: resolveAccess(row.access),
              bitPosition: row.bit && row.bit !== "--" ? parseInt(row.bit, 10) : null,
            }));
            await importMut.mutateAsync({ componentId: id, registers: signals });
            refetch();
            setShowStructuredImport(false);
          }}
        />
      )}

      {showImportModbus && data && (
        <ImportModbusDialog
          componentId={id}
          componentName={data.name}
          open
          onClose={() => setShowImportModbus(false)}
          onImported={() => {
            refetch();
            setShowImportModbus(false);
          }}
        />
      )}

      {showImportDbc && (
        <ImportDbcDialog
          componentId={id}
          existingChannelCount={data.signals.length}
          open
          onClose={() => setShowImportDbc(false)}
          onImported={() => {
            refetch();
            setShowImportDbc(false);
          }}
        />
      )}
    </div>
  );
}

function InheritedSignalsSection({ inherited, parentId, parentName }: { inherited: any[]; parentId: number; parentName: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <section className="px-8 py-4 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          Inherited Signals
          <span className="font-normal text-xs">({inherited.length} from {parentName})</span>
        </button>
        <button
          type="button"
          onClick={() => router.push(`/components/${parentId}`)}
          className="text-xs text-blue-600 hover:underline"
        >
          Open parent
        </button>
      </div>
      {open && (
        <div className="overflow-x-auto rounded-md border max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-1.5 font-medium w-12">Ch</th>
                <th className="px-2 py-1.5 font-medium w-12">IO</th>
                <th className="px-2 py-1.5 font-medium">Tag Suffix</th>
                <th className="px-2 py-1.5 font-medium">Description</th>
                <th className="px-2 py-1.5 font-medium w-24">Source</th>
              </tr>
            </thead>
            <tbody>
              {inherited.map((sig: any) => (
                <tr key={sig.id} className="border-b last:border-0 text-muted-foreground">
                  <td className="px-2 py-1 tabular-nums">{sig.channelOffset}</td>
                  <td className="px-2 py-1">{sig.ioType}</td>
                  <td className="px-2 py-1 font-mono">{sig.tagSuffix ?? "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[300px]">{sig.description ?? "—"}</td>
                  <td className="px-2 py-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">
                      inherited
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
