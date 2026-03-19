"use client";

import { use, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PROJECT_STATUS } from "@/lib/enums";
import { CodesysTaskPanel } from "./_components/CodesysTaskPanel";
import { CodesysSettingsForm } from "./_components/CodesysSettingsForm";
import { Trash2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Required"),
  projectNumber: z.string().optional().nullable(),
  client: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(PROJECT_STATUS),
});
type FormValues = z.infer<typeof schema>;

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.project.byId.useQuery({ id: projectId });

  const { data: approvalAssignments = [] } = trpc.projectHardware.projectApprovals.useQuery({ projectId });
  const { data: allApprovals = [] } = trpc.hardware.approvalList.useQuery();

  const update = trpc.project.update.useMutation({
    onSuccess: () => utils.project.byId.invalidate({ id: projectId }),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: "", projectNumber: "", client: "", location: "", status: "ACTIVE" },
  });

  useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        projectNumber: project.projectNumber ?? "",
        client: project.client ?? "",
        location: project.location ?? "",
        status: project.status as FormValues["status"],
      });
    }
  }, [project, reset]);

  const addApproval = trpc.projectHardware.approvalAdd.useMutation({
    onSuccess: () => utils.projectHardware.projectApprovals.invalidate(),
  });
  const removeApproval = trpc.projectHardware.approvalRemove.useMutation({
    onSuccess: () => utils.projectHardware.projectApprovals.invalidate(),
  });

  const assignedIds = approvalAssignments.map((a) => a.approvalId);

  function toggleApproval(approvalId: number) {
    if (assignedIds.includes(approvalId)) {
      removeApproval.mutate({ projectId, approvalId });
    } else {
      addApproval.mutate({ projectId, approvalId });
    }
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Project Details</h1>
        <span className="text-sm text-muted-foreground">{project._count.signals} signals</span>
      </div>

      <form
        onSubmit={handleSubmit((values) => update.mutate({
          id: projectId,
          name: values.name,
          projectNumber: values.projectNumber || null,
          client: values.client ?? undefined,
          location: values.location ?? undefined,
          status: values.status,
        }))}
        className="space-y-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Project Number</Label>
            <Input {...register("projectNumber")} placeholder="e.g. 25425-852" />
          </div>
          <div className="space-y-1">
            <Label>Client</Label>
            <Input {...register("client")} />
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <Input {...register("location")} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            {/* WORKAROUND: key forces remount — Radix Select v2.2.6 doesn't update displayed text on controlled value change (github.com/radix-ui/primitives/issues/3381) */}
            <Select
              key={"st-" + watch("status")}
              value={watch("status")}
              onValueChange={(v) => setValue("status", v as FormValues["status"], { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Approvals */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Required Approvals
        </h2>
        <p className="text-xs text-muted-foreground">
          Modules and couplers that do not carry all selected approvals will be hidden
          when assigning hardware to this project.
        </p>
        {allApprovals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approvals defined.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allApprovals.map((approval) => {
              const active = assignedIds.includes(approval.id);
              return (
                <button
                  key={approval.id}
                  type="button"
                  onClick={() => toggleApproval(approval.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  <span className="font-mono">{approval.code}</span>
                  <span className="text-xs opacity-70">{approval.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <CodesysSettingsForm projectId={projectId} />

      <CodesysTaskPanel projectId={projectId} />

      <PurgeSection projectId={projectId} projectName={project?.name} />
    </div>
  );
}

function PurgeSection({ projectId, projectName }: { projectId: number; projectName?: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const utils = trpc.useUtils();

  const purge = trpc.project.purgeData.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.signal.list.invalidate({ projectId });
      utils.projectHardware.getHardware.invalidate({ projectId });
    },
  });

  function handleClose() {
    if (purge.isPending) return;
    setOpen(false);
    setConfirmText("");
    setResult(null);
  }

  const expected = "PURGE";

  return (
    <section className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
      <p className="text-sm text-muted-foreground">
        Permanently delete all signals, hardware, components, and import data for this project.
        The project itself and its settings will be kept.
      </p>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 mr-1.5" />
        Purge All Data
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Purge All Project Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all signals, PLCs, carriers, IO cards,
              component instances, and import data for{" "}
              <span className="font-semibold text-foreground">{projectName ?? `project #${projectId}`}</span>.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium text-green-600">Purge complete:</p>
              <div className="rounded border bg-muted/30 p-3 text-xs space-y-1 font-mono">
                <div>Signals: {result.signals}</div>
                <div>PLCs (+ carriers, cards, networks): {result.plcs}</div>
                <div>Component instances: {result.instances}</div>
                <div>Components: {result.components}</div>
                <div>CODESYS imports: {result.imports}</div>
                <div>Wiring recipes: {result.recipes}</div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Type <span className="font-mono font-bold">{expected}</span> to confirm
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expected}
                  autoFocus
                />
              </div>

              {purge.error && (
                <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {purge.error.message}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose} disabled={purge.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmText !== expected || purge.isPending}
                  onClick={() => purge.mutate({ projectId })}
                >
                  {purge.isPending ? "Purging..." : "Purge All Data"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
