import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../_auth";
import { z } from "zod";

const bodySchema = z.object({
  status: z.enum(["SUCCESS", "FAILURE"]),
  log: z.array(z.string()).default([]),
  error: z.string().nullable().default(null),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { status, log, error } = parsed.data;

  const task = await db.codesysTask.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "CLAIMED") {
    return NextResponse.json({ error: "Task is not in CLAIMED state" }, { status: 409 });
  }

  await db.codesysTask.update({
    where: { id },
    data: {
      status,
      resultLog: log,
      resultError: error,
      completedAt: new Date(),
    },
  });

  return new NextResponse(null, { status: 204 });
}
