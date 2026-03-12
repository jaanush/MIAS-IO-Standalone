import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LIFECYCLE_CONFIG: Record<string, { label: string; className: string }> = {
  NRND:         { label: "NRND",         className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  LAST_BUY:     { label: "Last Buy",     className: "bg-orange-100 text-orange-800 border-orange-300" },
  DISCONTINUED: { label: "Discontinued", className: "bg-red-100 text-red-800 border-red-300" },
  OBSOLETE:     { label: "Obsolete",     className: "bg-red-200 text-red-900 border-red-400" },
};

export function LifecycleBadge({ status, className }: { status: string; className?: string }) {
  const config = LIFECYCLE_CONFIG[status];
  if (!config) return null; // ACTIVE and UNKNOWN show nothing
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1 py-0 font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}
