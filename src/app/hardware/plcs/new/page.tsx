"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { DeviceForm, type DeviceFormValues } from "../_components/DeviceForm";

export default function NewPlcPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const { data: approvals = [] } = trpc.hardware.approvalList.useQuery();

  const create = trpc.hardware.plcCatalogCreate.useMutation({
    onSuccess: (data) => {
      utils.hardware.plcCatalogList.invalidate();
      router.push(`/hardware/plcs/${data.id}`);
    },
  });

  async function handleSubmit(values: DeviceFormValues) {
    setIsSubmitting(true);
    try {
      await create.mutateAsync({ ...values, type: "PLC" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Add PLC</h1>
        <p className="text-sm text-muted-foreground">New PLC catalog entry</p>
      </div>
      <DeviceForm
        approvals={approvals}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        showPLCFields={true}
      />
    </div>
  );
}
