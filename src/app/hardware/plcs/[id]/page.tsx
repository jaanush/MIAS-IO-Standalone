"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { DeviceForm, type DeviceFormValues } from "../_components/DeviceForm";

export default function EditPlcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.hardware.plcCatalogById.useQuery({ id: Number(id) });
  const { data: approvals = [] } = trpc.hardware.approvalList.useQuery();

  const update = trpc.hardware.plcCatalogUpdate.useMutation({
    onSuccess: () => {
      utils.hardware.plcCatalogList.invalidate();
      utils.hardware.plcCatalogById.invalidate({ id: Number(id) });
    },
  });

  const remove = trpc.hardware.plcCatalogDelete.useMutation({
    onSuccess: () => {
      utils.hardware.plcCatalogList.invalidate();
      router.push("/hardware/plcs");
    },
  });

  async function handleSubmit(values: DeviceFormValues) {
    setIsSubmitting(true);
    try {
      await update.mutateAsync({ id: Number(id), ...values, type: "PLC" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this PLC? This cannot be undone.")) return;
    await remove.mutateAsync({ id: Number(id) });
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-muted-foreground">PLC not found.</div>;

  const defaultValues: Partial<DeviceFormValues> = {
    vendorName: data.vendorName,
    articleNumber: data.articleNumber,
    description: data.description,
    generation: data.generation,
    programMemoryKb: data.programMemoryKb,
    ramMemoryKb: data.ramMemoryKb,
    dataMemoryKb: data.dataMemoryKb,
    eco: data.eco,
    maxModules: data.maxModules,
    busPowerBudgetMa: data.busPowerBudgetMa,
    supplyVoltageMinV: data.supplyVoltageMinV,
    supplyVoltageMaxV: data.supplyVoltageMaxV,
    internalCurrentMa: data.internalCurrentMa,
    ipRating: data.ipRating,
    tempMinC: data.tempMinC,
    tempMaxC: data.tempMaxC,
    extendedTemp: data.extendedTemp,
    ethernetPorts: data.ethernetPorts,
    dataRateMbit: data.dataRateMbit,
    hasSDCard: data.hasSDCard,
    hasMediaRedundancy: data.hasMediaRedundancy,
    widthMm: data.widthMm,
    heightMm: data.heightMm,
    depthMm: data.depthMm,
    notes: data.notes,
    approvalIds: data.approvals.map((a) => a.approvalId),
    protocols: data.protocols.map((p) => ({
      protocol: p.protocol as NonNullable<DeviceFormValues["protocols"]>[number]["protocol"],
      baudRateMaxKbit: p.baudRateMaxKbit,
      nodeAddressMin: p.nodeAddressMin,
      nodeAddressMax: p.nodeAddressMax,
    })),
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{data.articleNumber}</h1>
        <p className="text-sm text-muted-foreground">{data.vendorName}</p>
      </div>
      <DeviceForm
        defaultValues={defaultValues}
        approvals={approvals}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isSubmitting={isSubmitting}
        showPLCFields={true}
        lifecycleStatus={data.lifecycleStatus}
        successorArticle={data.successorArticle}
        manualUrl={data.manualUrl}
      />
    </div>
  );
}
