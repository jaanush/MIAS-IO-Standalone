import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

type UserRow = { id: string; email: string; role: string; password_hash: string | null };

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Use raw SQL so the query works even if the Prisma client wasn't regenerated
  // after the password_hash column was added.
  const rows = await db.$queryRaw<UserRow[]>`
    SELECT id::text, email, role::text, password_hash
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  const user = rows[0];

  if (!user || !user.password_hash) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await setSessionCookie({ userId: user.id, email: user.email, role: user.role });

  return NextResponse.json({ ok: true });
}
