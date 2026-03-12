"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { USER_ROLES } from "@/lib/enums";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnSizingState,
} from "@tanstack/react-table";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, roleVariant } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// ── Schemas ─────────────────────────────────────────────────────────────────

const createSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional().or(z.literal("")),
  role: z.enum(USER_ROLES).default("ENGINEER"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const editSchema = z.object({
  name: z.string().optional().or(z.literal("")),
  role: z.enum(USER_ROLES),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("")),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ChevronUp className="h-3 w-3" />;
  if (sorted === "desc") return <ChevronDown className="h-3 w-3" />;
  return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
}

// ── Row type ─────────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  createdAt: Date | string;
};

const columnHelper = createColumnHelper<UserRow>();

// ── Page ────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const utils = trpc.useUtils();
  const { data: users, isLoading, error } = trpc.user.list.useQuery();

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });
  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });
  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: string;
    name: string | null;
    role: UserRole;
  } | null>(null);

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // ── Create form ──────────────────────────────────────────────────────────

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", name: "", role: "ENGINEER", password: "" },
  });

  function openCreate() {
    createForm.reset({ email: "", name: "", role: "ENGINEER", password: "" });
    setCreateOpen(true);
  }

  async function handleCreate(values: CreateFormValues) {
    await createMutation.mutateAsync({
      email: values.email,
      role: values.role,
      password: values.password,
      ...(values.name?.trim() ? { name: values.name.trim() } : {}),
    });
    setCreateOpen(false);
  }

  // ── Edit form ────────────────────────────────────────────────────────────

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", role: "ENGINEER", password: "" },
  });

  function openEdit(user: { id: string; name: string | null; role: UserRole }) {
    setEditingUser(user);
    editForm.reset({ name: user.name ?? "", role: user.role, password: "" });
    setEditOpen(true);
  }

  async function handleEdit(values: EditFormValues) {
    if (!editingUser) return;
    await updateMutation.mutateAsync({
      id: editingUser.id,
      role: values.role,
      ...(values.name?.trim() ? { name: values.name.trim() } : {}),
      ...(values.password?.trim() ? { password: values.password.trim() } : {}),
    });
    setEditOpen(false);
  }

  function handleDelete(id: string, label: string) {
    if (!window.confirm(`Delete user "${label}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id });
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.name ?? row.email, {
        id: "name",
        header: "Name",
        size: 200,
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("email", {
        header: "Email",
        size: 250,
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("role", {
        header: "Role",
        size: 100,
        cell: (info) => <Badge variant={roleVariant(info.getValue())}>{info.getValue()}</Badge>,
      }),
      columnHelper.accessor("createdAt", {
        header: "Added",
        size: 120,
        cell: (info) => <span className="text-muted-foreground">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: "actions",
        size: 56,
        enableSorting: false,
        cell: (info) => {
          const user = info.row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(user)}>Edit</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDelete(user.id, user.name ?? user.email)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: (users as UserRow[]) ?? [],
    columns,
    columnResizeMode: "onChange",
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button onClick={openCreate}>New User</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-red-500">{error.message}</p>}

      {!isLoading && !error && users && (
        <div className="overflow-x-auto">
          <Table
            className="table-fixed"
            style={{ width: table.getCenterTotalSize(), minWidth: "100%" }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize(), position: "relative" }}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon sorted={header.column.getIsSorted()} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-border ${
                          header.column.getIsResizing() ? "bg-primary/50" : ""
                        }`}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Email <span className="text-destructive">*</span></Label>
              <Input id="create-email" type="email" placeholder="user@example.com" {...createForm.register("email")} />
              {createForm.formState.errors.email && (
                <p className="text-xs text-red-500">{createForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-name">Name</Label>
              <Input id="create-name" placeholder="Full name (optional)" {...createForm.register("name")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-password">Password <span className="text-destructive">*</span></Label>
              <Input id="create-password" type="password" placeholder="Min. 8 characters" {...createForm.register("password")} />
              {createForm.formState.errors.password && (
                <p className="text-xs text-red-500">{createForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-role">Role</Label>
              <Select
                defaultValue={createForm.getValues("role")}
                onValueChange={(val) => createForm.setValue("role", val as UserRole)}
              >
                <SelectTrigger id="create-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="ENGINEER">Engineer</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createMutation.error && (
              <p className="text-sm text-red-500">{createMutation.error.message}</p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" placeholder="Full name (optional)" {...editForm.register("name")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.watch("role")}
                onValueChange={(val) => editForm.setValue("role", val as UserRole)}
              >
                <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="ENGINEER">Engineer</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-password">New Password</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Leave blank to keep current password"
                {...editForm.register("password")}
              />
              {editForm.formState.errors.password && (
                <p className="text-xs text-red-500">{editForm.formState.errors.password.message}</p>
              )}
            </div>

            {updateMutation.error && (
              <p className="text-sm text-red-500">{updateMutation.error.message}</p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
