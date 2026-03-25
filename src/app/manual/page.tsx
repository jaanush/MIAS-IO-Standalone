"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useQueryState, parseAsString } from "nuqs";

// ── Manual content sections ──────────────────────────────────────────────────

import { OverviewSection } from "./content/overview";
import { ProjectsSection } from "./content/projects";
import { HardwareSection } from "./content/hardware";
import { SignalsSection } from "./content/signals";
import { ComponentsSection } from "./content/components";
import { NetworksSection } from "./content/networks";
import { ImportExportSection } from "./content/import-export";
import { CodesysSection } from "./content/codesys";

type ManualPage = {
  id: string;
  label: string;
  section?: string;
  component: React.ComponentType;
};

const pages: ManualPage[] = [
  { id: "overview", label: "Overview", section: "Getting Started", component: OverviewSection },
  { id: "projects", label: "Projects", section: "Getting Started", component: ProjectsSection },
  { id: "hardware", label: "Hardware Setup", section: "Core Concepts", component: HardwareSection },
  { id: "signals", label: "Signals", section: "Core Concepts", component: SignalsSection },
  { id: "components", label: "Components & Templates", section: "Core Concepts", component: ComponentsSection },
  { id: "networks", label: "Networks & Buses", section: "Core Concepts", component: NetworksSection },
  { id: "import-export", label: "Import & Export", section: "Workflows", component: ImportExportSection },
  { id: "codesys", label: "CODESYS Integration", section: "Workflows", component: CodesysSection },
];

// Group pages by section
const sections = pages.reduce<{ section: string; items: ManualPage[] }[]>((acc, page) => {
  const section = page.section ?? "Other";
  const existing = acc.find((s) => s.section === section);
  if (existing) existing.items.push(page);
  else acc.push({ section, items: [page] });
  return acc;
}, []);

export default function ManualPage() {
  const [activeId, setActiveId] = useQueryState("page", parseAsString.withDefault("overview"));
  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];
  const ActiveComponent = activePage.component;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar — page links */}
      <nav className="w-56 border-r flex flex-col shrink-0 overflow-y-auto bg-muted/20">
        <div className="px-4 pt-5 pb-3">
          <h2 className="text-sm font-semibold tracking-tight">MIAS-IO Manual</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
        </div>

        <div className="flex-1 px-2 pb-4 space-y-4">
          {sections.map(({ section, items }) => (
            <div key={section}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                {section}
              </p>
              {items.map((page) => (
                <button
                  key={page.id}
                  onClick={() => setActiveId(page.id)}
                  className={cn(
                    "w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-left transition-colors",
                    activeId === page.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <ChevronRight className={cn(
                    "h-3 w-3 shrink-0 transition-transform",
                    activeId === page.id && "rotate-90"
                  )} />
                  {page.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Right pane — content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
