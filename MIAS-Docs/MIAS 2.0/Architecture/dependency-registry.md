# Data Dependency Registry

Consult this document before changing enums, schema fields, catalog data, or signal logic.
It maps non-obvious data relationships that span multiple files and layers.

---

## 1. Enum Sync Chain

Every enum value exists in **three places** that must stay in sync:

| Layer | File | Format |
|---|---|---|
| Database | `prisma/schema.prisma` | `enum BusProtocol { ... }` |
| TypeScript constants | `src/lib/enums.ts` | `export const BUS_PROTOCOLS = [...] as const` |
| Seed data / migrations | `prisma/migrations/*.sql`, `prisma/seed*.sql` | Raw string literals |

**Rule:** When adding/removing an enum value:
1. Add to Prisma enum in `schema.prisma`
2. Create migration with `ALTER TYPE ... ADD VALUE`
3. Add to the matching array in `enums.ts`
4. Search for hardcoded literals of that enum across the codebase

### Enum → Consumer Map

| enums.ts Constant | Prisma Enum | Zod Consumers (routers) | UI Consumers |
|---|---|---|---|
| `BUS_PROTOCOLS` | `BusProtocol` | hardware, projectHardware | DeviceForm, NetworkDetail |
| `SIGNAL_ORIGINS` | `SignalOrigin` | signal, components | AddEditSignalDialog |
| `SIGNAL_TYPES` | `SignalType` | signal | AddEditSignalDialog |
| `SIGNAL_DIRECTIONS` | `SignalDirection` | signal | AddEditSignalDialog |
| `IO_TYPES` | `IoType` | components | SignalGrid |
| `CARD_TYPES` | `IoCardType` | hardware | modules/layout (grouping) |
| `TRIGGER_TYPES` | `TriggerType` | signal, components | AddEditSignalDialog |
| `SWITCHING_TYPES` | `SwitchingType` | signal, components | AddEditSignalDialog |
| `WIRE_CONFIGS` | `WireConfig` | signal, components | AddEditSignalDialog |
| `RAW_DATA_TYPES` | `BusRawDataType` | signal, components | ProjectBusConfigDialog |
| `PLC_DATA_TYPES` | `PlcDataType` | signal, components | — (lookup table) |
| `MODBUS_REGISTER_TYPES` | `ModbusRegisterType` | signal, components | ProjectBusConfigDialog |
| `ALARM_SEVERITIES` | `AlarmSeverity` | signal, components | ProjectAlarmsDialog |
| `DISCRETE_ALARM_CONDITIONS` | `DiscreteAlarmCondition` | signal, components | ProjectAlarmsDialog |
| `ANALOG_ALARM_CONDITIONS` | `AnalogAlarmCondition` | signal, components | ProjectAlarmsDialog |
| `COMPONENT_STATUS` | `ComponentStatus` | components | ComponentDetail, ComponentCreateForm |
| `CATALOG_DEVICE_TYPES` | `CatalogDeviceType` | hardware | — |
| `PLC_SERIES` | — (varchar) | — | DeviceForm |
| `NETWORK_ROLES` | `NetworkRole` | projectHardware | NetworkDetail |
| `SERIAL_PARITY` | `SerialParity` | projectHardware | NetworkDetail |
| `CAN_MODES` | `CanMode` | projectHardware | NetworkDetail |
| `BYTE_ORDERS` | `ByteOrder` | signal, components | ProjectBusConfigDialog |
| `PDO_DIRECTIONS` | `PdoDirection` | — | — |
| `CODESYS_TASK_STATUSES` | `CodesysTaskStatus` | — | — |
| `USER_ROLES` | `UserRole` | user | admin/users |
| `PROJECT_STATUS` | `ProjectStatus` | project | admin/projects, project details |
| `MEMBER_ROLES` | `MemberRole` | project | — |
| `DIAGNOSTIC_TYPES` | `DiagnosticType` | hardware | ModuleForm |

### Known Hardcoded Enum Literals

All previously identified hardcoded literals have been fixed (BYTE_ORDERS, CATALOG_DEVICE_TYPES).
If you find new ones, add them here.

---

## 2. Catalog → Project Data Flow

### DeviceCatalog → Plc / IoCarrier

**Relationship:** FK reference only — no field copying.
Plc and IoCarrier store `catalogId` and access catalog specs via include/join at query time.

**Implication:** Changing DeviceCatalog fields (e.g. `maxModules`, `ethernetPorts`) instantly affects all PLCs/carriers referencing it.

### ModuleCatalog → IoCard

**Relationship:** Field snapshot at assignment time (`cardAssign` in projectHardware.ts:334-369).

Fields copied into IoCard at slot assignment:
- `cardType`, `maxInputChannels`, `maxOutputChannels`, `bitResolution`
- `supplyVoltageField`, `filterTimeMs`, `galvanicIsolation`, `isolationVoltageV`
- `tempMinC`, `tempMaxC`, `maxChannelCurrentMa`, `shortCircuitProtected`
- `providesNetwork`
- `hasDiagnostics`, `diagnosticType`, `diagnosticBitsPerChannel`

**Implication:** Changing ModuleCatalog does NOT update existing IoCards — they are frozen snapshots. New assignments will pick up the changes.

### Approval Chain

```
ModuleCatalogApproval / DeviceCatalogApproval
    ↓ (catalog declares what approvals it has)
ProjectApproval
    ↓ (project declares what approvals it requires)
modulesForProject / couplersForProject
    ↓ (filters: module must have ALL project-required approvals)
ModulePickerDialog / AddCarrierDialog
```

**Implication:** Adding a required approval to a project may hide previously-visible modules/couplers. Removing an approval from a catalog item may break existing project configurations.

---

## 3. Component Template → Project Signal Inheritance

```
HardwareComponent (global, projectId=NULL)
  └── ComponentSignal (template defaults: trigger, scale, EU, CAN addressing...)
        └── ComponentInstance (project-scoped, name, tag, canIdOffset, functionBlockOverride)
              └── InstanceSignal (templateDirty flag)
                    └── Signal (project-scoped, real data)
```

### Template Propagation Rules

| templateDirty | Behavior |
|---|---|
| `false` | Signal matches template. Component signal updates auto-propagate (components.ts signalUpsert). |
| `true` | Signal was manually edited. Propagation skipped. Revert button shown in UI. |

### What triggers `templateDirty = true`:
- Any field edit on a component-bound signal (signal.ts update, line 396-402)

### What resets `templateDirty = false`:
- `signalRevert` (signal.ts:635-707) — resets signal to template defaults + instance offsets
- `instanceRevert` (signal.ts) — batch revert all signals in an instance

### Instance-Level Overrides (do NOT set templateDirty)
These are on `ComponentInstance`, not individual signals:
- `canIdOffset` — added to every CAN ID in the instance
- `functionBlockOverride` — overrides component.functionBlock for CODESYS codegen

---

## 4. Signal Type Determines Child Table

```
Signal.signalType = "DISCRETE" → DiscreteSignal (1:1, FK enforced by trigger)
Signal.signalType = "ANALOG"   → AnalogSignal   (1:1, FK enforced by trigger)
```

### Alarm Routing (FK enforced)

```
DiscreteSignal → DiscreteAlarm (conditions: ON_TRIGGER, OFF_TRIGGER)
AnalogSignal   → AnalogAlarm   (conditions: HIGH, HIGH_HIGH, LOW, LOW_LOW)
```

**Implication:** Cannot change `signalType` after creation without deleting the child record and alarms.

---

## 5. Signal Origin Determines Available Fields

| Origin | Has ioCard? | Has busSignal? | Has plcAddress? |
|---|---|---|---|
| `IEC` | Yes | No | Yes (computed) |
| `INTERNAL` | No | No | No |
| All others | No | Yes | No |

**Valid bus signal origins** (derived from `SIGNAL_ORIGINS` minus `IEC` and `INTERNAL`):
`MODBUS_RTU, MODBUS_TCP, CANBUS, CANOPEN, J1939, PROFIBUS, PROFINET, ETHERNETIP, DEVICENET, BACNET`

Enforced in `projectHardware.ts` instanceCreate via `VALID_BUS_ORIGINS` set.

Note: `ETHERCAT`, `IO_LINK`, `INTERBUS`, `CC_LINK` are BUS_PROTOCOLS but NOT valid SignalOrigins.

---

## 6. Computed Values (Runtime Derivations)

### plcAddress (IEC signals only)

**Source:** `src/app/api/codesys/_address.ts`
**Duplicated in:** `src/scripts/generate-plc-exports.ts`

**Depends on:** `ioCard.slotPosition`, `ioCard.cardType`, `signal.channelPosition`, `signal.direction`, and preceding cards' channel counts in the same carrier.

**Format rules:**
- DI/DO: `%IX{byte}.{bit}` / `%QX{byte}.{bit}`
- AI/AO: `%IW{word}` / `%QW{word}`
- COUNTER: `%ID{dword}`
- MIXED: direction-dependent

### Alarm Function Block Selection

**Source:** `src/app/api/codesys/project/[id]/route.ts:259-267`

```
Priority:
1. signal.specialAlarmFb (if set)
2. signal.anaToDigAlarm → codesysSettings.fbAlarmDigital
3. signalType=DISCRETE → codesysSettings.fbAlarmDigital
4. signalType=ANALOG → codesysSettings.fbAlarmAnalogue
```

### Scaling Function Block Selection (analog only)

```
Priority:
1. analogSignal.useTankLevel → codesysSettings.fbTankLevel
2. analogSignal.scalingFbOverride (if set)
3. codesysSettings.fbAnalogScaling (default)
```

---

## 7. Hardcoded Defaults (Must Match Schema)

| Default Value | Used In | Context |
|---|---|---|
| `"IP20"` | hardware.ts (device/module input) | IP rating |
| `"BIG_ENDIAN"` | projectHardware.ts:529 | BusSignal byte order |
| `"BOOL"` | projectHardware.ts:527-528 | Discrete raw/plc data type |
| `"WORD"` / `"INT"` | projectHardware.ts:527-528 | Analog raw/plc data type |
| `"NO"` | signal.ts:83 | Discrete trigger type |
| `"DRAFT"` | components.ts:111 | Component status |
| `"ENGINEER"` | schema.prisma:290 | Default user role |
| `true` | schema (galvanicIsolation) | Module catalog default |
| `false` | schema (shortCircuitProtected, providesNetwork) | Module catalog defaults |

---

## 8. Cascade / Deletion Impact

| Parent Deleted | Cascade Behavior | Orphan Risk |
|---|---|---|
| `Plc` | Cascades to PlcNetwork, local IoCarrier | Networks + carriers + cards + signals deleted |
| `IoCarrier` | Cascades to IoCard | Cards + their signal references lost |
| `IoCard` | Signal.ioCardId becomes orphaned | Signals lose hardware binding |
| `DeviceCatalog` | No cascade | Plc/IoCarrier.catalogId becomes orphaned |
| `ModuleCatalog` | No cascade | IoCard.catalogId becomes orphaned |
| `EngineeringUnit` | No cascade | AnalogSignal.engineeringUnitId becomes NULL |
| `ComponentInstance` | Cascades to InstanceSignal | Signals remain; instanceSignalId becomes NULL |
| `HardwareComponent` | Cascades to ComponentSignal, ComponentInstance | All instances + instance signals deleted |
| `Signal` (data) | Cascades to diagnostic Signal children via `diagnosticParentId` | Diagnostic signals auto-deleted |

---

## 9. CODESYS API Contract Fields

These fields are promised to the MIAS-Plugin consumer. Do not rename or remove.

**Contract file:** `docs/codesys-api-contract.md`

| Field | Computed From | Breaking If Changed |
|---|---|---|
| `plcAddress` | cardType + slot + channel + direction | Yes |
| `alarmFb` | signalType + specialAlarmFb + codesysSettings | Yes |
| `scalingFb` | useTankLevel + scalingFbOverride + codesysSettings | Yes |
| `fbNameOverride` | signal.fbNameOverride | Yes |
| `inputType` | analogSignal.inputType.code | Yes |
| `engineeringUnit` | analogSignal.engineeringUnit.symbol | Yes |
| `isDiagnostic` | signal.isDiagnostic | No (additive) |
| `diagnosticParentId` | signal.diagnosticParentId | No (additive) |
| `hasDiagnostics` | ioCard.hasDiagnostics (card level) | No (additive) |
| `diagnosticType` | ioCard.diagnosticType (card level) | No (additive) |
| `diagnosticBitsPerChannel` | ioCard.diagnosticBitsPerChannel (card level) | No (additive) |

---

## 10. Cross-File Search Checklist

When changing any of these, search for all occurrences:

| Change | Search Pattern | Files to Check |
|---|---|---|
| Add/remove enum value | Enum name + string literal | schema.prisma, enums.ts, migrations, seed files, routers, UI components |
| Rename a schema field | Old field name | routers (Zod + Prisma), UI forms, API routes, plc_schema.sql views |
| Change a default value | The literal string/number | Schema defaults, router defaults, form defaultValues |
| Delete a catalog record | catalogId references | Check if any Plc/IoCarrier/IoCard references it |
| Add a project approval | Approval ID | May filter out modules/couplers from existing projects |
| Change componentSignal | componentSignalId | InstanceSignals + bound Signals (propagation if !templateDirty) |
| Modify plcAddress logic | `_address.ts` patterns | Also in `generate-plc-exports.ts` (duplicate logic) |

---

## 11. Known Stale Artifacts

| Artifact | Issue | Impact |
|---|---|---|
| `plc_schema.sql` views (`v_project_signals`) | Filters on `deleted_at IS NULL` for plc, io_carrier, io_card | Views not used by app code (Prisma queries used). Safe to ignore unless views are applied to DB. |
| `prisma/schema.prisma` Plc/IoCarrier/IoCard | `deletedAt` columns still defined but code uses hard delete (`.delete()`) | Vestigial columns — CLAUDE.md says "soft delete was removed" but columns remain. Consider dropping in a future migration. |
| `PLC_SERIES` enum | "Edge Controller" defined in enums.ts but zero matching devices in seed data | UI shows the option but no catalog devices match. Add seed data or remove from enum when appropriate. |
