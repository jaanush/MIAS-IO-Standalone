"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { ComponentCreateForm } from "../_components/ComponentCreateForm";

export default function NewComponentPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  return (
    <ComponentCreateForm
      onCreated={(id) => {
        utils.components.componentList.invalidate();
        router.push(`/components/${id}`);
      }}
      onCancel={() => router.push("/components")}
    />
  );
}
