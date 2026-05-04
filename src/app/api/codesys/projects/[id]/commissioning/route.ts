import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../_auth";

/**
 * PATCH /api/codesys/projects/{id}/commissioning  (FR-022 Path B)
 *
 * Partial update of the project-level hardware commissioning policy. Plugin
 * codegen reads these to emit `GVL_MIAS.xLocalCommReq` /
 * `GVL_Commission.xRun` initial values + the SAVE_FLASH scheduling in the
 * IEC commissioner's playbook.
 *
 * Body (any subset of):
 *   {
 *     "policy": "AUTO" | "MANUAL_ONLY" | "DISABLED",
 *     "initialXLocalCommReq": boolean,
 *     "initialXRunPlaybook": boolean,
 *     "rebootStrategy": "BATCH_LAST_STEP" | "PER_SLOT"
 *   }
 *
 * Validation:
 *   - At least one supported field must be present (clear contract violation otherwise)
 *   - Enum values strict (case-sensitive)
 *   - Booleans strict
 *
 * Response always echoes the full block.
 */

const POLICY_VALUES = ["AUTO", "MANUAL_ONLY", "DISABLED"] as const;
const REBOOT_VALUES = ["BATCH_LAST_STEP", "PER_SLOT"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    commissioningPolicy?: (typeof POLICY_VALUES)[number];
    commissioningInitialXLocalCommReq?: boolean;
    commissioningInitialXRunPlaybook?: boolean;
    commissioningRebootStrategy?: (typeof REBOOT_VALUES)[number];
  } = {};

  if ("policy" in body) {
    const v = body.policy;
    if (typeof v !== "string" || !POLICY_VALUES.includes(v as never)) {
      return NextResponse.json(
        { error: `'policy' must be one of ${POLICY_VALUES.join(" | ")}` },
        { status: 400 },
      );
    }
    data.commissioningPolicy = v as (typeof POLICY_VALUES)[number];
  }

  if ("initialXLocalCommReq" in body) {
    if (typeof body.initialXLocalCommReq !== "boolean") {
      return NextResponse.json(
        { error: "'initialXLocalCommReq' must be a boolean" },
        { status: 400 },
      );
    }
    data.commissioningInitialXLocalCommReq = body.initialXLocalCommReq;
  }

  if ("initialXRunPlaybook" in body) {
    if (typeof body.initialXRunPlaybook !== "boolean") {
      return NextResponse.json(
        { error: "'initialXRunPlaybook' must be a boolean" },
        { status: 400 },
      );
    }
    data.commissioningInitialXRunPlaybook = body.initialXRunPlaybook;
  }

  if ("rebootStrategy" in body) {
    const v = body.rebootStrategy;
    if (typeof v !== "string" || !REBOOT_VALUES.includes(v as never)) {
      return NextResponse.json(
        { error: `'rebootStrategy' must be one of ${REBOOT_VALUES.join(" | ")}` },
        { status: 400 },
      );
    }
    data.commissioningRebootStrategy = v as (typeof REBOOT_VALUES)[number];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      {
        error:
          "Body must contain at least one of: policy, initialXLocalCommReq, initialXRunPlaybook, rebootStrategy",
      },
      { status: 400 },
    );
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: `Project ${projectId} not found` }, { status: 404 });
  }

  const updated = await db.project.update({
    where: { id: projectId },
    data,
    select: {
      id: true,
      commissioningPolicy: true,
      commissioningInitialXLocalCommReq: true,
      commissioningInitialXRunPlaybook: true,
      commissioningRebootStrategy: true,
    },
  });

  return NextResponse.json({
    accepted: true,
    commissioning: {
      policy: updated.commissioningPolicy,
      initialXLocalCommReq: updated.commissioningInitialXLocalCommReq,
      initialXRunPlaybook: updated.commissioningInitialXRunPlaybook,
      rebootStrategy: updated.commissioningRebootStrategy,
    },
  });
}
