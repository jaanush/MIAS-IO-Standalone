import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../_auth";

// ── Request body types ──────────────────────────────────────────────────────

type ScannedModule = {
  slot: number;
  moduleId: string;
  articleNumber: string;
};

type ScannedChild = {
  name: string;
  deviceId: string;
  modules: ScannedModule[];
};

type ScannedPlc = {
  name: string;
  ipAddress: string;
  deviceId: string;
  children: ScannedChild[];
};

type RequestBody = {
  source: string;
  scannedAt: string;
  plcs: ScannedPlc[];
};

// ── POST handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.plcs || !Array.isArray(body.plcs)) {
    return NextResponse.json({ error: "Missing or invalid 'plcs' array" }, { status: 400 });
  }

  // Load project with full hardware tree
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      plcs: {
        where: { deletedAt: null },
        include: {
          catalog: { select: { articleNumber: true } },
          carriers: {
            where: { deletedAt: null },
            include: {
              catalog: { select: { articleNumber: true } },
              cards: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  slotPosition: true,
                  catalogId: true,
                  vendorArticleNumber: true,
                  catalog: { select: { articleNumber: true } },
                },
                orderBy: { slotPosition: "asc" as const },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { plcs: dbPlcs } = project;

  // Build lookup: article number → module catalog id (for recognising scanned modules)
  const moduleCatalog = await db.moduleCatalog.findMany({
    select: { id: true, articleNumber: true },
  });
  const moduleByArticle = new Map(moduleCatalog.map((m) => [m.articleNumber, m.id]));

  let matched = 0;
  let unrecognised = 0;
  const warnings: string[] = [];

  for (const scannedPlc of body.plcs) {
    // Match PLC by name (case-insensitive) or IP address
    const dbPlc = dbPlcs.find(
      (p) =>
        p.name.toLowerCase() === scannedPlc.name.toLowerCase() ||
        (scannedPlc.ipAddress && p.ipAddress === scannedPlc.ipAddress),
    );

    if (!dbPlc) {
      unrecognised++;
      warnings.push(`PLC "${scannedPlc.name}" (${scannedPlc.ipAddress}) not found in project`);
      continue;
    }
    matched++;

    // Process children (bus segments / carriers)
    for (const child of scannedPlc.children) {
      // Match carrier by name (case-insensitive)
      const dbCarrier = dbPlc.carriers.find(
        (c) => c.name.toLowerCase() === child.name.toLowerCase(),
      );

      if (!dbCarrier) {
        // Could be a local bus — try to match by finding a carrier whose card slots align
        const localCarrier = dbPlc.carriers.find((c) => {
          if (child.modules.length === 0) return false;
          return child.modules.some((m) =>
            c.cards.some(
              (card) =>
                card.slotPosition === m.slot &&
                (card.catalog?.articleNumber === m.articleNumber ||
                  card.vendorArticleNumber === m.articleNumber),
            ),
          );
        });

        if (localCarrier) {
          matched++;
          doMatchModules(localCarrier, child.modules);
        } else {
          unrecognised++;
          warnings.push(
            `Child "${child.name}" under PLC "${scannedPlc.name}" not matched to any carrier`,
          );
        }
        continue;
      }

      matched++;
      doMatchModules(dbCarrier, child.modules);
    }
  }

  function doMatchModules(
    dbCarrier: (typeof dbPlcs)[number]["carriers"][number],
    modules: ScannedModule[],
  ) {
    for (const mod of modules) {
      const dbCard = dbCarrier.cards.find((c) => c.slotPosition === mod.slot);

      if (!dbCard) {
        // Module exists in scan but not in DB — report it
        const inCatalog = moduleByArticle.has(mod.articleNumber);
        if (inCatalog) {
          warnings.push(
            `Slot ${mod.slot} on carrier "${dbCarrier.name}": scanned module ${mod.articleNumber} exists in catalog but not assigned in project`,
          );
        } else {
          warnings.push(
            `Slot ${mod.slot} on carrier "${dbCarrier.name}": scanned module ${mod.articleNumber} not found in module catalog`,
          );
        }
        unrecognised++;
        continue;
      }

      // Card exists at this slot — verify article number matches
      const dbArticle = dbCard.catalog?.articleNumber ?? dbCard.vendorArticleNumber;

      if (dbArticle === mod.articleNumber) {
        matched++;
      } else {
        matched++;
        warnings.push(
          `Slot ${mod.slot} on carrier "${dbCarrier.name}": DB has ${dbArticle ?? "unknown"}, scan has ${mod.articleNumber}`,
        );
      }
    }

    // Check for DB cards not present in scan
    for (const dbCard of dbCarrier.cards) {
      const inScan = modules.find((m) => m.slot === dbCard.slotPosition);
      if (!inScan) {
        const art = dbCard.catalog?.articleNumber ?? dbCard.vendorArticleNumber ?? "unknown";
        warnings.push(
          `Slot ${dbCard.slotPosition} on carrier "${dbCarrier.name}": DB has ${art} but not found in scan`,
        );
      }
    }
  }

  return NextResponse.json({
    accepted: true,
    matched,
    unrecognised,
    warnings,
  });
}
