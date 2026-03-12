"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Server, Cpu, Radio } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/hardware/modules", label: "Modules", icon: Cpu },
  { href: "/hardware/plcs", label: "PLCs", icon: Server },
  { href: "/hardware/couplers", label: "Couplers", icon: Radio },
];

export default function HardwareLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="flex w-48 flex-col border-r bg-muted/30 shrink-0">
        <div className="px-4 py-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Hardware
          </p>
        </div>
        <Separator />
        <nav className="flex flex-col gap-1 px-2 py-3">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
