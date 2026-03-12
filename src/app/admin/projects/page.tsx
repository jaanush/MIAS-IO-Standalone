"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ProjectStatus, MemberRole } from "@prisma/client";
import { PROJECT_STATUS } from "@/lib/enums";

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
import { Badge } from "@/components/ui/badge";
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
import { MoreHorizontal, UserPlus, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Schemas ─────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  client: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  status: z.enum(PROJECT_STATUS).default("ACTIVE"),
});

const editSchema = createSchema.omit({ status: true }).extend({
  status: z.enum(PROJECT_STATUS),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

// ── Badge helpers ────────────────────────────────────────────────────────────

const statusStyles: Record<ProjectStatus, string> = {
  ACTIVE:    "bg-green-100 text-green-800 border-green-200",
  ON_HOLD:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  COMPLETED: "bg-blue-100 text-blue-800 border-blue-200",
  ARCHIVED:  "bg-gray-100 text-gray-600 border-gray-200",
};
const statusLabels: Record<ProjectStatus, string> = {
  ACTIVE: "Active", ON_HOLD: "On Hold", COMPLETED: "Completed", ARCHIVED: "Archived",
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={cn(statusStyles[status])}>{statusLabels[status]}</Badge>;
}

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

// ── Types ────────────────────────────────────────────────────────────────────

type ProjectWithMembers = {
  id: number;
  name: string;
  client: string | null;
  location: string | null;
  status: ProjectStatus;
  createdAt: Date | string;
  members: Array<{
    role: MemberRole;
    user: { id: string; email: string; name: string | null };
  }>;
};

const columnHelper = createColumnHelper<ProjectWithMembers>();

// ── Page ────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const utils = trpc.useUtils();
  const { data: projects, isLoading, error } = trpc.project.list.useQuery();
  const { data: users } = trpc.user.list.useQuery();

  const createMutation = trpc.project.create.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const updateMutation = trpc.project.update.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const addMemberMutation = trpc.project.addMember.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const removeMemberMutation = trpc.project.removeMember.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithMembers | null>(null);
  const [membersProject, setMembersProject] = useState<ProjectWithMembers | null>(null);

  // Add member form state
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<MemberRole>("MEMBER");

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // ── Create form ──────────────────────────────────────────────────────────

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", client: "", location: "", status: "ACTIVE" },
  });

  function openCreate() {
    createForm.reset({ name: "", client: "", location: "", status: "ACTIVE" });
    setCreateOpen(true);
  }

  async function handleCreate(values: CreateFormValues) {
    await createMutation.mutateAsync({
      name: values.name.trim(),
      status: values.status,
      ...(values.client?.trim() ? { client: values.client.trim() } : {}),
      ...(values.location?.trim() ? { location: values.location.trim() } : {}),
    });
    setCreateOpen(false);
  }

  // ── Edit form ────────────────────────────────────────────────────────────

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", client: "", location: "", status: "ACTIVE" },
  });

  function openEdit(project: ProjectWithMembers) {
    setEditingProject(project);
    editForm.reset({
      name: project.name,
      client: project.client ?? "",
      location: project.location ?? "",
      status: project.status,
    });
    setEditOpen(true);
  }

  async function handleEdit(values: EditFormValues) {
    if (!editingProject) return;
    await updateMutation.mutateAsync({
      id: editingProject.id,
      name: values.name.trim(),
      status: values.status,
      ...(values.client?.trim() ? { client: values.client.trim() } : {}),
      ...(values.location?.trim() ? { location: values.location.trim() } : {}),
    });
    setEditOpen(false);
  }

  // ── Members dialog ───────────────────────────────────────────────────────

  function openMembers(project: ProjectWithMembers) {
    setMembersProject(project);
    setAddUserId("");
    setAddRole("MEMBER");
    setMembersOpen(true);
  }

  async function handleAddMember() {
    if (!membersProject || !addUserId) return;
    await addMemberMutation.mutateAsync({
      projectId: membersProject.id,
      userId: addUserId,
      role: addRole,
    });
    // Refresh local state from query
    const refreshed = projects?.find((p) => p.id === membersProject.id);
    if (refreshed) setMembersProject(refreshed);
    setAddUserId("");
  }

  async function handleRemoveMember(userId: string) {
    if (!membersProject) return;
    await removeMemberMutation.mutateAsync({
      projectId: membersProject.id,
      userId,
    });
  }

  function handleDelete(id: number, name: string) {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id });
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        size: 200,
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("client", {
        header: "Client",
        size: 160,
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("location", {
        header: "Location",
        size: 160,
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        size: 100,
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.display({
        id: "members",
        header: "Members",
        size: 90,
        enableSorting: false,
        cell: (info) => {
          const project = info.row.original;
          return (
            <button
              onClick={() => openMembers(project)}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {project.members.length} member{project.members.length !== 1 ? "s" : ""}
            </button>
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "Added",
        size: 120,
        cell: (info) => (
          <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        size: 56,
        enableSorting: false,
        cell: (info) => {
          const project = info.row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(project)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openMembers(project)}>
                  Manage Members
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDelete(project.id, project.name)}
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
    data: (projects as ProjectWithMembers[]) ?? [],
    columns,
    columnResizeMode: "onChange",
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={openCreate}>New Project</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-red-500">{error.message}</p>}

      {!isLoading && !error && projects && (
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
                    No projects yet.
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
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Name <span className="text-destructive">*</span></Label>
              <Input id="create-name" placeholder="Project name" {...createForm.register("name")} />
              {createForm.formState.errors.name && (
                <p className="text-xs text-red-500">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-client">Client</Label>
              <Input id="create-client" placeholder="Client name (optional)" {...createForm.register("client")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-location">Location</Label>
              <Input id="create-location" placeholder="Location (optional)" {...createForm.register("location")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-status">Status</Label>
              <Select
                defaultValue={createForm.getValues("status")}
                onValueChange={(val) => createForm.setValue("status", val as ProjectStatus)}
              >
                <SelectTrigger id="create-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createMutation.error && (
              <p className="text-sm text-red-500">{createMutation.error.message}</p>
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
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
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name <span className="text-destructive">*</span></Label>
              <Input id="edit-name" placeholder="Project name" {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-red-500">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-client">Client</Label>
              <Input id="edit-client" placeholder="Client name (optional)" {...editForm.register("client")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-location">Location</Label>
              <Input id="edit-location" placeholder="Location (optional)" {...editForm.register("location")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.watch("status")}
                onValueChange={(val) => editForm.setValue("status", val as ProjectStatus)}
              >
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {updateMutation.error && (
              <p className="text-sm text-red-500">{updateMutation.error.message}</p>
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Members — {membersProject?.name}</DialogTitle>
          </DialogHeader>

          {/* Current members */}
          <div className="space-y-2">
            {membersProject && projects
              ?.find((p) => p.id === membersProject.id)
              ?.members.map((m) => (
                <div
                  key={m.user.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{m.user.name ?? m.user.email}</span>
                    <span className="ml-2 text-muted-foreground text-xs">{m.role}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.user.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove member"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            {membersProject &&
              (projects?.find((p) => p.id === membersProject.id)?.members.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              )}
          </div>

          {/* Add member */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Add member</p>
            <div className="flex gap-2">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    ?.filter(
                      (u) =>
                        !projects
                          ?.find((p) => p.id === membersProject?.id)
                          ?.members.some((m) => m.user.id === u.id)
                    )
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="icon"
                onClick={handleAddMember}
                disabled={!addUserId || addMemberMutation.isPending}
                title="Add member"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
