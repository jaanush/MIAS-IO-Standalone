/**
 * Diff a new DBC file against the component_signal rows of one or more
 * Kreisel components, and produce a plan of UPDATE / INACTIVATE / INSERT
 * operations. Does NOT mutate the database — prints the plan to stdout.
 *
 * Usage:
 *   npx tsx scripts/dbc-diff-kreisel.ts \
 *     --dbc "C:/onedrive/.../debug_PCAN_250606.dbc" \
 *     --component-id 29
 *
 *   Add --apply to actually run the SQL.
 *
 * Matching strategy:
 *   1. For each component_signal row, look up DBC by (canId, tag_suffix).
 *      DBC SG_ name has the format <name>_<source> (e.g. linkVoltage_BMS01),
 *      and component_signal.tag_suffix tends to drop the trailing _BMS01.
 *      Match on tag_suffix prefix (case-insensitive) within the same canId.
 *   2. If no DBC match for a row → INACTIVATE (active=false).
 *   3. If DBC has signals on a known canId that no row has → INSERT new row.
 *   4. If matched but bit_offset / bit_length / scale changed → UPDATE.
 */
import { PrismaClient } from "../prisma/generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface DbcSignal {
  name: string;        // raw SG_ name (e.g. linkVoltage_BMS01)
  bitOffset: number;
  bitLength: number;
  byteOrder: "BIG_ENDIAN" | "LITTLE_ENDIAN";
  isSigned: boolean;
  scale: number;
  offset: number;
  min: number;
  max: number;
  unit: string;
  transmitter: string;
  // Multiplexed?
  muxIndicator: boolean;
  muxId: number | null;
}

interface DbcMessage {
  canId: number;
  name: string;        // BO_ name (BMS01_State)
  length: number;
  transmitter: string;
  signals: DbcSignal[];
}

function parseDbc(text: string): Map<number, DbcMessage> {
  const messages = new Map<number, DbcMessage>();
  const lines = text.split(/\r?\n/);
  let current: DbcMessage | null = null;
  for (const line of lines) {
    const boMatch = line.match(/^BO_ (\d+) (\w+):\s*(\d+)\s+(.+?)$/);
    if (boMatch) {
      current = {
        canId: parseInt(boMatch[1], 10),
        name: boMatch[2],
        length: parseInt(boMatch[3], 10),
        transmitter: boMatch[4].trim(),
        signals: [],
      };
      messages.set(current.canId, current);
      continue;
    }
    const sgMatch = line.match(
      /^\s*SG_\s+(\w+)\s*(M|m\d+)?\s*:\s*(\d+)\|(\d+)@(\d)([+-])\s*\(([\d.eE+-]+),([\d.eE+-]+)\)\s*\[([\d.eE+-]+)\|([\d.eE+-]+)\]\s*"([^"]*)"\s+(.+?)$/
    );
    if (sgMatch && current) {
      const [, name, mux, bitOffsetStr, bitLengthStr, endianStr, signStr, scaleStr, offsetStr, minStr, maxStr, unit, transmitter] = sgMatch;
      current.signals.push({
        name,
        bitOffset: parseInt(bitOffsetStr, 10),
        bitLength: parseInt(bitLengthStr, 10),
        byteOrder: endianStr === "0" ? "BIG_ENDIAN" : "LITTLE_ENDIAN",
        isSigned: signStr === "-",
        scale: parseFloat(scaleStr),
        offset: parseFloat(offsetStr),
        min: parseFloat(minStr),
        max: parseFloat(maxStr),
        unit,
        transmitter: transmitter.trim(),
        muxIndicator: mux === "M",
        muxId: mux && mux.startsWith("m") ? parseInt(mux.slice(1), 10) : null,
      });
    }
  }
  return messages;
}

// component_signal scale columns are DECIMAL(12,4) → ±99_999_999.9999
const DECIMAL_12_4_MAX = 99_999_999.9999;
function fitsDecimal12_4(v: number): boolean {
  return Math.abs(v) <= DECIMAL_12_4_MAX;
}

function rawDataType(bitLength: number, isSigned: boolean): string {
  if (bitLength === 1) return "BOOL";
  if (bitLength <= 8) return isSigned ? "SINT" : "BYTE";
  if (bitLength <= 16) return isSigned ? "INT" : "WORD";
  if (bitLength <= 32) return isSigned ? "DINT" : "DWORD";
  return isSigned ? "LINT" : "LWORD";
}

function normaliseTag(s: string): string {
  // Drop trailing _BMS, _BMS01, _PT, _SC01 etc.
  return s.replace(/_(BMS\d*|PT|SC\d*)$/i, "").toLowerCase();
}

async function main() {
  const args = process.argv.slice(2);
  const dbcPath = args[args.indexOf("--dbc") + 1];
  const componentId = parseInt(args[args.indexOf("--component-id") + 1], 10);
  const apply = args.includes("--apply");

  if (!dbcPath || isNaN(componentId)) {
    console.error("Usage: npx tsx scripts/dbc-diff-kreisel.ts --dbc <path> --component-id <id> [--apply]");
    process.exit(1);
  }

  const dbcText = readFileSync(dbcPath, "utf-8");
  const dbc = parseDbc(dbcText);
  console.log(`Parsed ${dbc.size} messages from ${dbcPath}`);

  const component = await prisma.hardwareComponent.findUnique({
    where: { id: componentId },
    select: { id: true, name: true, functionBlock: true },
  });
  if (!component) {
    console.error(`Component ${componentId} not found`);
    process.exit(1);
  }
  console.log(`Component: ${component.name} (id=${component.id}, fb=${component.functionBlock})`);

  const dbRows = await prisma.componentSignal.findMany({
    where: { componentId },
    select: {
      id: true, channelOffset: true, canId: true, tagSuffix: true,
      bitOffset: true, bitLength: true, rawDataType: true,
      defaultScaleMin: true, defaultScaleMax: true,
      defaultRawMin: true, defaultRawMax: true,
      active: true,
    },
    orderBy: [{ canId: "asc" }, { bitOffset: "asc" }],
  });
  console.log(`DB rows: ${dbRows.length} (active=${dbRows.filter((r) => r.active).length})`);

  const dbCanIds = new Set(dbRows.map((r) => r.canId).filter((x): x is number => x != null));

  // ── Per-message diff
  const updates: Array<{ rowId: number; tag: string; canId: number; changes: Record<string, string> }> = [];
  const inactivates: Array<{ rowId: number; tag: string; canId: number | null; reason: string }> = [];
  const inserts: Array<{ canId: number; sig: DbcSignal; reason: string }> = [];

  for (const row of dbRows) {
    if (row.canId == null) continue;
    const msg = dbc.get(row.canId);
    if (!msg) {
      inactivates.push({ rowId: row.id, tag: row.tagSuffix ?? "?", canId: row.canId, reason: `CAN id ${row.canId} no longer in DBC` });
      continue;
    }
    const dbcSig = msg.signals.find((s) => normaliseTag(s.name) === normaliseTag(row.tagSuffix ?? ""));
    if (!dbcSig) {
      inactivates.push({ rowId: row.id, tag: row.tagSuffix ?? "?", canId: row.canId, reason: `signal not in new ${msg.name}` });
      continue;
    }
    const changes: Record<string, string> = {};
    if (dbcSig.bitOffset !== row.bitOffset) changes.bitOffset = `${row.bitOffset} → ${dbcSig.bitOffset}`;
    if (dbcSig.bitLength !== row.bitLength) changes.bitLength = `${row.bitLength} → ${dbcSig.bitLength}`;
    const newType = rawDataType(dbcSig.bitLength, dbcSig.isSigned);
    if (newType !== row.rawDataType) changes.rawDataType = `${row.rawDataType} → ${newType}`;
    const oldMin = row.defaultScaleMin ? Number(row.defaultScaleMin) : null;
    const oldMax = row.defaultScaleMax ? Number(row.defaultScaleMax) : null;
    // Skip the null → 0/0 case: DBC range [0|0] is a "no range" placeholder
    // for enum/bitfield signals, not a real scale window. Keep null.
    const dbcRangeIsZero = dbcSig.min === 0 && dbcSig.max === 0;
    // Skip values that overflow DECIMAL(12,4) — DBC max for 32-bit scaled
    // signals can hit ~4.3e10 (e.g. energyThroughput_KWh range up to 4.29e7
    // is fine, but some 32-bit Ah counters overflow).
    const fits = fitsDecimal12_4(dbcSig.min) && fitsDecimal12_4(dbcSig.max);
    if (!dbcRangeIsZero && fits) {
      if (oldMin !== dbcSig.min) changes.scaleMin = `${oldMin} → ${dbcSig.min}`;
      if (oldMax !== dbcSig.max) changes.scaleMax = `${oldMax} → ${dbcSig.max}`;
    } else if (!fits) {
      changes.scaleSkipped = `range [${dbcSig.min}|${dbcSig.max}] exceeds DECIMAL(12,4)`;
    }
    if (Object.keys(changes).length > 0) {
      updates.push({ rowId: row.id, tag: row.tagSuffix ?? "?", canId: row.canId, changes });
    }
  }

  // Inserts: signals in DBC on already-mapped canIds that don't have a DB row
  for (const canId of dbCanIds) {
    const msg = dbc.get(canId);
    if (!msg) continue;
    for (const sig of msg.signals) {
      const exists = dbRows.some((r) =>
        r.canId === canId && normaliseTag(r.tagSuffix ?? "") === normaliseTag(sig.name)
      );
      if (!exists) {
        inserts.push({ canId, sig, reason: `new signal in ${msg.name}` });
      }
    }
  }

  // ── Print plan
  console.log("");
  console.log("─".repeat(70));
  console.log(`UPDATE: ${updates.length}`);
  for (const u of updates) {
    console.log(`  [${u.canId}] ${u.tag}`);
    for (const [k, v] of Object.entries(u.changes)) console.log(`      ${k}: ${v}`);
  }
  console.log(`INACTIVATE: ${inactivates.length}`);
  for (const x of inactivates) {
    console.log(`  [${x.canId ?? "—"}] ${x.tag}   (${x.reason})`);
  }
  console.log(`INSERT: ${inserts.length}`);
  for (const i of inserts) {
    console.log(`  [${i.canId}] ${i.sig.name}  ${i.sig.bitOffset}|${i.sig.bitLength}  ${i.sig.unit}  (${i.reason})`);
  }
  console.log("─".repeat(70));

  if (!apply) {
    console.log("");
    console.log("Dry-run — re-run with --apply to commit.");
    return;
  }

  console.log("");
  console.log("Applying…");
  let nextOffset = (dbRows.reduce((m, r) => Math.max(m, r.channelOffset), -1)) + 1;

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      const sig = dbc.get(u.canId)?.signals.find((s) => normaliseTag(s.name) === normaliseTag(u.tag));
      if (!sig) continue;
      const dbcRangeIsZero = sig.min === 0 && sig.max === 0;
      const data: any = {
        bitOffset: sig.bitOffset,
        bitLength: sig.bitLength,
        rawDataType: rawDataType(sig.bitLength, sig.isSigned),
        byteOrder: sig.byteOrder,
      };
      // Same null→0/0 guard at write time
      if (!dbcRangeIsZero || u.changes.scaleMin || u.changes.scaleMax) {
        if (u.changes.scaleMin) data.defaultScaleMin = sig.min;
        if (u.changes.scaleMax) data.defaultScaleMax = sig.max;
      }
      await tx.componentSignal.update({ where: { id: u.rowId }, data });
    }
    for (const x of inactivates) {
      await tx.componentSignal.update({
        where: { id: x.rowId },
        data: { active: false },
      });
    }
    for (const i of inserts) {
      const dbcRangeIsZero = i.sig.min === 0 && i.sig.max === 0;
      const fits = fitsDecimal12_4(i.sig.min) && fitsDecimal12_4(i.sig.max);
      const data: any = {
        componentId,
        channelOffset: nextOffset++,
        ioType: "AI",                   // CAN signals — placeholder; tweak in UI later
        tagSuffix: i.sig.name.slice(0, 50),
        description: i.sig.name,
        canId: i.canId,
        bitOffset: i.sig.bitOffset,
        bitLength: i.sig.bitLength,
        rawDataType: rawDataType(i.sig.bitLength, i.sig.isSigned),
        byteOrder: i.sig.byteOrder,
        active: true,
      };
      if (!dbcRangeIsZero && fits) {
        data.defaultScaleMin = i.sig.min;
        data.defaultScaleMax = i.sig.max;
      }
      await tx.componentSignal.create({ data });
    }
  });
  console.log(`Applied: ${updates.length} updates, ${inactivates.length} inactivated, ${inserts.length} inserts.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
