// FR-022 Path A: render the per-card / per-PLC `commissioning` block from
// the catalog blob (`commissioning_data` JSON column on ModuleCatalog or
// DeviceCatalog) joined with project-level overrides and slot context.
//
// Plugin then merges miasOpCode mapping (plugin-side) and effective values
// (project override → catalog mias_convention_value → catalog default_value).

type CatalogSetting = {
  name: string;
  register_or_object?: string | null;
  data_type?: string;
  value_range?: string | null;
  default_value?: string | number | boolean | null;
  mias_convention_value?: string | number | boolean | null;
  unit?: string | null;
  description?: string;
  writable_via?: string[];
  encoding_observed?: Record<string, string | number>;
  // Plugin-proposed (NOTIF-011 follow-up); pass-through if present.
  verify_against?: string | null;
  apply_method_override?: {
    save_to_eeprom_required?: boolean;
    takes_effect_immediately?: boolean;
    requires_runtime_restart?: boolean;
    requires_full_pfc_reboot?: boolean;
  };
};

type CatalogSignal = {
  name: string;
  iec_field?: string | null;
  data_type?: string;
  unit?: string | null;
  interpretation?: Record<string, string>;
  alarm_thresholds?: unknown;
  description?: string;
  readable_via?: string[];
};

type CatalogApplyMethod = {
  save_to_eeprom_required?: boolean;
  takes_effect_immediately?: boolean;
  requires_runtime_restart?: boolean;
  requires_full_pfc_reboot?: boolean;
  notes?: string;
};

type CatalogLibraryFb = {
  codesys_v2_lib?: string | null;
  codesys_v3_namespace?: string | null;
  config_fb?: string | null;
  module_fb?: string | null;
  extra_fbs?: string[];
};

export type CatalogCommissioningData = {
  module_class?: string;
  needs_commissioning?: boolean;
  library_fb?: CatalogLibraryFb | null;
  iec_globals_path_pattern?: string | null;
  commissioning_settings?: CatalogSetting[];
  monitoring_signals?: CatalogSignal[];
  commissioning_constraints?: unknown[];
  apply_method?: CatalogApplyMethod;
  source?: { verified_against_running_hardware?: boolean; verification_project?: string };
};

export type CommissioningOverrideRow = {
  name: string;
  value: string;
  notes: string | null;
};

/**
 * IEC reach test — does this setting have a path that the IEC commissioner
 * can drive? Per FR-022: settings whose `writable_via` contains
 * "Library FB input" are IEC-reachable. Anything else (`WAGO-I/O-CHECK`-only,
 * `WBM`-only) becomes a `WAIT_OPERATOR` step in the playbook.
 */
function isWritableFromIec(s: CatalogSetting): boolean {
  return Array.isArray(s.writable_via) && s.writable_via.includes("Library FB input");
}

/**
 * Resolve the slot placeholder in `iec_globals_path_pattern`. Catalog uses
 * `<slot>` per the schema. Returns null if the catalog has no pattern.
 */
function resolveIecGlobalsPath(pattern: string | null | undefined, slot: number | null): string | null {
  if (!pattern) return null;
  if (slot == null) return pattern; // leave placeholder if no slot
  return pattern.replace(/<slot>/g, String(slot));
}

/**
 * Render the per-card / per-PLC commissioning block. Returns null when the
 * catalog has no commissioning data (older catalog rows, or modules that
 * haven't been seeded yet).
 */
export function renderCommissioningBlock(args: {
  partId: string | null; // e.g. "wago:750-658"
  catalogData: CatalogCommissioningData | null;
  slotPosition: number | null;
  overrides: CommissioningOverrideRow[];
}) {
  const { partId, catalogData, slotPosition, overrides } = args;
  if (!catalogData) return null;

  const overrideByName = new Map(overrides.map((o) => [o.name, o]));

  const settings = (catalogData.commissioning_settings ?? []).map((s) => {
    const writable = isWritableFromIec(s);
    const override = overrideByName.get(s.name);
    // Effective value: override → mias_convention → default → null.
    const effectiveValue =
      override?.value ??
      (s.mias_convention_value != null ? String(s.mias_convention_value) : null) ??
      (s.default_value != null ? String(s.default_value) : null);

    const result: Record<string, unknown> = {
      name: s.name,
      writableFromIec: writable,
      dataType: s.data_type ?? null,
      registerOrObject: s.register_or_object ?? null,
      valueRange: s.value_range ?? null,
      unit: s.unit ?? null,
      defaultValue: s.default_value ?? null,
      miasConventionValue: s.mias_convention_value ?? null,
      effectiveValue,
      isOverridden: override != null,
      overrideNotes: override?.notes ?? null,
      writableVia: s.writable_via ?? [],
      encodingHint: s.encoding_observed ?? null,
      verifyAgainst: s.verify_against ?? null,
      applyMethodOverride: s.apply_method_override ?? null,
      description: s.description ?? null,
    };

    if (!writable) {
      // IEC-unreachable settings produce a WAIT_OPERATOR-style instruction.
      // Op-code mapping (SET_BAUD_658, etc.) stays plugin-side per FR-022.
      result.operatorInstruction = `Set "${s.name}" via ${(s.writable_via ?? ["operator interface"]).join(" or ")} on slot ${slotPosition ?? "?"}.`;
    }

    return result;
  });

  // Surface monitoring signals in pass-through form. Plugin uses these for
  // VERIFY-pair lookups + alarm threshold seeds.
  const monitoringSignals = (catalogData.monitoring_signals ?? []).map((sig) => ({
    name: sig.name,
    iecField: sig.iec_field ?? null,
    dataType: sig.data_type ?? null,
    unit: sig.unit ?? null,
    description: sig.description ?? null,
    readableVia: sig.readable_via ?? [],
    interpretation: sig.interpretation ?? null,
    alarmThresholds: sig.alarm_thresholds ?? null,
  }));

  return {
    partId,
    moduleClass: catalogData.module_class ?? null,
    needsCommissioning: catalogData.needs_commissioning ?? false,
    iecGlobalsPath: resolveIecGlobalsPath(catalogData.iec_globals_path_pattern, slotPosition),
    libraryFb: catalogData.library_fb ?? null,
    applyMethod: catalogData.apply_method ?? null,
    settings,
    monitoringSignals,
    constraints: catalogData.commissioning_constraints ?? [],
    sourceVerified: catalogData.source?.verified_against_running_hardware ?? false,
    sourceVerificationProject: catalogData.source?.verification_project ?? null,
  };
}

/**
 * Format the part_id for catalog records. Lowercases vendor + uses
 * article_number verbatim. e.g. ("Wago","750-658") → "wago:750-658".
 */
export function formatPartId(vendorName: string | null, articleNumber: string | null): string | null {
  if (!vendorName || !articleNumber) return null;
  return `${vendorName.toLowerCase().replace(/\s+/g, "_")}:${articleNumber}`;
}
