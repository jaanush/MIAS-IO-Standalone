import { PrismaClient } from "./generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const seedFile = path.join(process.cwd(), "prisma", "seed_data.sql");
  if (!fs.existsSync(seedFile)) {
    console.error("prisma/seed_data.sql not found");
    process.exit(1);
  }

  console.log("Running main data seed (seed_data.sql)...");
  const sql = fs.readFileSync(seedFile, "utf-8");
  await prisma.$executeRawUnsafe(sql);
  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error("Seed failed:", e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
