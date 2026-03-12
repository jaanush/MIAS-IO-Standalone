"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { ModuleForm, type ModuleFormValues } from "../_components/ModuleForm";

export default function EditModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.hardware.moduleById.useQuery({ id: Number(id) });
  const { data: approvals = [] } = trpc.hardware.approvalList.useQuery();

  const update = trpc.hardware.moduleUpdate.useMutation({
    onSuccess: () => {
      utils.hardware.moduleList.invalidate();
      utils.hardware.moduleById.invalidate({ id: Number(id) });
    },
  });

  const remove = trpc.hardware.moduleDelete.useMutation({
    onSuccess: () => {
      utils.hardware.moduleList.invalidate();
      router.push("/hardware/modules");
    },
  });

  async function handleSubmit(values: ModuleFormValues) {
    setIsSubmitting(true);
    try {
      await update.mutateAsync({ id: Number(id), ...values });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this module? This cannot be undone.")) return;
    await remove.mutateAsync({ id: Number(id) });
  }

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (!data) {
    return <div className="p-8 text-muted-foreground">Module not found.</div>;
  }

  const defaultValues: Partial<ModuleFormValues> = {
    vendorName: data.vendorName,
    articleNumber: data.articleNumber,
    description: data.description,
    cardType: data.cardType as ModuleFormValues["cardType"],
    maxInputChannels: data.maxInputChannels,
    maxOutputChannels: data.maxOutputChannels,
    bitResolution: data.bitResolution,
    supplyVoltageField: data.supplyVoltageField,
    filterTimeMs: data.filterTimeMs ? Number(data.filterTimeMs) : null,
    galvanicIsolation: data.galvanicIsolation,
    isolationVoltageV: data.isolationVoltageV,
    tempMinC: data.tempMinC,
    tempMaxC: data.tempMaxC,
    maxChannelCurrentMa: data.maxChannelCurrentMa,
    shortCircuitProtected: data.shortCircuitProtected,
    providesNetwork: data.providesNetwork,
    protocols: data.protocols.map((p) => p.protocol) as ModuleFormValues["protocols"],
    ipRating: data.ipRating,
    moduleWidthMm: data.moduleWidthMm,
    signalRange: data.signalRange,
    busCurrentConsumptionMa: data.busCurrentConsumptionMa,
    fieldCurrentConsumptionMa: data.fieldCurrentConsumptionMa,
    approvalIds: data.approvals.map((a) => a.approvalId),
    conversionTimeMs: data.conversionTimeMs ? Number(data.conversionTimeMs) : null,
    notes: data.notes,
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{data.articleNumber}</h1>
        <p className="text-sm text-muted-foreground">{data.vendorName}</p>
      </div>
      <ModuleForm
        defaultValues={defaultValues}
        approvals={approvals}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isSubmitting={isSubmitting}
        lifecycleStatus={data.lifecycleStatus}
        successorArticle={data.successorArticle}
        manualUrl={data.manualUrl}
      />
    </div>
  );
}
