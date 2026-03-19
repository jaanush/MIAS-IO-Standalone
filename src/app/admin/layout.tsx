"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FolderOpen } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderOpen },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r bg-muted/30">
        {/* Header */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
        </div>

        <Separator />

        {/* Nav links */}
        <nav className="flex flex-1 flex-col gap-1 px-2 py-3">
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

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
