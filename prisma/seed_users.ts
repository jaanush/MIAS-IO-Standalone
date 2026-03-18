import { PrismaClient } from "./generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sqlFile = path.join(process.cwd(), "prisma", "seed_users_onetime.sql");
  if (!fs.existsSync(sqlFile)) {
    console.error("seed_users_onetime.sql not found");
    process.exit(1);
  }
  console.log("Running user seed...");
  const sql = fs.readFileSync(sqlFile, "utf-8");
  await prisma.$executeRawUnsafe(sql);
  console.log("User seed complete.");
}

main()
  .catch((e) => { console.error("User seed failed:", e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
