import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../_auth";

/**
 * POST /api/codesys/data-types  (FR-014)
 *
 * Accept enum + struct definitions from the plugin. Same upsert-with-full-
 * member-replace semantics as /fb-definitions: re-POSTing the same set is
 * idempotent; if a type's members shrink, the removed members are dropped.
 *
 * Body: a single object or an array of:
 *   {
 *     "name": "E_Status5State",
 *     "kind": "ENUM" | "STRUCT",
 *     "sourceFile": "MIAS_Core/HMI/Enums/E_Status5State.enum",  // optional
 *     "baseType": "BYTE" | null,           // ENUM only — underlying integer type
 *     "defaultName": "Unknown" | null,     // ENUM only — value used as default initialiser
 *     "values":  [{ "name": "Running", "value": 0 }, ...]    // ENUM only
 *     "members": [{ "name": "Frequency", "dataType": "REAL" }, ...]  // STRUCT only
 *   }
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

  const types: TypeInput[] = Array.isArray(body) ? body : [body as TypeInput];
  if (types.length === 0) return NextResponse.json({ error: "Empty payload" }, { status: 400 });

  for (const t of types) {
    if (!t.name || typeof t.name !== "string") {
      return NextResponse.json({ error: "Each type requires 'name' (string)" }, { status: 400 });
    }
    if (t.kind !== "ENUM" && t.kind !== "STRUCT") {
      return NextResponse.json({ error: `'kind' must be ENUM or STRUCT (name: ${t.name})` }, { status: 400 });
    }
    if (t.kind === "ENUM") {
      if (!Array.isArray(t.values)) {
        return NextResponse.json({ error: `ENUM ${t.name}: 'values' must be an array` }, { status: 400 });
      }
      for (const v of t.values) {
        if (typeof v?.name !== "string" || typeof v?.value !== "number") {
          return NextResponse.json({ error: `ENUM ${t.name}: each value needs 'name' (string) and 'value' (number)` }, { status: 400 });
        }
      }
    } else {
      if (!Array.isArray(t.members)) {
        return NextResponse.json({ error: `STRUCT ${t.name}: 'members' must be an array` }, { status: 400 });
      }
      for (const m of t.members) {
        if (typeof m?.name !== "string" || typeof m?.dataType !== "string") {
          return NextResponse.json({ error: `STRUCT ${t.name}: each member needs 'name' and 'dataType' (strings)` }, { status: 400 });
        }
      }
    }
  }

  const results: any[] = [];

  try {
    for (const t of types) {
      const sourceFile = t.sourceFile ?? "plugin-api";

      let dt = await db.codesysDataType.findFirst({
        where: { name: t.name, sourceFile },
      });
      if (dt) {
        dt = await db.codesysDataType.update({
          where: { id: dt.id },
          data: {
            kind: t.kind,
            baseType: t.baseType ?? null,
            defaultName: t.defaultName ?? null,
          },
        });
      } else {
        dt = await db.codesysDataType.create({
          data: {
            name: t.name,
            kind: t.kind,
            baseType: t.baseType ?? null,
            defaultName: t.defaultName ?? null,
            sourceFile,
          },
        });
      }

      // Full-replace child rows
      if (t.kind === "ENUM") {
        await db.codesysDataTypeValue.deleteMany({ where: { dataTypeId: dt.id } });
        if (t.values && t.values.length > 0) {
          await db.codesysDataTypeValue.createMany({
            data: t.values.map((v, idx) => ({
              dataTypeId: dt!.id,
              name: v.name,
              value: v.value,
              sortOrder: idx,
            })),
          });
        }
      } else {
        await db.codesysDataTypeMember.deleteMany({ where: { dataTypeId: dt.id } });
        if (t.members && t.members.length > 0) {
          await db.codesysDataTypeMember.createMany({
            data: t.members.map((m, idx) => ({
              dataTypeId: dt!.id,
              name: m.name,
              memberType: m.dataType,
              sortOrder: idx,
            })),
          });
        }
      }

      results.push({
        id: dt.id,
        name: dt.name,
        kind: dt.kind,
        baseType: dt.baseType,
        defaultName: dt.defaultName,
        valuesCount: t.kind === "ENUM" ? t.values?.length ?? 0 : 0,
        membersCount: t.kind === "STRUCT" ? t.members?.length ?? 0 : 0,
      });
    }

    return NextResponse.json({ accepted: true, dataTypes: results });
  } catch (err: any) {
    console.error("data-types error:", err);
    return NextResponse.json({ error: err.message ?? "Internal error", code: err.code }, { status: 500 });
  }
}

interface EnumValueInput { name: string; value: number; }
interface StructMemberInput { name: string; dataType: string; }
interface TypeInput {
  name: string;
  kind: "ENUM" | "STRUCT";
  sourceFile?: string;
  baseType?: string | null;
  defaultName?: string | null;
  values?: EnumValueInput[];
  members?: StructMemberInput[];
}
