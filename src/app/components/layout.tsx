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

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: components = [] } = trpc.components.componentList.useQuery();
  const [filter, setFilter] = useState("");

  const idMatch = pathname.match(/^\/components\/(\d+)/);
  const activeId = idMatch ? Number(idMatch[1]) : null;
  const isCreating = pathname === "/components/new";

  const filtered = useMemo(() => {
    if (!filter) return components;
    const q = filter.toLowerCase();
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.manufacturer ?? "").toLowerCase().includes(q) ||
        (c.model ?? "").toLowerCase().includes(q)
    );
  }, [components, filter]);

  // Build tree: roots (no parent) with children nested
  const { roots, childrenMap } = useMemo(() => {
    const cMap = new Map<number, typeof filtered>();
    const rts: typeof filtered = [];
    for (const c of filtered) {
      if ((c as any).parent?.id) {
        const pid = (c as any).parent.id;
        if (!cMap.has(pid)) cMap.set(pid, []);
        cMap.get(pid)!.push(c);
      } else {
        rts.push(c);
      }
    }
    return { roots: rts, childrenMap: cMap };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const c of roots) {
      const key = c.manufacturer || "Uncategorized";
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    return map;
  }, [roots]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — component list */}
      <div className="w-72 border-r flex flex-col shrink-0">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Component Library</h1>
            <span className="text-xs text-muted-foreground">{filtered.length} components</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter components…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Accordion type="multiple" defaultValue={Array.from(grouped.keys())} className="px-1 py-1">
            {Array.from(grouped.entries()).map(([manufacturer, items]) => (
              <AccordionItem key={manufacturer} value={manufacturer} className="border-b-0">
                <AccordionTrigger className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline rounded-md bg-muted/60 hover:bg-muted">
                  <span>{manufacturer} <span className="text-muted-foreground/70 font-normal">{items.length}</span></span>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <div className="space-y-0.5">
                    {items.map((c) => (
                      <div key={c.id}>
                        <button
                          onClick={() => router.push(`/components/${c.id}`)}
                          className={cn(
                            "w-full flex flex-col px-3 py-1.5 rounded text-left hover:bg-accent transition-colors",
                            activeId === c.id && !isCreating && "bg-accent font-medium"
                          )}
                        >
                          <span className="text-sm truncate">
                            {c.name}
                            {(c as any)._count?.children > 0 && (
                              <span className="ml-1 text-[10px] text-muted-foreground/60">({(c as any)._count.children})</span>
                            )}
                          </span>
                          {c.model && (
                            <span className="text-xs text-muted-foreground truncate">{c.model}</span>
                          )}
                        </button>
                        {/* Render children indented */}
                        {childrenMap.has(c.id) && (
                          <div className="ml-3 border-l border-border/40 pl-2 space-y-0.5 mt-0.5">
                            {childrenMap.get(c.id)!.map((child) => (
                              <button
                                key={child.id}
                                onClick={() => router.push(`/components/${child.id}`)}
                                className={cn(
                                  "w-full flex flex-col px-2 py-1 rounded text-left hover:bg-accent transition-colors",
                                  activeId === child.id && !isCreating && "bg-accent font-medium"
                                )}
                              >
                                <span className="text-sm truncate">{child.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4">No components match.</p>
          )}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start", isCreating && "bg-accent font-medium")}
            onClick={() => router.push("/components/new")}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Component
          </Button>
        </div>
      </div>

      {/* Right panel — detail/create/empty */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
