import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Logout error:", e);
    return NextResponse.json({ ok: true });
  }
}
