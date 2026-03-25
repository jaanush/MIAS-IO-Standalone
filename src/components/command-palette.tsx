"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { trpc } from "@/trpc/client";
import { Cpu, FolderOpen, BookOpen, Wrench, Layers, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  const { data: projects = [] } = trpc.project.list.useQuery(undefined, {
    enabled: open,
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects, pages, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Projects">
          {projects.map((p) => (
            <CommandItem key={p.id} onSelect={() => go(`/projects/${p.id}/hardware`)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {p.name}
              {p.projectNumber && <span className="ml-2 text-xs text-muted-foreground">{p.projectNumber}</span>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/")}>
            <FolderOpen className="mr-2 h-4 w-4" /> Projects
          </CommandItem>
          <CommandItem onSelect={() => go("/hardware/plcs")}>
            <Cpu className="mr-2 h-4 w-4" /> PLC Catalog
          </CommandItem>
          <CommandItem onSelect={() => go("/hardware/couplers")}>
            <Cpu className="mr-2 h-4 w-4" /> Coupler Catalog
          </CommandItem>
          <CommandItem onSelect={() => go("/hardware/modules")}>
            <Wrench className="mr-2 h-4 w-4" /> Module Catalog
          </CommandItem>
          <CommandItem onSelect={() => go("/components")}>
            <Layers className="mr-2 h-4 w-4" /> Components
          </CommandItem>
          <CommandItem onSelect={() => go("/misc")}>
            <Settings className="mr-2 h-4 w-4" /> Misc (Units, Systems, GVLs)
          </CommandItem>
          <CommandItem onSelect={() => go("/manual")}>
            <BookOpen className="mr-2 h-4 w-4" /> Manual
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); setOpen(false); }}>
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Toggle {theme === "dark" ? "Light" : "Dark"} Mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
