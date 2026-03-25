# Notifications for CODESYS Agent

Items here are updates from MIAS-IO that the CODESYS agent should read and act on.
Once acknowledged, remove the entry.

---

## Component/Instance references on signals — 2026-03-13

The project export (`GET /api/codesys/project/{id}`) now includes an `instance` field
on each signal. When a signal is bound to a component instance, you get:

```json
"instance": {
  "id": 42,
  "tag": "861-G01",
  "name": "Diesel Genset",
  "componentId": 7,
  "componentName": "ComAP Genset Controller"
}
```

`instance` is `null` for signals without an instance binding.

**For items #6 (GVL_Modbus struct generation) and #8 (GVL_BATT extra declarations):**
These are plugin responsibilities. Use the `componentId` from the export to look up
the associated function block name in the plugin's own database. MIAS-IO provides
the component reference; the plugin handles FB lookup and code structure.

---

## Hardware identifiers added — 2026-03-24

MIAS-IO now uses **stable hardware identifiers** in format `N{cabinet}:D{carrier}:{typeCode}{instance}` (e.g. `N3:D03:BM01`). These identifiers survive hardware deletion/recreation.

### New fields on signals

Each signal now includes a `hwId` field (string or null):

```json
{
  "id": 100,
  "hwId": "N3:D01:I01",
  "ioCard": { ... },
  ...
}
```

- `hwId` is present when the signal has hardware identifier fields set
- `hwId` persists even when `ioCard` is `null` (hardware was deleted but identifier survives)
- When both `hwId` and `ioCard` are present, the signal is actively bound to hardware
- When `hwId` is set but `ioCard` is null, the signal is **unbound** (hardware was removed, awaiting rebind)

### New fields on carriers

```json
{
  "id": 30,
  "name": "Local Bus",
  "cabinetNumber": 3,
  "carrierNumber": 1,
  ...
}
```

`cabinetNumber` (1-9) and `carrierNumber` (1-99) are nullable — null means not yet assigned.

### New fields on cards

```json
{
  "id": 40,
  "slotPosition": 0,
  "cardType": "DI",
  "typeCode": "I",
  "instanceNumber": 1,
  ...
}
```

`typeCode` (single char A-Z) and `instanceNumber` (1-99) are nullable. The type code maps card types to letter groups: SUPPLY=A-D, SERIAL=E-H, DI=I-L, DO=M-P, AI=Q-T, AO=U-X.

### Impact on plugin

- **No breaking changes** — all existing fields remain unchanged. These are additive fields.
- `slotPosition` still exists and is still used for PLC address computation. The new identifiers are for human-readable reference and stable binding.
- The plugin can use `hwId` for display/logging but does not need to use it for hardware configuration (CODESYS still uses slot position for device tree building).

---

## Network/Bus model restructured — 2026-03-25

The hardware data model has been restructured. **No breaking API changes** — all existing
contract fields are unchanged. But new data is available if needed.

### What changed internally

1. **IP Networks** are now separate from Buses.
   - `IpNetwork` = Ethernet infrastructure (subnet CIDR, gateway, DNS)
   - `Bus` = protocol-specific communication (MODBUS_TCP, CANBUS, etc.)
   - A Bus can link to an IpNetwork via `ipNetworkId`

2. **BusNodes** replace the old direct PLC→Bus binding.
   - `BusNode` is a join table: `{ busId, plcId?, carrierId?, role, nodeAddress }`
   - PLCs and carriers connect to buses via BusNodes (role: SERVER or CLIENT)
   - The old `Bus.plcId` field has been dropped

3. **Ports** now reference IpNetwork instead of Bus.
   - `PlcPort.ipNetworkId` and `CarrierPort.ipNetworkId`

### What's NOT changed (existing API)

- `GET /api/codesys/project/:id` signals still return `networkId` and `networkProtocol`
- `GET /api/codesys/project/:id/hardware` PLCs, carriers, cards structured the same
- `GET /api/codesys/project/:id/gvl/:gvlId` GVL generation unchanged

### New data available (not yet in API)

If the plugin needs any of these, request via `docs/pending-from-codesys.md`:

- **IP Network details** per bus (subnet, gateway, DNS) — for auto-configuring Ethernet adapters
- **BusNode topology** — which PLCs/carriers are on which bus, with roles and node addresses
- **Port assignments** — which PLC/carrier port connects to which IP Network
