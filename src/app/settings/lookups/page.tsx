"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Plus } from "lucide-react";
import type { CardType } from "@/lib/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

type SystemRow = { id: number; code: string; name: string; description: string | null };
type GvlRow = { id: number; name: string; description: string | null };
type AnalogInputTypeRow = { id: number; code: string; name: string; sortOrder: number };
type PlcDataTypeRow = { id: number; code: string; name: string; sortOrder: number };
type EngineeringUnitRow = { id: number; symbol: string; description: string | null; plcDataTypeId: number | null; plcDataTypeCatalog: PlcDataTypeRow | null };
type ApprovalRow = { id: number; code: string; name: string };

// ── Shared inline-edit helpers ───────────────────────────────────────────────

const inp = "h-7 w-full rounded border border-input bg-background px-1.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring";

function InlineActions({ onSave, onCancel, isPending }: { onSave: () => void; onCancel: () => void; isPending: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="rounded p-1 hover:bg-green-100 text-green-700 disabled:opacity-40" onClick={onSave} disabled={isPending} title="Save"><Check className="h-4 w-4" /></button>
      <button type="button" className="rounded p-1 hover:bg-accent text-muted-foreground" onClick={onCancel} title="Cancel"><X className="h-4 w-4" /></button>
    </div>
  );
}

function handleRowKeyDown(e: React.KeyboardEvent, onSave: () => void, onCancel: () => void) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); }
  if (e.key === "Escape") onCancel();
}

// ── Engineering Units Section ─────────────────────────────────────────────────

function EngineeringUnitsSection() {
  const utils = trpc.useUtils();
  const { data: units = [], isLoading } = trpc.signal.engineeringUnits.useQuery();
  const { data: plcDataTypes = [] } = trpc.signal.plcDataTypeList.useQuery();
  const upsert = trpc.signal.engineeringUnitUpsert.useMutation({
    onSuccess: () => {
      utils.signal.engineeringUnits.invalidate();
      setForm(null);
      setAdding(false);
    },
  });

  const [form, setForm] = useState<{ symbol: string; description: string; plcDataTypeId: number | null; editId: number | null } | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: EngineeringUnitRow) {
    setAdding(false);
    setForm({ symbol: row.symbol, description: row.description ?? "", plcDataTypeId: row.plcDataTypeId, editId: row.id });
  }

  function startAdd() {
    setForm({ symbol: "", description: "", plcDataTypeId: null, editId: null });
    setAdding(true);
  }

  function cancel() { setForm(null); setAdding(false); }

  function handleSave() {
    if (!form || !form.symbol.trim()) return;
    upsert.mutate({
      symbol: form.symbol.trim(),
      description: form.description.trim() || null,
      plcDataTypeId: form.plcDataTypeId,
    });
  }

  function renderEditCells(f: NonNullable<typeof form>) {
    const isEdit = f.editId != null;
    return (
      <>
        <td className="px-2 py-1"><Input className={inp} value={f.symbol} onChange={(e) => setForm({ ...f, symbol: e.target.value })} disabled={isEdit} placeholder="e.g. bar" autoFocus={!isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.description} onChange={(e) => setForm({ ...f, description: e.target.value })} placeholder="Optional" autoFocus={isEdit} /></td>
        <td className="px-2 py-1">
          <Select value={f.plcDataTypeId != null ? String(f.plcDataTypeId) : "__none__"} onValueChange={(v) => setForm({ ...f, plcDataTypeId: v === "__none__" ? null : Number(v) })}>
            <SelectTrigger className="h-7 w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__none__">—</SelectItem>{(plcDataTypes as PlcDataTypeRow[]).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.code}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        <td className="px-2 py-1"><InlineActions onSave={handleSave} onCancel={cancel} isPending={upsert.isPending} /></td>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium w-28">Symbol</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-36">PLC Data Type</th>
                <th className="px-3 py-2 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {(units as EngineeringUnitRow[]).length === 0 && !adding ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No engineering units found.</td></tr>
              ) : (
                (units as EngineeringUnitRow[]).map((eu) =>
                  form?.editId === eu.id ? (
                    <tr key={eu.id} className="border-b bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                      {renderEditCells(form)}
                    </tr>
                  ) : (
                    <tr key={eu.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{eu.symbol}</td>
                      <td className="px-3 py-2 text-muted-foreground">{eu.description ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{eu.plcDataTypeCatalog?.code ?? "—"}</td>
                      <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => startEdit(eu)}>Edit</Button></td>
                    </tr>
                  )
                )
              )}
              {adding && form && (
                <tr className="border-t bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                  {renderEditCells(form)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!adding && !form && (
        <Button size="sm" variant="outline" onClick={startAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Engineering Unit</Button>
      )}
    </div>
  );
}

// ── Signal Systems Section ────────────────────────────────────────────────────

function SignalSystemsSection() {
  const utils = trpc.useUtils();
  const { data: systems = [], isLoading } = trpc.signal.systemList.useQuery();
  const upsert = trpc.signal.systemUpsert.useMutation({
    onSuccess: () => {
      utils.signal.systemList.invalidate();
      setForm(null);
      setAdding(false);
    },
  });

  const [form, setForm] = useState<{ code: string; name: string; description: string; editId: number | null } | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: SystemRow) {
    setAdding(false);
    setForm({ code: row.code, name: row.name, description: row.description ?? "", editId: row.id });
  }

  function startAdd() {
    setForm({ code: "", name: "", description: "", editId: null });
    setAdding(true);
  }

  function cancel() { setForm(null); setAdding(false); }

  function handleSave() {
    if (!form || !form.code.trim() || !form.name.trim()) return;
    upsert.mutate({ code: form.code.trim(), name: form.name.trim(), description: form.description.trim() || null });
  }

  function renderEditCells(f: NonNullable<typeof form>) {
    const isEdit = f.editId != null;
    return (
      <>
        <td className="px-2 py-1"><Input className={inp} value={f.code} onChange={(e) => setForm({ ...f, code: e.target.value })} disabled={isEdit} placeholder="e.g. 625" autoFocus={!isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} placeholder="e.g. Propulsion FWD" autoFocus={isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.description} onChange={(e) => setForm({ ...f, description: e.target.value })} placeholder="Optional" /></td>
        <td className="px-2 py-1"><InlineActions onSave={handleSave} onCancel={cancel} isPending={upsert.isPending} /></td>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium w-24">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {(systems as SystemRow[]).length === 0 && !adding ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No systems found.</td></tr>
              ) : (
                (systems as SystemRow[]).map((row) =>
                  form?.editId === row.id ? (
                    <tr key={row.id} className="border-b bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                      {renderEditCells(form)}
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{row.code}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.description ?? "—"}</td>
                      <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => startEdit(row)}>Edit</Button></td>
                    </tr>
                  )
                )
              )}
              {adding && form && (
                <tr className="border-t bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                  {renderEditCells(form)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!adding && !form && (
        <Button size="sm" variant="outline" onClick={startAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add System</Button>
      )}
    </div>
  );
}

// ── GVL Section ───────────────────────────────────────────────────────────────

function GvlSection() {
  const utils = trpc.useUtils();
  const { data: gvls = [], isLoading } = trpc.signal.gvlList.useQuery();
  const upsert = trpc.signal.gvlUpsert.useMutation({
    onSuccess: () => {
      utils.signal.gvlList.invalidate();
      setForm(null);
      setAdding(false);
    },
  });

  const [form, setForm] = useState<{ name: string; description: string; editId: number | null } | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: GvlRow) {
    setAdding(false);
    setForm({ name: row.name, description: row.description ?? "", editId: row.id });
  }

  function startAdd() {
    setForm({ name: "", description: "", editId: null });
    setAdding(true);
  }

  function cancel() { setForm(null); setAdding(false); }

  function handleSave() {
    if (!form || !form.name.trim()) return;
    upsert.mutate({ name: form.name.trim(), description: form.description.trim() || null });
  }

  function renderEditCells(f: NonNullable<typeof form>) {
    const isEdit = f.editId != null;
    return (
      <>
        <td className="px-2 py-1"><Input className={inp} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} disabled={isEdit} placeholder="e.g. GVL_PROPULSION" autoFocus /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.description} onChange={(e) => setForm({ ...f, description: e.target.value })} placeholder="Optional" autoFocus={isEdit} /></td>
        <td className="px-2 py-1"><InlineActions onSave={handleSave} onCancel={cancel} isPending={upsert.isPending} /></td>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {(gvls as GvlRow[]).length === 0 && !adding ? (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No GVLs found.</td></tr>
              ) : (
                (gvls as GvlRow[]).map((row) =>
                  form?.editId === row.id ? (
                    <tr key={row.id} className="border-b bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                      {renderEditCells(form)}
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.description ?? "—"}</td>
                      <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => startEdit(row)}>Edit</Button></td>
                    </tr>
                  )
                )
              )}
              {adding && form && (
                <tr className="border-t bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                  {renderEditCells(form)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!adding && !form && (
        <Button size="sm" variant="outline" onClick={startAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add GVL</Button>
      )}
    </div>
  );
}

// ── Analog Input Types Section ────────────────────────────────────────────────

function AnalogInputTypesSection() {
  const utils = trpc.useUtils();
  const { data: types = [], isLoading } = trpc.signal.analogInputTypes.useQuery();
  const upsert = trpc.signal.analogInputTypeUpsert.useMutation({
    onSuccess: () => {
      utils.signal.analogInputTypes.invalidate();
      setForm(null);
      setAdding(false);
    },
  });

  const [form, setForm] = useState<{ code: string; name: string; sortOrder: string; editId: number | null } | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: AnalogInputTypeRow) {
    setAdding(false);
    setForm({ code: row.code, name: row.name, sortOrder: String(row.sortOrder), editId: row.id });
  }

  function startAdd() {
    setForm({ code: "", name: "", sortOrder: "0", editId: null });
    setAdding(true);
  }

  function cancel() { setForm(null); setAdding(false); }

  function handleSave() {
    if (!form || !form.code.trim() || !form.name.trim()) return;
    upsert.mutate({ code: form.code.trim(), name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 });
  }

  function renderEditCells(f: NonNullable<typeof form>) {
    const isEdit = f.editId != null;
    return (
      <>
        <td className="px-2 py-1"><Input className={cn(inp, "w-16 text-center")} type="number" value={f.sortOrder} onChange={(e) => setForm({ ...f, sortOrder: e.target.value })} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.code} onChange={(e) => setForm({ ...f, code: e.target.value })} disabled={isEdit} placeholder="e.g. 4_20MA" autoFocus={!isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} placeholder="e.g. 4–20 mA" autoFocus={isEdit} /></td>
        <td className="px-2 py-1"><InlineActions onSave={handleSave} onCancel={cancel} isPending={upsert.isPending} /></td>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium w-16">Order</th>
                <th className="px-3 py-2 font-medium w-40">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {(types as AnalogInputTypeRow[]).length === 0 && !adding ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No analog input types found.</td></tr>
              ) : (
                (types as AnalogInputTypeRow[]).map((t) =>
                  form?.editId === t.id ? (
                    <tr key={t.id} className="border-b bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                      {renderEditCells(form)}
                    </tr>
                  ) : (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{t.sortOrder}</td>
                      <td className="px-3 py-2 font-mono text-xs">{t.code}</td>
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => startEdit(t)}>Edit</Button></td>
                    </tr>
                  )
                )
              )}
              {adding && form && (
                <tr className="border-t bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                  {renderEditCells(form)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!adding && !form && (
        <Button size="sm" variant="outline" onClick={startAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Analog Input Type</Button>
      )}
    </div>
  );
}

// ── PLC Data Types Section ────────────────────────────────────────────────────

function PlcDataTypesSection() {
  const utils = trpc.useUtils();
  const { data: types = [], isLoading } = trpc.signal.plcDataTypeList.useQuery();
  const upsert = trpc.signal.plcDataTypeUpsert.useMutation({
    onSuccess: () => {
      utils.signal.plcDataTypeList.invalidate();
      setForm(null);
      setAdding(false);
    },
  });

  const [form, setForm] = useState<{ code: string; name: string; sortOrder: string; editId: number | null } | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: PlcDataTypeRow) {
    setAdding(false);
    setForm({ code: row.code, name: row.name, sortOrder: String(row.sortOrder), editId: row.id });
  }

  function startAdd() {
    setForm({ code: "", name: "", sortOrder: "0", editId: null });
    setAdding(true);
  }

  function cancel() { setForm(null); setAdding(false); }

  function handleSave() {
    if (!form || !form.code.trim() || !form.name.trim()) return;
    upsert.mutate({ code: form.code.trim(), name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 });
  }

  function renderEditCells(f: NonNullable<typeof form>) {
    const isEdit = f.editId != null;
    return (
      <>
        <td className="px-2 py-1"><Input className={cn(inp, "w-16 text-center")} type="number" value={f.sortOrder} onChange={(e) => setForm({ ...f, sortOrder: e.target.value })} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.code} onChange={(e) => setForm({ ...f, code: e.target.value })} disabled={isEdit} placeholder="e.g. BOOL" autoFocus={!isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} placeholder="e.g. Boolean" autoFocus={isEdit} /></td>
        <td className="px-2 py-1"><InlineActions onSave={handleSave} onCancel={cancel} isPending={upsert.isPending} /></td>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium w-16">Order</th>
                <th className="px-3 py-2 font-medium w-40">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {(types as PlcDataTypeRow[]).length === 0 && !adding ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No PLC data types found.</td></tr>
              ) : (
                (types as PlcDataTypeRow[]).map((t) =>
                  form?.editId === t.id ? (
                    <tr key={t.id} className="border-b bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                      {renderEditCells(form)}
                    </tr>
                  ) : (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{t.sortOrder}</td>
                      <td className="px-3 py-2 font-mono text-xs">{t.code}</td>
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => startEdit(t)}>Edit</Button></td>
                    </tr>
                  )
                )
              )}
              {adding && form && (
                <tr className="border-t bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                  {renderEditCells(form)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!adding && !form && (
        <Button size="sm" variant="outline" onClick={startAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add PLC Data Type</Button>
      )}
    </div>
  );
}

// ── Approvals Section ─────────────────────────────────────────────────────────

function ApprovalsSection() {
  const [confirmProps, confirmAction] = useConfirm();
  const utils = trpc.useUtils();
  const { data: approvals = [], isLoading } = trpc.hardware.approvalList.useQuery();
  const upsert = trpc.hardware.approvalUpsert.useMutation({
    onSuccess: () => {
      utils.hardware.approvalList.invalidate();
      setForm(null);
      setAdding(false);
    },
  });
  const deleteApproval = trpc.hardware.approvalDelete.useMutation({
    onSuccess: () => utils.hardware.approvalList.invalidate(),
  });

  const [form, setForm] = useState<{ code: string; name: string; editId: number | null } | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: ApprovalRow) {
    setAdding(false);
    setForm({ code: row.code, name: row.name, editId: row.id });
  }

  function startAdd() {
    setForm({ code: "", name: "", editId: null });
    setAdding(true);
  }

  function cancel() { setForm(null); setAdding(false); }

  function handleSave() {
    if (!form || !form.code.trim() || !form.name.trim()) return;
    upsert.mutate({ code: form.code.trim(), name: form.name.trim() });
  }

  function renderEditCells(f: NonNullable<typeof form>) {
    const isEdit = f.editId != null;
    return (
      <>
        <td className="px-2 py-1"><Input className={inp} value={f.code} onChange={(e) => setForm({ ...f, code: e.target.value })} disabled={isEdit} placeholder="e.g. IECEx" autoFocus={!isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} placeholder="e.g. IEC Explosive Atmospheres" autoFocus={isEdit} /></td>
        <td className="px-2 py-1"><InlineActions onSave={handleSave} onCancel={cancel} isPending={upsert.isPending} /></td>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium w-28">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {(approvals as ApprovalRow[]).length === 0 && !adding ? (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No approvals found.</td></tr>
              ) : (
                (approvals as ApprovalRow[]).map((a) =>
                  form?.editId === a.id ? (
                    <tr key={a.id} className="border-b bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                      {renderEditCells(form)}
                    </tr>
                  ) : (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono font-medium">{a.code}</td>
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2 flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => confirmAction("Delete this approval?", () => deleteApproval.mutate({ id: a.id }))}>Delete</Button>
                      </td>
                    </tr>
                  )
                )
              )}
              {adding && form && (
                <tr className="border-t bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                  {renderEditCells(form)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!adding && !form && (
        <Button size="sm" variant="outline" onClick={startAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Approval</Button>
      )}
      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}

// ── Module Type Codes Section ─────────────────────────────────────────────────

type ModuleTypeCodeRow = { id: number; cardType: string; code: string; groupName: string; description: string | null };

const CARD_TYPE_OPTIONS = ["DI", "DO", "AI", "AO", "MIXED", "COUNTER", "PWM", "SERIAL", "IO_LINK", "SUPPLY", "RELAY"] as const;

function ModuleTypeCodesSection() {
  const [confirmProps, confirmAction] = useConfirm();
  const utils = trpc.useUtils();
  const { data: codes = [], isLoading } = trpc.hardware.moduleTypeCodeList.useQuery();
  const upsert = trpc.hardware.moduleTypeCodeUpsert.useMutation({
    onSuccess: () => {
      utils.hardware.moduleTypeCodeList.invalidate();
      setForm(null);
      setAdding(false);
    },
  });
  const deleteMut = trpc.hardware.moduleTypeCodeDelete.useMutation({
    onSuccess: () => utils.hardware.moduleTypeCodeList.invalidate(),
  });

  const [form, setForm] = useState<{ cardType: string; code: string; groupName: string; description: string; editId: number | null } | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(row: ModuleTypeCodeRow) {
    setAdding(false);
    setForm({ cardType: row.cardType, code: row.code, groupName: row.groupName, description: row.description ?? "", editId: row.id });
  }

  function startAdd() {
    setForm({ cardType: "DI", code: "", groupName: "", description: "", editId: null });
    setAdding(true);
  }

  function cancel() { setForm(null); setAdding(false); }

  function handleSave() {
    if (!form || !form.code.trim() || !form.groupName.trim()) return;
    if (form.code.trim().length !== 1) return;
    upsert.mutate({
      id: form.editId ?? undefined,
      cardType: form.cardType as CardType,
      code: form.code.trim().toUpperCase(),
      groupName: form.groupName.trim(),
      description: form.description.trim() || null,
    });
  }

  function renderEditCells(f: NonNullable<typeof form>) {
    const isEdit = f.editId != null;
    return (
      <>
        <td className="px-2 py-1">
          <Select value={f.cardType} onValueChange={(v) => setForm({ ...f, cardType: v })} disabled={isEdit}>
            <SelectTrigger className="h-7 w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{CARD_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        <td className="px-2 py-1"><Input className={cn(inp, "font-mono font-bold text-center")} value={f.code} onChange={(e) => setForm({ ...f, code: e.target.value.slice(0, 1).toUpperCase() })} maxLength={1} disabled={isEdit} placeholder="A" autoFocus={!isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.groupName} onChange={(e) => setForm({ ...f, groupName: e.target.value })} placeholder="e.g. DI Card" autoFocus={isEdit} /></td>
        <td className="px-2 py-1"><Input className={inp} value={f.description} onChange={(e) => setForm({ ...f, description: e.target.value })} placeholder="Optional" /></td>
        <td className="px-2 py-1"><InlineActions onSave={handleSave} onCancel={cancel} isPending={upsert.isPending} /></td>
      </>
    );
  }

  // Group by cardType for display
  const grouped = new Map<string, ModuleTypeCodeRow[]>();
  for (const c of codes as ModuleTypeCodeRow[]) {
    const arr = grouped.get(c.cardType);
    if (arr) arr.push(c); else grouped.set(c.cardType, [c]);
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium w-24">Card Type</th>
                <th className="px-3 py-2 font-medium w-16">Code</th>
                <th className="px-3 py-2 font-medium w-40">Group</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {(codes as ModuleTypeCodeRow[]).length === 0 && !adding ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No type codes defined.</td></tr>
              ) : (
                [...grouped.entries()].map(([cardType, rows]) => (
                  rows.map((row, idx) =>
                    form?.editId === row.id ? (
                      <tr key={row.id} className={cn("border-b bg-accent/20", idx === 0 && "border-t-2 border-t-muted")} onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                        {renderEditCells(form)}
                      </tr>
                    ) : (
                      <tr key={row.id} className={cn("border-b last:border-0 hover:bg-muted/20", idx === 0 && "border-t-2 border-t-muted")}>
                        {idx === 0 && (
                          <td className="px-3 py-2 font-mono font-medium" rowSpan={rows.length}>{cardType}</td>
                        )}
                        <td className="px-3 py-2 font-mono font-bold text-center">{row.code}</td>
                        <td className="px-3 py-2">{row.groupName}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{row.description ?? "—"}</td>
                        <td className="px-3 py-2 flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => confirmAction(`Delete code ${row.code} for ${row.cardType}?`, () => deleteMut.mutate({ id: row.id }))}>Del</Button>
                        </td>
                      </tr>
                    )
                  )
                ))
              )}
              {adding && form && (
                <tr className="border-t bg-accent/20" onKeyDown={(e) => handleRowKeyDown(e, handleSave, cancel)}>
                  {renderEditCells(form)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!adding && !form && (
        <Button size="sm" variant="outline" onClick={startAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Type Code</Button>
      )}
      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}

// ── Simple tab bar ────────────────────────────────────────────────────────────

type TabKey = "systems" | "gvls" | "eu" | "inputtypes" | "plcdatatypes" | "approvals" | "typecodes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "systems", label: "Signal Systems" },
  { key: "gvls", label: "GVLs" },
  { key: "eu", label: "Engineering Units" },
  { key: "inputtypes", label: "Analog Input Types" },
  { key: "plcdatatypes", label: "PLC Data Types" },
  { key: "approvals", label: "Approvals" },
  { key: "typecodes", label: "Module Type Codes" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MiscPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("systems");

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — table list */}
      <div className="w-56 shrink-0 border-r bg-muted/20 overflow-y-auto">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Lookup Tables</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Global reference data
          </p>
        </div>
        <nav className="p-2 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                activeTab === tab.key
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right panel — selected table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {activeTab === "systems" && <SignalSystemsSection />}
          {activeTab === "gvls" && <GvlSection />}
          {activeTab === "eu" && <EngineeringUnitsSection />}
          {activeTab === "inputtypes" && <AnalogInputTypesSection />}
          {activeTab === "plcdatatypes" && <PlcDataTypesSection />}
          {activeTab === "approvals" && <ApprovalsSection />}
          {activeTab === "typecodes" && <ModuleTypeCodesSection />}
        </div>
      </div>
    </div>
  );
}
