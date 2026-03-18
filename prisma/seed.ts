import { PrismaClient } from "./generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedModules } from "./seeds/modules";
import { seedProject } from "./seeds/project";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await seedModules(prisma);
  await seedProject(prisma);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
