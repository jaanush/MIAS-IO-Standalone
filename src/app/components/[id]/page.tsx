"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { ComponentDetail } from "../_components/ComponentDetail";

export default function ComponentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();

  return (
    <ComponentDetail
      key={Number(id)}
      id={Number(id)}
      onDeleted={() => {
        utils.components.componentList.invalidate();
        router.push("/components");
      }}
      onListRefresh={() => utils.components.componentList.invalidate()}
    />
  );
}
