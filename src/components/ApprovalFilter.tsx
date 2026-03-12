"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Approval {
  id: number;
  code: string;
  name: string;
}

interface ApprovalFilterProps {
  approvals: Approval[];
  selected: Set<number>;
  onChange: (selected: Set<number>) => void;
}

export function ApprovalFilter({ approvals, selected, onChange }: ApprovalFilterProps) {
  const [open, setOpen] = useState(false);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  if (approvals.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        Approvals
        {selected.size > 0 && (
          <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
            {selected.size}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-1">
          {approvals.map((a) => {
            const active = selected.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                title={a.name}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[11px] font-mono transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
                )}
              >
                {a.code}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
