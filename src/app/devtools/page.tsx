"use client";

import Link from "next/link";
import { trpc } from "@/trpc/client";
import { Folder } from "lucide-react";

/** DevTools landing — project selector */
export default function DevToolsPage() {
  const { data: projects, isLoading } = trpc.project.list.useQuery();

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-lg font-semibold mb-4">Select Project</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Loading projects...</p>}

      <div className="flex flex-col gap-2">
        {projects?.map((p) => (
          <Link
            key={p.id}
            href={`/devtools/${p.id}/connect`}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{p.name}</p>
              {p.client && (
                <p className="text-xs text-muted-foreground truncate">{p.client}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
