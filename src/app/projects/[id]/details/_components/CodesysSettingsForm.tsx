"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  fbAlarmDigital: z.string().min(1).max(100),
  fbAlarmAnalogue: z.string().min(1).max(100),
  fbAnalogScaling: z.string().min(1).max(100),
  fbTankLevel: z.string().min(1).max(100),
});
type FormValues = z.infer<typeof schema>;

export function CodesysSettingsForm({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.codesys.settingsGet.useQuery({ projectId });
  const save = trpc.codesys.settingsSave.useMutation({
    onSuccess: () => utils.codesys.settingsGet.invalidate({ projectId }),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fbAlarmDigital: "FB_AlarmDigital",
      fbAlarmAnalogue: "FB_AlarmAnalogue",
      fbAnalogScaling: "FB_AnalogueIn_DeadBand_rev3",
      fbTankLevel: "FB_TankLevel",
    },
  });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          CODESYS Function Block Defaults
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Default FB names used by the code generator. Override per-signal via the signal editor.
        </p>
      </div>

      <form
        onSubmit={handleSubmit((v) => save.mutate({ projectId, ...v }))}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Discrete alarm FB</Label>
            <Input {...register("fbAlarmDigital")} className="font-mono text-sm h-8" />
            {errors.fbAlarmDigital && <p className="text-xs text-destructive">{errors.fbAlarmDigital.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Analog alarm FB</Label>
            <Input {...register("fbAlarmAnalogue")} className="font-mono text-sm h-8" />
            {errors.fbAlarmAnalogue && <p className="text-xs text-destructive">{errors.fbAlarmAnalogue.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Analog scaling FB</Label>
            <Input {...register("fbAnalogScaling")} className="font-mono text-sm h-8" />
            {errors.fbAnalogScaling && <p className="text-xs text-destructive">{errors.fbAnalogScaling.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tank level FB</Label>
            <Input {...register("fbTankLevel")} className="font-mono text-sm h-8" />
            {errors.fbTankLevel && <p className="text-xs text-destructive">{errors.fbTankLevel.message}</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={!isDirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
