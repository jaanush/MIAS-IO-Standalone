"use client";

import { use } from "react";
import { trpc } from "@/trpc/client";
import { PdoConfigSection } from "../_components/PdoConfigSection";

export default function ComponentPdoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = Number(rawId);

  const { data, isLoading, refetch } = trpc.components.componentById.useQuery({ id });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Component not found.</div>;

  if (data.busProtocol !== "CANOPEN" && data.busProtocol !== "CANBUS") {
    return <div className="p-8 text-muted-foreground">PDO configuration is only available for CANopen/CANBUS components.</div>;
  }

  return (
    <PdoConfigSection
      componentId={id}
      hasParent={!!data.parentId}
      signals={data.signals as any}
      onRefresh={() => refetch()}
    />
  );
}
