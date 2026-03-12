"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { ApprovalFilter } from "@/components/ApprovalFilter";

export default function CouplersLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: couplers = [] } = trpc.hardware.couplerCatalogList.useQuery();
  const { data: allApprovals = [] } = trpc.hardware.approvalList.useQuery();
  const [filter, setFilter] = useState("");
  const [selectedApprovals, setSelectedApprovals] = useState<Set<number>>(new Set());

  const idMatch = pathname.match(/^\/hardware\/couplers\/(\d+)/);
  const activeId = idMatch ? Number(idMatch[1]) : null;
  const isCreating = pathname === "/hardware/couplers/new";

  const filtered = useMemo(() => {
    let result = couplers;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter(
        (c) =>
          c.articleNumber.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q) ||
          c.protocols.some((p) => p.protocol.toLowerCase().includes(q))
      );
    }
    if (selectedApprovals.size > 0) {
      result = result.filter((c) => {
        const codes = new Set(c.approvals.map((a) => a.approval.id));
        for (const id of selectedApprovals) {
          if (!codes.has(id)) return false;
        }
        return true;
      });
    }
    return result;
  }, [couplers, filter, selectedApprovals]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const c of filtered) {
      const key =
        c.protocols.length > 0
          ? c.protocols.map((p) => p.protocol).join(" / ")
          : "No Protocol";
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — coupler list */}
      <div className="w-72 border-r flex flex-col shrink-0">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Coupler Catalog</h1>
            <span className="text-xs text-muted-foreground">{filtered.length} couplers</span>
          </div>
          <ApprovalFilter
            approvals={allApprovals}
            selected={selectedApprovals}
            onChange={setSelectedApprovals}
          />
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter couplers…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Accordion type="multiple" defaultValue={Array.from(grouped.keys())} className="px-1 py-1">
            {Array.from(grouped.entries()).map(([protocol, items]) => (
              <AccordionItem key={protocol} value={protocol} className="border-b-0">
                <AccordionTrigger className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline rounded-md bg-muted/60 hover:bg-muted">
                  <span>{protocol} <span className="text-muted-foreground/70 font-normal">{items.length}</span></span>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <div className="space-y-0.5">
                    {items.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => router.push(`/hardware/couplers/${c.id}`)}
                        className={cn(
                          "w-full flex flex-col px-3 py-1.5 rounded text-left hover:bg-accent transition-colors",
                          activeId === c.id && !isCreating && "bg-accent font-medium"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-sm truncate">{c.articleNumber}</span>
                          <LifecycleBadge status={c.lifecycleStatus} />
                        </span>
                        {c.description && (
                          <span className="text-xs text-muted-foreground truncate">{c.description}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4">No couplers match.</p>
          )}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start", isCreating && "bg-accent font-medium")}
            onClick={() => router.push("/hardware/couplers/new")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Coupler
          </Button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
