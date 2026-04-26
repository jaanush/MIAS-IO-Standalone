"use client";

import { use } from "react";
import { trpc } from "@/trpc/client";
import { ParameterDefEditor } from "../_components/ParameterDefEditor";

export default function ComponentParametersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = Number(rawId);

  const { data: defs = [], refetch } = trpc.components.paramDefList.useQuery({ componentId: id });

  return (
    <ParameterDefEditor componentId={id} defs={defs} onRefresh={() => refetch()} />
  );
}
