import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../_auth";

export async function GET(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const projects = await db.project.findMany({
    select: { id: true, name: true, status: true, client: true, location: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(projects);
}
