"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { DeviceForm, type DeviceFormValues } from "../../plcs/_components/DeviceForm";

export default function EditCouplerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.hardware.couplerCatalogById.useQuery({ id: Number(id) });
  const { data: approvals = [] } = trpc.hardware.approvalList.useQuery();

  const update = trpc.hardware.couplerCatalogUpdate.useMutation({
    onSuccess: () => {
      utils.hardware.couplerCatalogList.invalidate();
      utils.hardware.couplerCatalogById.invalidate({ id: Number(id) });
    },
  });

  const remove = trpc.hardware.couplerCatalogDelete.useMutation({
    onSuccess: () => {
      utils.hardware.couplerCatalogList.invalidate();
      router.push("/hardware/couplers");
    },
  });

  async function handleSubmit(values: DeviceFormValues) {
    setIsSubmitting(true);
    try {
      await update.mutateAsync({ id: Number(id), ...values, type: "COUPLER" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this coupler? This cannot be undone.")) return;
    await remove.mutateAsync({ id: Number(id) });
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Coupler not found.</div>;

  const defaultValues: Partial<DeviceFormValues> = {
    vendorName: data.vendorName,
    articleNumber: data.articleNumber,
    description: data.description,
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
      protocol: p.protocol as DeviceFormValues["protocols"][number]["protocol"],
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
        showPLCFields={false}
        lifecycleStatus={data.lifecycleStatus}
        successorArticle={data.successorArticle}
        manualUrl={data.manualUrl}
      />
    </div>
  );
}
