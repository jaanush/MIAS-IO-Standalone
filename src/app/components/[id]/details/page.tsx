"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { ComponentDetailForm } from "../../_components/ComponentDetailForm";

export default function ComponentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = Number(rawId);
  const router = useRouter();
  const utils = trpc.useUtils();

  return (
    <ComponentDetailForm
      key={id}
      id={id}
      onDeleted={() => {
        utils.components.componentList.invalidate();
        router.push("/components");
      }}
      onListRefresh={() => utils.components.componentList.invalidate()}
    />
  );
}
