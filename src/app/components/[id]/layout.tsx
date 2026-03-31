"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";

export default function ComponentTabLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const { data } = trpc.components.componentMeta.useQuery({ id: Number(id) });

  const isCanopen = data?.busProtocol === "CANOPEN";

  const tabs = [
    { href: "details", label: "Details" },
    { href: "signals", label: "Signals" },
    ...(isCanopen ? [{ href: "pdo", label: "PDO" }] : []),
    { href: "wiring", label: "Wiring" },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      {data && (
        <div className="px-8 pt-6 pb-2">
          <h1 className="text-xl font-semibold">{data.name}</h1>
          {data.manufacturer && (
            <p className="text-sm text-muted-foreground">
              {data.manufacturer}{data.model ? ` · ${data.model}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="px-8 border-b flex gap-1">
        {tabs.map(({ href, label }) => {
          const full = `/components/${id}/${href}`;
          const active = pathname === full || pathname.startsWith(full + "/");
          return (
            <Link
              key={href}
              href={full}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
