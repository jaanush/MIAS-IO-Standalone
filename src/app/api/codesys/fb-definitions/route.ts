import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../_auth";

/**
 * POST /api/codesys/fb-definitions
 *
 * Accept FB pin definitions from the plugin. Upserts into CodesysFbDefinition +
 * CodesysFbParameter. Auto-links to HardwareComponent if functionBlock matches.
 *
 * Can send a single FB or an array of FBs.
 */
export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Accept single object or array
  const definitions: FbInput[] = Array.isArray(body) ? body : [body];

  if (definitions.length === 0) {
    return NextResponse.json({ error: "Empty payload" }, { status: 400 });
  }

  // Validate
  for (const def of definitions) {
    if (!def.fbName || typeof def.fbName !== "string") {
      return NextResponse.json({ error: "Each definition requires 'fbName' (string)" }, { status: 400 });
    }
    if (!Array.isArray(def.parameters)) {
      return NextResponse.json({ error: `'parameters' must be an array (fbName: ${def.fbName})` }, { status: 400 });
    }
    for (const p of def.parameters) {
      if (!p.name || !p.direction || !p.dataType) {
        return NextResponse.json({ error: `Each parameter requires 'name', 'direction', 'dataType' (fbName: ${def.fbName})` }, { status: 400 });
      }
    }
  }

  const results = [];

  try {
  for (const def of definitions) {
    const sourceFile = def.sourceFile ?? "plugin-api";

    // Auto-link to component by matching functionBlock
    let componentId: number | null = null;
    const matchingComponent = await db.hardwareComponent.findFirst({
      where: { functionBlock: def.fbName },
      select: { id: true },
    });
    if (matchingComponent) componentId = matchingComponent.id;

    // Find or create the FB definition
    let fbDef = await db.codesysFbDefinition.findFirst({
      where: { name: def.fbName, sourceFile },
    });
    if (fbDef) {
      fbDef = await db.codesysFbDefinition.update({
        where: { id: fbDef.id },
        data: {
          extendsName: def.extendsName ?? null,
          componentId: componentId ?? fbDef.componentId,
        },
      });
    } else {
      fbDef = await db.codesysFbDefinition.create({
        data: {
          name: def.fbName,
          extendsName: def.extendsName ?? null,
          sourceFile,
          componentId,
        },
      });
    }

    // Delete existing parameters and re-create (full replacement)
    await db.codesysFbParameter.deleteMany({
      where: { fbDefinitionId: fbDef.id },
    });

    if (def.parameters.length > 0) {
      await db.codesysFbParameter.createMany({
        data: def.parameters.map((p: ParamInput) => ({
          fbDefinitionId: fbDef.id,
          name: p.name,
          direction: p.direction,
          dataType: p.dataType,
        })),
      });
    }

    results.push({
      id: fbDef.id,
      fbName: fbDef.name,
      componentId: fbDef.componentId,
      componentMatched: componentId !== null,
      parametersCount: def.parameters.length,
    });
  }

  return NextResponse.json({
    accepted: true,
    definitions: results,
  });
  } catch (err: any) {
    console.error("fb-definitions error:", err);
    return NextResponse.json({ error: err.message ?? "Internal error", code: err.code }, { status: 500 });
  }
}

// ── Types ─────────────────────────────────────────────────────────

type ParamInput = {
  name: string;
  direction: string; // VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR
  dataType: string;  // BOOL, INT, REAL, DWORD, etc.
};

type FbInput = {
  fbName: string;
  extendsName?: string;
  sourceFile?: string;
  parameters: ParamInput[];
};
