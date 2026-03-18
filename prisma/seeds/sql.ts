import type { PrismaClient } from "../generated/prisma/client/client";
import * as fs from "fs";
import * as path from "path";

const SQL_SEEDS = [
  "seed_device_catalog.sql",
  "seed_missing_catalog.sql",
  "seed_approval_links.sql",
  "seed_components.sql",
];

export async function seedSql(prisma: PrismaClient) {
  const prismaDir = path.join(process.cwd(), "prisma");

  for (const file of SQL_SEEDS) {
    const filePath = path.join(prismaDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${file} (not found)`);
      continue;
    }

    console.log(`  Running ${file}...`);
    const sql = fs.readFileSync(filePath, "utf-8");

    // Split on semicolons but skip empty statements and comments-only blocks
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    let executed = 0;
    for (const stmt of statements) {
      // Skip pure comment blocks and SELECT statements (summaries)
      if (/^\s*--/m.test(stmt) && !/INSERT|UPDATE|DELETE|CREATE|ALTER/i.test(stmt)) continue;
      if (/^\s*SELECT\b/i.test(stmt)) continue;

      try {
        await prisma.$executeRawUnsafe(stmt);
        executed++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Skip "already exists" errors for idempotency
        if (msg.includes("already exists") || msg.includes("duplicate key")) continue;
        console.warn(`  Warning in ${file}: ${msg.slice(0, 200)}`);
      }
    }
    console.log(`  ${file}: ${executed} statements executed`);
  }
}
