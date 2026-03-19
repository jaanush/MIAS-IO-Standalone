"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChevronDown, User } from "lucide-react";

export type HeaderUser = {
  email: string;
  role: string;
};

const navItems = [
  { label: "Projects", href: "/" },
  { label: "Hardware", href: "/hardware" },
  { label: "Components", href: "/components" },
];

export function AppHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="flex h-14 items-center border-b bg-muted/40 px-4 shrink-0 shadow-xs">
      {/* Left — logo + version */}
      <div className="flex w-48 items-center gap-2">
        <Link href="/">
          <Image
            src="/logo.svg"
            alt="MeTSTech"
            width={120}
            height={21}
            priority
            className="dark:invert"
          />
        </Link>
        <span className="text-[10px] text-muted-foreground/50 tabular-nums">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
      </div>

      {/* Center — nav */}
      <nav className="flex flex-1 items-center justify-center gap-1">
        {navItems.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
        {user.role === "ADMIN" && (
          <Link
            href="/admin"
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            Admin
          </Link>
        )}
      </nav>

      {/* Right — user menu */}
      <div className="flex w-48 items-center justify-end gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="max-w-[120px] truncate text-sm">{user.email}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="text-xs text-muted-foreground">{user.role}</div>
              <div className="truncate text-sm font-medium">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
