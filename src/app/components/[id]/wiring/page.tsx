"use client";

import { use } from "react";
import { trpc } from "@/trpc/client";
import { WiringEditor } from "../_components/WiringEditor";

export default function ComponentWiringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = Number(rawId);

  const { data: meta } = trpc.components.componentMeta.useQuery({ id });
  const { data: recipes = [], refetch } = trpc.components.wiringRecipeList.useQuery({ componentId: id });
  const { data: componentData } = trpc.components.componentById.useQuery({ id });

  if (!meta) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <WiringEditor
      componentId={id}
      functionBlock={meta.functionBlock}
      recipes={recipes}
      signals={componentData?.signals ?? []}
      onRefresh={() => refetch()}
    />
  );
}
