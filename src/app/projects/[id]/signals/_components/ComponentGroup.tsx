"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Unlink, RotateCcw, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type NetworkOption = { id: number; protocol: string; description: string | null };

type ComponentGroupProps = {
  instanceId: number | null;
  instanceName: string;
  componentId: number | null;
  componentName: string | null;
  canIdOffset: number | null;
  minCanIdOffset: number | null;
  functionBlock: string | null;
  functionBlockOverride: string | null;
  busProtocol: string | null;
  busId: number | null;
  networkLabel: string | null;
  networks: NetworkOption[];
  anyDirty: boolean;
  signalCount: number;
  colCount: number;
  groupSelected: boolean;
  groupIndeterminate: boolean;
  onSelectGroup: (selected: boolean) => void;
  renderRows: () => React.ReactNode;
  onRename: (newName: string) => void;
  onUpdateOffset: (offset: number | null) => void;
  onUpdateFbOverride: (fb: string | null) => void;
  onUpdateNetwork: (busId: number | null) => void;
  onRevert: () => void;
  onDisconnect: () => void;
  isRenamePending: boolean;
  isRevertPending: boolean;
  isDisconnectPending: boolean;
  isNetworkUpdatePending: boolean;
  defaultCollapsed?: boolean;
};

export function ComponentGroup({
  instanceId,
  instanceName,
  componentId,
  componentName,
  canIdOffset,
  minCanIdOffset,
  functionBlock,
  functionBlockOverride,
  busProtocol,
  busId,
  networkLabel,
  networks,
  anyDirty,
  signalCount,
  colCount,
  groupSelected,
  groupIndeterminate,
  onSelectGroup,
  renderRows,
  onRename,
  onUpdateOffset,
  onUpdateFbOverride,
  onUpdateNetwork,
  onRevert,
  onDisconnect,
  isRenamePending,
  isRevertPending,
  isDisconnectPending,
  isNetworkUpdatePending,
  defaultCollapsed = false,
}: ComponentGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(instanceName);
  const [editingOffset, setEditingOffset] = useState(false);
  const [offsetInput, setOffsetInput] = useState(canIdOffset != null ? String(canIdOffset) : "");
  const [editingFb, setEditingFb] = useState(false);
  const effectiveFb = functionBlockOverride ?? functionBlock;
  const [fbInput, setFbInput] = useState(effectiveFb ?? "");
  const fbIsDirty = functionBlockOverride != null && functionBlockOverride !== functionBlock;

  // Sync nameInput when instanceName prop changes (after rename)
  const prevNameRef = useRef(instanceName);
  if (prevNameRef.current !== instanceName) {
    prevNameRef.current = instanceName;
    if (!editingName) setNameInput(instanceName);
  }

  // Sync offsetInput when canIdOffset prop changes (after save)
  const prevOffsetRef = useRef(canIdOffset);
  if (prevOffsetRef.current !== canIdOffset) {
    prevOffsetRef.current = canIdOffset;
    if (!editingOffset) setOffsetInput(canIdOffset != null ? String(canIdOffset) : "");
  }

  // Sync fbInput when FB props change (after save)
  const prevFbRef = useRef(effectiveFb);
  if (prevFbRef.current !== effectiveFb) {
    prevFbRef.current = effectiveFb;
    if (!editingFb) setFbInput(effectiveFb ?? "");
  }

  function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== instanceName) {
      onRename(trimmed);
    } else {
      setNameInput(instanceName);
    }
    setEditingName(false);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    else if (e.key === "Escape") { setNameInput(instanceName); setEditingName(false); }
  }

  function commitOffset() {
    const trimmed = offsetInput.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
    if (trimmed !== "" && isNaN(parsed!)) {
      setOffsetInput(canIdOffset != null ? String(canIdOffset) : "");
    } else if (parsed !== canIdOffset) {
      onUpdateOffset(parsed);
    }
    setEditingOffset(false);
  }

  function handleOffsetKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commitOffset(); }
    else if (e.key === "Escape") {
      setOffsetInput(canIdOffset != null ? String(canIdOffset) : "");
      setEditingOffset(false);
    }
  }

  function commitFb() {
    const trimmed = fbInput.trim();
    const newVal = trimmed === "" ? null : trimmed;
    // Only save override if it differs from the component default
    if (newVal !== effectiveFb) {
      onUpdateFbOverride(newVal !== functionBlock ? newVal : null);
    }
    setEditingFb(false);
  }

  function handleFbKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commitFb(); }
    else if (e.key === "Escape") { setFbInput(effectiveFb ?? ""); setEditingFb(false); }
  }

  return (
    <>
      <tbody>
        <tr className="bg-muted/50 border-y border-border">
          <td colSpan={colCount} className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              {/* Group select checkbox */}
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-input cursor-pointer shrink-0"
                checked={groupSelected}
                ref={(el) => { if (el) el.indeterminate = groupIndeterminate; }}
                onChange={(e) => onSelectGroup(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                title={groupSelected ? "Deselect all in group" : "Select all in group"}
              />
              {/* Collapse toggle */}
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                {collapsed
                  ? <ChevronRight className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {/* Instance name — editable only for real instances */}
              {instanceId !== null ? (
                editingName ? (
                  <input
                    autoFocus
                    className="text-sm font-medium bg-background border border-input rounded px-1.5 py-0 h-6 focus:outline-hidden focus:ring-1 focus:ring-ring w-48"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleNameKeyDown}
                    disabled={isRenamePending}
                  />
                ) : (
                  <span
                    className="text-sm font-medium cursor-text hover:underline decoration-dotted"
                    onClick={() => setEditingName(true)}
                  >
                    {instanceName}
                  </span>
                )
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  {instanceName}
                </span>
              )}

              {/* Component type badge — links to component page */}
              {componentName && componentId != null ? (
                <Link
                  href={`/components/${componentId}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  title={`Open component: ${componentName}`}
                >
                  {componentName}
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              ) : componentName ? (
                <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                  {componentName}
                </span>
              ) : null}

              {/* CAN ID offset — editable for real instances */}
              {instanceId !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                  <span className="shrink-0">CAN offset:</span>
                  {editingOffset ? (
                    <input
                      autoFocus
                      type="number"
                      className="bg-background border border-input rounded px-1.5 py-0 h-5 w-16 text-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                      value={offsetInput}
                      onChange={(e) => setOffsetInput(e.target.value)}
                      onBlur={commitOffset}
                      onKeyDown={handleOffsetKeyDown}
                      disabled={isRenamePending}
                      placeholder="0"
                    />
                  ) : (
                    <span
                      className={cn(
                        "cursor-text hover:underline decoration-dotted min-w-6 text-center",
                        // Amber when offset is not a clean multiple of minCanIdOffset
                        canIdOffset != null && minCanIdOffset != null && minCanIdOffset > 0 && canIdOffset % minCanIdOffset !== 0
                          && "text-amber-600 dark:text-amber-400"
                      )}
                      onClick={() => setEditingOffset(true)}
                      title={
                        minCanIdOffset != null && minCanIdOffset > 0
                          ? `Min offset step: ${minCanIdOffset}. Click to edit.`
                          : "Click to edit CAN ID offset for this instance"
                      }
                    >
                      {canIdOffset != null ? (canIdOffset >= 0 ? `+${canIdOffset}` : String(canIdOffset)) : "—"}
                    </span>
                  )}
                  {minCanIdOffset != null && minCanIdOffset > 0 && (
                    <span className="text-[10px] text-muted-foreground/60" title="Minimum safe offset between instances">
                      (step {minCanIdOffset})
                    </span>
                  )}
                </span>
              )}

              {/* Function block — editable for real instances */}
              {instanceId !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                  <span className="shrink-0">FB:</span>
                  {editingFb ? (
                    <input
                      autoFocus
                      className="bg-background border border-input rounded px-1.5 py-0 h-5 w-36 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-ring"
                      value={fbInput}
                      onChange={(e) => setFbInput(e.target.value)}
                      onBlur={commitFb}
                      onKeyDown={handleFbKeyDown}
                      disabled={isRenamePending}
                      placeholder={functionBlock ?? "FB_..."}
                    />
                  ) : (
                    <span
                      className={cn(
                        "cursor-text hover:underline decoration-dotted min-w-8 font-mono",
                        fbIsDirty && "text-amber-600 dark:text-amber-400"
                      )}
                      onClick={() => setEditingFb(true)}
                      title={fbIsDirty ? `Overridden (template: ${functionBlock ?? "none"})` : "Click to override function block name"}
                    >
                      {effectiveFb ?? "—"}
                    </span>
                  )}
                </span>
              )}

              {/* Network dropdown — only for real instances with busProtocol set */}
              {instanceId !== null && busProtocol && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                  <span className="shrink-0">Net:</span>
                  {isNetworkUpdatePending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <select
                      className="bg-background border border-input rounded px-1 py-0 h-5 text-xs focus:outline-hidden focus:ring-1 focus:ring-ring max-w-48"
                      value={busId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateNetwork(val === "" ? null : Number(val));
                      }}
                    >
                      <option value="">None</option>
                      {networks.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.protocol} — {n.description ?? n.protocol}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              )}

              {/* Revert to template — only for real instances with dirty signals */}
              {instanceId !== null && anyDirty && (
                <button
                  type="button"
                  title="Revert all signals to component template defaults"
                  disabled={isRevertPending}
                  onClick={onRevert}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 ml-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Revert
                </button>
              )}

              {/* Disconnect button — only for real instances, next to toolbar */}
              {instanceId !== null && (
                <button
                  type="button"
                  title="Disconnect from component template"
                  disabled={isDisconnectPending}
                  onClick={() => {
                    if (confirm(
                      `Disconnect "${instanceName}" from its component template?\n\n` +
                      `This will remove the link between ${signalCount} signal${signalCount !== 1 ? "s" : ""} and the "${componentName}" template. ` +
                      `Signal values will be preserved but will no longer receive template updates or support revert.`
                    )) {
                      onDisconnect();
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50 ml-1"
                >
                  <Unlink className="h-3 w-3" />
                  Disconnect
                </button>
              )}

              {/* Signal count — pushed to far right */}
              <span className="ml-auto text-xs text-muted-foreground">
                {signalCount} signal{signalCount !== 1 ? "s" : ""}
              </span>
            </div>
          </td>
        </tr>
      </tbody>

      {!collapsed && (
        <tbody>
          {renderRows()}
        </tbody>
      )}
    </>
  );
}
