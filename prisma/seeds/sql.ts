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

    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ${file}: OK`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  ${file}: ERROR — ${msg.slice(0, 300)}`);
    }
  }
}
