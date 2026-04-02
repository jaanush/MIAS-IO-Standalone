"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PlugZap, Activity, ClipboardCheck } from "lucide-react";

const navItems = [
  { href: "connect", label: "Connect", icon: PlugZap },
  { href: "monitor", label: "Monitor", icon: Activity },
  { href: "io-check", label: "IO-Check", icon: ClipboardCheck },
];

export default function ProjectDevToolsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">{children}</div>

      {/* Bottom navigation bar — mobile-first */}
      <nav className="flex items-center justify-around border-t bg-background px-2 py-1 shrink-0">
        {navItems.map(({ href, label, icon: Icon }) => {
          const full = `/devtools/${projectId}/${href}`;
          const active = pathname === full || pathname.startsWith(full + "/");
          return (
            <Link
              key={href}
              href={full}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-xs transition-colors",
                active
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-primary")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
