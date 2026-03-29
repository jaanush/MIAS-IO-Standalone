import { redirect } from "next/navigation";

export default async function ComponentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/components/${id}/details`);
}
