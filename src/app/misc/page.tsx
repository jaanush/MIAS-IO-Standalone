"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

type SystemRow = { id: number; code: string; name: string; description: string | null };
type GvlRow = { id: number; name: string; description: string | null };
type AnalogInputTypeRow = { id: number; code: string; name: string; sortOrder: number };
type PlcDataTypeRow = { id: number; code: string; name: string; sortOrder: number };
type EngineeringUnitRow = { id: number; symbol: string; description: string | null; plcDataTypeId: number | null; plcDataTypeCatalog: PlcDataTypeRow | null };
type ApprovalRow = { id: number; code: string; name: string };

// ── Engineering Units Section ─────────────────────────────────────────────────

function EngineeringUnitsSection() {
  const utils = trpc.useUtils();
  const { data: units = [], isLoading } = trpc.signal.engineeringUnits.useQuery();
  const { data: plcDataTypes = [] } = trpc.signal.plcDataTypeList.useQuery();
  const upsert = trpc.signal.engineeringUnitUpsert.useMutation({
    onSuccess: () => {
      utils.signal.engineeringUnits.invalidate();
      setForm({ symbol: "", description: "", plcDataTypeId: null });
      setEditing(null);
    },
  });

  const [editing, setEditing] = useState<EngineeringUnitRow | null>(null);
  const [form, setForm] = useState({ symbol: "", description: "", plcDataTypeId: null as number | null });
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(row: EngineeringUnitRow) {
    setEditing(row);
    setForm({ symbol: row.symbol, description: row.description ?? "", plcDataTypeId: row.plcDataTypeId });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ symbol: "", description: "", plcDataTypeId: null });
    setFormError(null);
  }

  function handleSave() {
    if (!form.symbol.trim()) {
      setFormError("Symbol is required.");
      return;
    }
    setFormError(null);
    upsert.mutate({
      symbol: form.symbol.trim(),
      description: form.description.trim() || null,
      plcDataTypeId: form.plcDataTypeId,
    });
  }

  return (
    <div className="space-y-4">
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
                <th className="px-3 py-2 font-medium w-16" />
              </tr>
            </thead>
            <tbody>
              {(units as EngineeringUnitRow[]).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                    No engineering units found.
                  </td>
                </tr>
              ) : (
                (units as EngineeringUnitRow[]).map((eu) => (
                  <tr key={eu.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{eu.symbol}</td>
                    <td className="px-3 py-2 text-muted-foreground">{eu.description ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{eu.plcDataTypeCatalog?.code ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(eu)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit form */}
      <div className="rounded-md border p-4 space-y-3 bg-muted/20">
        <h4 className="text-sm font-medium">{editing ? "Edit Engineering Unit" : "Add Engineering Unit"}</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Symbol *</label>
            <Input
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              placeholder="e.g. bar"
              disabled={!!editing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">PLC Data Type</label>
            <Select
              value={form.plcDataTypeId != null ? String(form.plcDataTypeId) : "__none__"}
              onValueChange={(v) => setForm((f) => ({ ...f, plcDataTypeId: v === "__none__" ? null : Number(v) }))}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {(plcDataTypes as PlcDataTypeRow[]).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.code} — {t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : editing ? "Save Changes" : "Add"}
          </Button>
          {editing && (
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>
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
      setForm({ code: "", name: "", description: "" });
      setEditing(null);
    },
  });

  const [editing, setEditing] = useState<SystemRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(row: SystemRow) {
    setEditing(row);
    setForm({ code: row.code, name: row.name, description: row.description ?? "" });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ code: "", name: "", description: "" });
    setFormError(null);
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError("Code and Name are required.");
      return;
    }
    setFormError(null);
    upsert.mutate({
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
    });
  }

  return (
    <div className="space-y-4">
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
                <th className="px-3 py-2 font-medium w-16" />
              </tr>
            </thead>
            <tbody>
              {(systems as SystemRow[]).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                    No systems found.
                  </td>
                </tr>
              ) : (
                (systems as SystemRow[]).map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{row.code}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.description ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit form */}
      <div className="rounded-md border p-4 space-y-3 bg-muted/20">
        <h4 className="text-sm font-medium">{editing ? "Edit System" : "Add System"}</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Code *</label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. 625"
              disabled={!!editing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Propulsion FWD"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : editing ? "Save Changes" : "Add"}
          </Button>
          {editing && (
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>
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
      setForm({ name: "", description: "" });
      setEditing(null);
    },
  });

  const [editing, setEditing] = useState<GvlRow | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(row: GvlRow) {
    setEditing(row);
    setForm({ name: row.name, description: row.description ?? "" });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setFormError(null);
  }

  function handleSave() {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setFormError(null);
    upsert.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
    });
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-16" />
              </tr>
            </thead>
            <tbody>
              {(gvls as GvlRow[]).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                    No GVLs found.
                  </td>
                </tr>
              ) : (
                (gvls as GvlRow[]).map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.description ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit form */}
      <div className="rounded-md border p-4 space-y-3 bg-muted/20">
        <h4 className="text-sm font-medium">{editing ? "Edit GVL" : "Add GVL"}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. GVL_PROPULSION"
              disabled={!!editing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : editing ? "Save Changes" : "Add"}
          </Button>
          {editing && (
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>
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
      setForm({ code: "", name: "", sortOrder: "0" });
      setEditing(null);
    },
  });

  const [editing, setEditing] = useState<AnalogInputTypeRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", sortOrder: "0" });
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(row: AnalogInputTypeRow) {
    setEditing(row);
    setForm({ code: row.code, name: row.name, sortOrder: String(row.sortOrder) });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ code: "", name: "", sortOrder: "0" });
    setFormError(null);
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) { setFormError("Code and Name are required."); return; }
    setFormError(null);
    upsert.mutate({ code: form.code.trim(), name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 });
  }

  return (
    <div className="space-y-4">
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
                <th className="px-3 py-2 font-medium w-16" />
              </tr>
            </thead>
            <tbody>
              {(types as AnalogInputTypeRow[]).length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No analog input types found.</td></tr>
              ) : (
                (types as AnalogInputTypeRow[]).map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{t.sortOrder}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.code}</td>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => startEdit(t)}>Edit</Button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="rounded-md border p-4 space-y-3 bg-muted/20">
        <h4 className="text-sm font-medium">{editing ? "Edit Analog Input Type" : "Add Analog Input Type"}</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Code *</label>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. 4_20MA" disabled={!!editing} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Name *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 4–20 mA" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Sort Order</label>
            <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : editing ? "Save Changes" : "Add"}</Button>
          {editing && <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>}
        </div>
      </div>
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
      setForm({ code: "", name: "", sortOrder: "0" });
      setEditing(null);
    },
  });

  const [editing, setEditing] = useState<PlcDataTypeRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", sortOrder: "0" });
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(row: PlcDataTypeRow) {
    setEditing(row);
    setForm({ code: row.code, name: row.name, sortOrder: String(row.sortOrder) });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ code: "", name: "", sortOrder: "0" });
    setFormError(null);
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) { setFormError("Code and Name are required."); return; }
    setFormError(null);
    upsert.mutate({ code: form.code.trim(), name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 });
  }

  return (
    <div className="space-y-4">
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
                <th className="px-3 py-2 font-medium w-16" />
              </tr>
            </thead>
            <tbody>
              {(types as PlcDataTypeRow[]).length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No PLC data types found.</td></tr>
              ) : (
                (types as PlcDataTypeRow[]).map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{t.sortOrder}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.code}</td>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => startEdit(t)}>Edit</Button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="rounded-md border p-4 space-y-3 bg-muted/20">
        <h4 className="text-sm font-medium">{editing ? "Edit PLC Data Type" : "Add PLC Data Type"}</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Code *</label>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. BOOL" disabled={!!editing} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Name *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Boolean" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Sort Order</label>
            <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : editing ? "Save Changes" : "Add"}</Button>
          {editing && <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>}
        </div>
      </div>
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
      setForm({ code: "", name: "" });
      setEditing(null);
    },
  });
  const deleteApproval = trpc.hardware.approvalDelete.useMutation({
    onSuccess: () => utils.hardware.approvalList.invalidate(),
  });

  const [editing, setEditing] = useState<ApprovalRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(row: ApprovalRow) {
    setEditing(row);
    setForm({ code: row.code, name: row.name });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ code: "", name: "" });
    setFormError(null);
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) { setFormError("Code and Name are required."); return; }
    setFormError(null);
    upsert.mutate({ code: form.code.trim(), name: form.name.trim() });
  }

  return (
    <div className="space-y-4">
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
              {(approvals as ApprovalRow[]).length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No approvals found.</td></tr>
              ) : (
                (approvals as ApprovalRow[]).map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono font-medium">{a.code}</td>
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => confirmAction("Delete this approval?", () => deleteApproval.mutate({ id: a.id }))}>Delete</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="rounded-md border p-4 space-y-3 bg-muted/20">
        <h4 className="text-sm font-medium">{editing ? "Edit Approval" : "Add Approval"}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Code *</label>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. IECEx" disabled={!!editing} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Name *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. IEC Explosive Atmospheres" />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : editing ? "Save Changes" : "Add"}</Button>
          {editing && <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>}
        </div>
      </div>
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
      setForm({ cardType: "DI", code: "", groupName: "", description: "" });
      setEditing(null);
    },
  });
  const deleteMut = trpc.hardware.moduleTypeCodeDelete.useMutation({
    onSuccess: () => utils.hardware.moduleTypeCodeList.invalidate(),
  });

  const [editing, setEditing] = useState<ModuleTypeCodeRow | null>(null);
  const [form, setForm] = useState({ cardType: "DI" as string, code: "", groupName: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(row: ModuleTypeCodeRow) {
    setEditing(row);
    setForm({ cardType: row.cardType, code: row.code, groupName: row.groupName, description: row.description ?? "" });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ cardType: "DI", code: "", groupName: "", description: "" });
    setFormError(null);
  }

  function handleSave() {
    if (!form.code.trim() || !form.groupName.trim()) { setFormError("Code and Group Name are required."); return; }
    if (form.code.trim().length !== 1) { setFormError("Code must be a single character."); return; }
    setFormError(null);
    upsert.mutate({
      id: editing?.id,
      cardType: form.cardType as any,
      code: form.code.trim().toUpperCase(),
      groupName: form.groupName.trim(),
      description: form.description.trim() || null,
    });
  }

  // Group by cardType for display
  const grouped = new Map<string, ModuleTypeCodeRow[]>();
  for (const c of codes as ModuleTypeCodeRow[]) {
    const arr = grouped.get(c.cardType);
    if (arr) arr.push(c); else grouped.set(c.cardType, [c]);
  }

  return (
    <div className="space-y-4">
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
              {(codes as ModuleTypeCodeRow[]).length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No type codes defined.</td></tr>
              ) : (
                [...grouped.entries()].map(([cardType, rows]) => (
                  rows.map((row, idx) => (
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
                  ))
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border p-4 space-y-3 bg-muted/20">
        <h4 className="text-sm font-medium">{editing ? "Edit Type Code" : "Add Type Code"}</h4>
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Card Type *</label>
            <Select
              value={form.cardType}
              onValueChange={(v) => setForm((f) => ({ ...f, cardType: v }))}
              disabled={!!editing}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Code * (single char)</label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.slice(0, 1).toUpperCase() }))}
              placeholder="e.g. I"
              maxLength={1}
              className="font-mono font-bold text-center"
              disabled={!!editing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Group Name *</label>
            <Input
              value={form.groupName}
              onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
              placeholder="e.g. DI Card"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        {upsert.error && <p className="text-xs text-destructive">{upsert.error.message}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : editing ? "Save Changes" : "Add"}</Button>
          {editing && <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>}
        </div>
      </div>
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
