import { PrismaClient } from "./generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "node:fs";
import * as path from "node:path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type WagoModuleRecord = {
  articleNumber: string;
  kind: "coupler" | "terminal";
  descriptions: { en: string | null; de: string | null; fr: string | null };
  moduleType: number | null;
  moduleIcon: number | null;
  supportedModes: number | null;
  bootDelayS: number | null;
  consumptionMa: number | null;
  voltageV: number | null;
  lk1: number | null;
  lk2: number | null;
  pe: number | null;
  adjustable: boolean;
  settingsApp: string | null;
  settingsAppName: string | null;
  image: { url: string; width: number; height: number; sourceBmp: string } | null;
  leds: {
    rows: number | null;
    cols: number | null;
    max: number | null;
    rect: string | null;
    items: Array<{ index: number; color: string; flag: string; label: string | null }>;
  } | null;
  source: { wddFile: string; wddSection: string };
};

async function main() {
  const jsonPath = path.resolve(__dirname, "..", "data", "wago", "wago_modules.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`Not found: ${jsonPath}`);
    console.error(`Run scripts/import_wago_modules.py first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  const records: Record<string, WagoModuleRecord> = JSON.parse(raw);
  const entries = Object.values(records);

  let mUpserted = 0;
  let dUpserted = 0;
  const unmatched: string[] = [];

  for (const rec of entries) {
    // Strip `articleNumber` and `source` from the body — those are metadata
    // about the import itself; the catalog row already carries the article.
    const { articleNumber, source: _src, ...body } = rec;

    // Couplers + controllers live in DeviceCatalog. Modules live in ModuleCatalog.
    // We try DeviceCatalog first when kind is "coupler" (controllers also live
    // there); otherwise ModuleCatalog. Fallback to the other if first miss.
    const tryDeviceFirst = rec.kind === "coupler";

    if (tryDeviceFirst) {
      const hit = await prisma.deviceCatalog.findFirst({
        where: { vendorName: "Wago", articleNumber },
      });
      if (hit) {
        await prisma.deviceCatalog.update({
          where: { id: hit.id },
          data: { frontPanel: body as never },
        });
        dUpserted++;
        continue;
      }
    }

    const moduleHit = await prisma.moduleCatalog.findFirst({
      where: { vendorName: "Wago", articleNumber },
    });
    if (moduleHit) {
      await prisma.moduleCatalog.update({
        where: { id: moduleHit.id },
        data: { frontPanel: body as never },
      });
      mUpserted++;
      continue;
    }

    if (!tryDeviceFirst) {
      const deviceHit = await prisma.deviceCatalog.findFirst({
        where: { vendorName: "Wago", articleNumber },
      });
      if (deviceHit) {
        await prisma.deviceCatalog.update({
          where: { id: deviceHit.id },
          data: { frontPanel: body as never },
        });
        dUpserted++;
        continue;
      }
    }

    unmatched.push(articleNumber);
  }

  console.log(`Seeded front-panel data:`);
  console.log(`  ModuleCatalog rows updated: ${mUpserted}`);
  console.log(`  DeviceCatalog rows updated: ${dUpserted}`);
  console.log(`  Unmatched (no catalog row): ${unmatched.length}`);
  if (unmatched.length > 0 && unmatched.length < 50) {
    console.log(`  Unmatched articles: ${unmatched.join(", ")}`);
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
