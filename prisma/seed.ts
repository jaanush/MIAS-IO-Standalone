import { PrismaClient } from "./generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedSql } from "./seeds/sql";
import { seedModules } from "./seeds/modules";
import { seedProject } from "./seeds/project";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. SQL seeds first (device catalog, approvals, components)
  console.log("Running SQL seeds...");
  await seedSql(prisma);

  // 2. Module catalog (links to approvals from step 1)
  await seedModules(prisma);

  // 3. Default project + admin user
  await seedProject(prisma);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
