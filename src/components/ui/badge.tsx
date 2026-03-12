import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { UserRole, ProjectStatus } from "@prisma/client";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/**
 * Maps a UserRole enum value to a badge variant string.
 * ADMIN → destructive, ENGINEER → default, VIEWER → secondary
 */
function roleVariant(role: UserRole): VariantProps<typeof badgeVariants>["variant"] {
  switch (role) {
    case "ADMIN":
      return "destructive";
    case "ENGINEER":
      return "default";
    case "VIEWER":
      return "secondary";
    default:
      return "secondary";
  }
}

/**
 * Maps a ProjectStatus enum value to a badge variant and display label.
 * ACTIVE → default/"Active", ON_HOLD → secondary/"On Hold",
 * COMPLETED → outline/"Completed", ARCHIVED → secondary/"Archived"
 */
function statusVariant(status: ProjectStatus): {
  variant: VariantProps<typeof badgeVariants>["variant"];
  label: string;
} {
  switch (status) {
    case "ACTIVE":
      return { variant: "default", label: "Active" };
    case "ON_HOLD":
      return { variant: "secondary", label: "On Hold" };
    case "COMPLETED":
      return { variant: "outline", label: "Completed" };
    case "ARCHIVED":
      return { variant: "secondary", label: "Archived" };
    default:
      return { variant: "secondary", label: String(status) };
  }
}

export { Badge, badgeVariants, roleVariant, statusVariant };
