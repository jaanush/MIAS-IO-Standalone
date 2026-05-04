import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../_auth";

/**
 * POST /api/codesys/fb-definitions
 *
 * Accept FB pin definitions from the plugin. Upserts into CodesysFbDefinition +
 * CodesysFbParameter. Auto-links to HardwareComponent if functionBlock matches.
 *
 * FR-015 / NOTIF-023: payload may carry `alwaysReview` + `hintSchemaVersion`
 * at the FB level and a `wiringHint` block per parameter. Hints land in
 * CodesysFbParameterHint (1:1 with parameter). Push is always accepted —
 * version-major mismatches get logged as gaps lazily at match time.
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

  const definitions: FbInput[] = Array.isArray(body) ? body : [body as FbInput];

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
    if (def.alwaysReview !== undefined && typeof def.alwaysReview !== "boolean") {
      return NextResponse.json({ error: `'alwaysReview' must be boolean (fbName: ${def.fbName})` }, { status: 400 });
    }
    if (def.hintSchemaVersion !== undefined && def.hintSchemaVersion !== null && typeof def.hintSchemaVersion !== "string") {
      return NextResponse.json({ error: `'hintSchemaVersion' must be string (fbName: ${def.fbName})` }, { status: 400 });
    }
    for (const p of def.parameters) {
      if (!p.name || !p.direction || !p.dataType) {
        return NextResponse.json({ error: `Each parameter requires 'name', 'direction', 'dataType' (fbName: ${def.fbName})` }, { status: 400 });
      }
      if (p.wiringHint !== undefined && p.wiringHint !== null) {
        const err = validateHint(p.wiringHint, def.fbName, p.name);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }
  }

  const results: Array<{
    id: number;
    fbName: string;
    componentId: number | null;
    componentMatched: boolean;
    parametersCount: number;
    hintsCount: number;
    alwaysReview: boolean;
    hintSchemaVersion: string | null;
  }> = [];

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
            alwaysReview: def.alwaysReview ?? false,
            hintSchemaVersion: def.hintSchemaVersion ?? null,
          },
        });
      } else {
        fbDef = await db.codesysFbDefinition.create({
          data: {
            name: def.fbName,
            extendsName: def.extendsName ?? null,
            sourceFile,
            componentId,
            alwaysReview: def.alwaysReview ?? false,
            hintSchemaVersion: def.hintSchemaVersion ?? null,
          },
        });
      }

      // Full replacement: delete existing params (cascade drops their hints).
      await db.codesysFbParameter.deleteMany({
        where: { fbDefinitionId: fbDef.id },
      });

      // Re-create parameters one at a time so we can attach the hint inline
      // and capture the new parameter ID. Volumes here are tiny (~20 pins/FB).
      let hintsCount = 0;
      for (const p of def.parameters) {
        const hintData = p.wiringHint ? buildHintCreate(p.wiringHint, def.hintSchemaVersion ?? null) : null;
        await db.codesysFbParameter.create({
          data: {
            fbDefinitionId: fbDef.id,
            name: p.name,
            direction: p.direction,
            dataType: p.dataType,
            ...(hintData ? { hint: { create: hintData } } : {}),
          },
        });
        if (hintData) hintsCount++;
      }

      results.push({
        id: fbDef.id,
        fbName: fbDef.name,
        componentId: fbDef.componentId,
        componentMatched: componentId !== null,
        parametersCount: def.parameters.length,
        hintsCount,
        alwaysReview: fbDef.alwaysReview,
        hintSchemaVersion: fbDef.hintSchemaVersion,
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

// ── Hint validation + normalization ─────────────────────────────────

const HINT_KIND = new Set(["signal", "parameter"]);
const VALUE_ROLE = new Set(["actual", "setpoint", "reference", "limit", "alarm", "command"]);
const COMMAND_KIND = new Set(["pulse", "level"]);

function validateHint(hint: WiringHintInput, fbName: string, paramName: string): string | null {
  const where = `wiringHint on ${fbName}.${paramName}`;
  if (typeof hint !== "object" || hint === null) {
    return `${where}: must be an object`;
  }
  if (hint.kind !== undefined && hint.kind !== null) {
    if (typeof hint.kind !== "string" || !HINT_KIND.has(hint.kind.toLowerCase())) {
      return `${where}: 'kind' must be 'signal' or 'parameter'`;
    }
  }
  if (hint.valueRole !== undefined && hint.valueRole !== null) {
    if (typeof hint.valueRole !== "string" || !VALUE_ROLE.has(hint.valueRole.toLowerCase())) {
      return `${where}: 'valueRole' must be one of actual|setpoint|reference|limit|alarm|command`;
    }
  }
  if (hint.commandKind !== undefined && hint.commandKind !== null) {
    if (typeof hint.commandKind !== "string" || !COMMAND_KIND.has(hint.commandKind.toLowerCase())) {
      return `${where}: 'commandKind' must be 'pulse' or 'level'`;
    }
  }
  if (hint.matchTag !== undefined && hint.matchTag !== null) {
    if (!Array.isArray(hint.matchTag) || hint.matchTag.some((t) => typeof t !== "string")) {
      return `${where}: 'matchTag' must be an array of strings`;
    }
  }
  if (hint.required !== undefined && typeof hint.required !== "boolean") {
    return `${where}: 'required' must be boolean`;
  }
  if (hint.humanReview !== undefined && typeof hint.humanReview !== "boolean") {
    return `${where}: 'humanReview' must be boolean`;
  }
  if (hint.arrayCardinality !== undefined && hint.arrayCardinality !== null) {
    if (!Number.isInteger(hint.arrayCardinality)) {
      return `${where}: 'arrayCardinality' must be an integer`;
    }
  }
  // Free-form strings — accept anything string-typed.
  for (const k of ["semantic", "expectedUnit", "instrumentClass", "defaultLiteral", "pairedWith", "structRole", "notes"] as const) {
    const v = (hint as any)[k];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return `${where}: '${k}' must be string`;
    }
  }
  return null;
}

function buildHintCreate(hint: WiringHintInput, fbHintSchemaVersion: string | null) {
  return {
    hintSchemaVersion: fbHintSchemaVersion,
    kind: hint.kind ? (hint.kind.toUpperCase() as "SIGNAL" | "PARAMETER") : "SIGNAL",
    semantic: hint.semantic ?? null,
    expectedUnit: hint.expectedUnit ?? null,
    instrumentClass: hint.instrumentClass ?? null,
    matchTag: Array.isArray(hint.matchTag) ? hint.matchTag : [],
    required: hint.required ?? false,
    defaultLiteral: hint.defaultLiteral ?? null,
    pairedWith: hint.pairedWith ?? null,
    structRole: hint.structRole ?? null,
    arrayCardinality: hint.arrayCardinality ?? null,
    valueRole: hint.valueRole ? (hint.valueRole.toUpperCase() as "ACTUAL" | "SETPOINT" | "REFERENCE" | "LIMIT" | "ALARM" | "COMMAND") : null,
    humanReview: hint.humanReview ?? false,
    commandKind: hint.commandKind ? (hint.commandKind.toUpperCase() as "PULSE" | "LEVEL") : null,
    notes: hint.notes ?? null,
  };
}

// ── Types ─────────────────────────────────────────────────────────

type WiringHintInput = {
  kind?: string | null;                  // "signal" | "parameter" — defaults to "signal"
  semantic?: string | null;
  expectedUnit?: string | null;
  instrumentClass?: string | null;
  matchTag?: string[] | null;
  required?: boolean;
  defaultLiteral?: string | null;
  pairedWith?: string | null;
  structRole?: string | null;
  arrayCardinality?: number | null;
  valueRole?: string | null;             // "actual" | "setpoint" | "reference" | "limit" | "alarm" | "command"
  humanReview?: boolean;
  commandKind?: string | null;           // "pulse" | "level"
  notes?: string | null;
};

type ParamInput = {
  name: string;
  direction: string; // VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR
  dataType: string;  // BOOL, INT, REAL, DWORD, etc.
  wiringHint?: WiringHintInput | null;
};

type FbInput = {
  fbName: string;
  extendsName?: string;
  sourceFile?: string;
  alwaysReview?: boolean;
  hintSchemaVersion?: string | null;
  parameters: ParamInput[];
};
