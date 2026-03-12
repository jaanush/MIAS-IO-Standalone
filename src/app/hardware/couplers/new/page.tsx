"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { DeviceForm, type DeviceFormValues } from "../../plcs/_components/DeviceForm";

export default function NewCouplerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const { data: approvals = [] } = trpc.hardware.approvalList.useQuery();

  const create = trpc.hardware.couplerCatalogCreate.useMutation({
    onSuccess: (data) => {
      utils.hardware.couplerCatalogList.invalidate();
      router.push(`/hardware/couplers/${data.id}`);
    },
  });

  async function handleSubmit(values: DeviceFormValues) {
    setIsSubmitting(true);
    try {
      await create.mutateAsync({ ...values, type: "COUPLER" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Add Coupler</h1>
        <p className="text-sm text-muted-foreground">New fieldbus coupler catalog entry</p>
      </div>
      <DeviceForm
        approvals={approvals}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        showPLCFields={false}
      />
    </div>
  );
}
