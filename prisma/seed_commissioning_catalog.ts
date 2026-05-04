import { PrismaClient } from "./generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "node:fs";
import * as path from "node:path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type ModuleCommissioningEntry = {
  part_id: string;
  module_class: string;
  needs_commissioning?: boolean;
  library_fb?: unknown;
  iec_globals_path_pattern?: string | null;
  commissioning_settings?: unknown[];
  monitoring_signals?: unknown[];
  commissioning_constraints?: unknown[];
  apply_method?: unknown;
  source?: unknown;
};

function parsePartId(partId: string): { vendor: string; articleNumber: string } | null {
  const m = partId.match(/^([a-z][a-z0-9_-]*):([A-Z0-9./-]+)$/i);
  if (!m) return null;
  const vendorSlug = m[1].toLowerCase();
  const articleNumber = m[2];
  const vendorMap: Record<string, string> = {
    wago: "Wago",
  };
  const vendor = vendorMap[vendorSlug];
  if (!vendor) return null;
  return { vendor, articleNumber };
}

async function main() {
  const dataDir = path.resolve(__dirname, "..", "data", "commissioning");
  if (!fs.existsSync(dataDir)) {
    console.error(`Commissioning data directory not found: ${dataDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith("_module_commissioning.json"));
  if (files.length === 0) {
    console.error(`No *_module_commissioning.json files in ${dataDir}`);
    process.exit(1);
  }

  let totalSeen = 0;
  let totalUpserted = 0;
  let totalUnmatched = 0;
  const unmatched: string[] = [];

  for (const file of files) {
    const fullPath = path.join(dataDir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const entries: ModuleCommissioningEntry[] = JSON.parse(raw);

    console.log(`\n[${file}] ${entries.length} entries`);

    for (const entry of entries) {
      totalSeen++;
      const parsed = parsePartId(entry.part_id);
      if (!parsed) {
        console.warn(`  SKIP unparseable part_id: ${entry.part_id}`);
        continue;
      }

      // Strip part_id from the body — it lives implicitly via the catalog row
      // it's attached to. Other fields go into commissioning_data verbatim.
      const { part_id: _ignored, ...body } = entry;

      // Try ModuleCatalog first (most entries).
      const moduleHit = await prisma.moduleCatalog.findFirst({
        where: { vendorName: parsed.vendor, articleNumber: parsed.articleNumber },
      });
      if (moduleHit) {
        await prisma.moduleCatalog.update({
          where: { id: moduleHit.id },
          data: { commissioningData: body as never },
        });
        totalUpserted++;
        continue;
      }

      // Fall back to DeviceCatalog (controllers and couplers).
      const deviceHit = await prisma.deviceCatalog.findFirst({
        where: { vendorName: parsed.vendor, articleNumber: parsed.articleNumber },
      });
      if (deviceHit) {
        await prisma.deviceCatalog.update({
          where: { id: deviceHit.id },
          data: { commissioningData: body as never },
        });
        totalUpserted++;
        continue;
      }

      totalUnmatched++;
      unmatched.push(entry.part_id);
    }
  }

  console.log(
    `\nDone. Seen ${totalSeen}, upserted ${totalUpserted}, unmatched ${totalUnmatched}.`,
  );
  if (unmatched.length > 0) {
    console.log(`Unmatched part_ids:\n  ${unmatched.join("\n  ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
