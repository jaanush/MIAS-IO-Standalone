"use client";

import { use, useEffect } from "react";
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
import { PROJECT_STATUS } from "@/lib/enums";
import { CodesysTaskPanel } from "./_components/CodesysTaskPanel";
import { CodesysSettingsForm } from "./_components/CodesysSettingsForm";

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
    resolver: zodResolver(schema),
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
    </div>
  );
}
