"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/trpc/client";
import { Layers, Cpu, Radio, Puzzle, Network, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "details", label: "Details", icon: Layers },
  { href: "hardware", label: "Hardware", icon: Cpu },
  { href: "signals", label: "Signals", icon: Radio },
  { href: "components", label: "Components", icon: Puzzle },
  { href: "monitoring", label: "Monitoring", icon: Activity },
  { href: "remote", label: "Remote", icon: Network },
];

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const { data: project } = trpc.project.byId.useQuery({ id: Number(id) });

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 border-r flex flex-col shrink-0">
        <div className="px-4 pt-5 pb-3 border-b">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium truncate">
            Project
          </p>
          <h2 className="font-semibold truncate">{project?.name ?? `#${id}`}</h2>
          {project?.client && (
            <p className="text-xs text-muted-foreground truncate">{project.client}</p>
          )}
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const full = `/projects/${id}/${href}`;
            const active = pathname === full || pathname.startsWith(full + "/");
            return (
              <Link
                key={href}
                href={full}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
