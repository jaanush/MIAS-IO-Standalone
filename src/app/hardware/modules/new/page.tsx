"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { ModuleForm, type ModuleFormValues } from "../_components/ModuleForm";

export default function NewModulePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const { data: approvals = [] } = trpc.hardware.approvalList.useQuery();

  const create = trpc.hardware.moduleCreate.useMutation({
    onSuccess: (data) => {
      utils.hardware.moduleList.invalidate();
      router.push(`/hardware/modules/${data.id}`);
    },
  });

  async function handleSubmit(values: ModuleFormValues) {
    setIsSubmitting(true);
    try {
      await create.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="mb-6 text-xl font-semibold">New Module</h1>
      <ModuleForm approvals={approvals} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
