# WAGO 750-658 CAN Gateway — Protocol Types and Configuration

## Overview

The **WAGO 750-658** is a CAN Gateway I/O module for the WAGO 750 Series I/O System. It connects a CAN bus network to the WAGO PLC backplane, operating independently of the host controller's primary fieldbus. The module acts as a PLC-side interface, not a standalone master — the CODESYS/WAGO PLC application manages all higher-level CAN protocol logic via function blocks.

**Physical specs:**
- Width: 12 mm (DIN-35 rail mount)
- Dimensions: 12 × 100 × 67.8 mm
- IP rating: IP20
- Operating temperature: 0°C to +55°C (standard); –40°C to +70°C for the **750-658/040-000** XTR (eXTReme) variant
- System supply: 5 V DC via WAGO backplane data contacts (50 mA)
- Field supply: 24 V DC (12 mA no-load)
- Isolation: 500 V peak (system/field supply)
- Connections: 7 × CAGE CLAMP spring terminals

**CAN physical interface:**
- CAN H, CAN L, CAN Shield/GND
- Termination: external 120 Ω resistor required at line ends (not built-in)
- CAN specification compliance: ISO 11898, CAN 2.0A (11-bit identifier), CAN 2.0B (29-bit identifier)

**Variants:**
| Part number | Description |
|---|---|
| 750-658 | Standard (light gray), 0°C to +55°C |
| 750-658/040-000 | XTR Extreme (dark gray), –40°C to +70°C |

---

## Supported CAN Protocol Types

The 750-658 operates natively at **CAN Layer 2** (raw CAN frames). It does not natively implement any higher-layer protocol in hardware. All higher-layer protocol support — CANopen, SAE J1939, DeviceNet — is implemented in PLC software via CODESYS function block libraries. The module is therefore a protocol-agnostic CAN transceiver/gateway from the hardware perspective.

Supported higher-layer protocols (via CODESYS FBs):

| Protocol | Standard | Identifier format | Typical use |
|---|---|---|---|
| Raw CAN Layer 2 | ISO 11898 / CAN 2.0A+B | 11-bit or 29-bit | Custom/proprietary messaging |
| CANopen | CiA 301/305 | 11-bit (2.0A) | Industrial automation device networks |
| SAE J1939 | SAE J1939 | 29-bit (2.0B) | Heavy vehicles, mobile machinery |
| DeviceNet | ODVA DeviceNet | 11-bit (2.0A) | Factory automation I/O |

---

## Operating Modes

The module has three mutually exclusive operating modes, selected via WAGO-IO-Check configuration tool or by the `CAN_FullConfig` CODESYS function block at startup.

### 1. Sniffer Mode

Passive listen-only mode. The CAN transmitter is **disabled in hardware** — the module cannot send any frames and cannot affect bus arbitration or acknowledge frames. All received CAN telegrams are forwarded to the PLC controller via the internal "Mailbox 2.0" transmission protocol.

**Use case:** Bus analysis, diagnostics, capturing traffic without interfering with the network.

**Configuration parameters:**
- Baud rate (fixed or auto-detect)
- Up to 6 receive filters (by CAN identifier range)
- Process image size (8–48 bytes)

### 2. Transparent Mode

Active mode. The CAN transmitter is **enabled**. The module participates as a normal CAN node and can both send and receive arbitrary CAN frames. The PLC application uses CODESYS function blocks to exchange frames.

**Use case:** Implementing any higher-layer protocol (CANopen, J1939, DeviceNet, raw CAN) entirely in PLC software. Most flexible mode.

**Key function blocks:**
- `CAN_FullConfig` — full runtime configuration of the module
- `CAN_Communication` — general send/receive control
- `CAN_L2_RX_11Bit_Frame` — receive a single standard (11-bit) CAN frame
- `CAN_L2_TX_11Bit_Frame` — transmit a single standard (11-bit) CAN frame
- `CAN_CIA405_NMT` — send CANopen NMT commands (e.g., set slave to Operational)
- `CAN_CIA_SDO_WRITE4` — write to a CANopen device's object dictionary via SDO

One FB instance is required per PDO/message object.

**Configuration parameters:**
- Baud rate
- CAN identifier (11-bit or 29-bit per frame)
- Up to 6 receive filters
- Process image size
- Mailbox length (2–6 bytes for best throughput)

### 3. Mapped Mode

The module autonomously generates and consumes CAN telegrams based on **mapping rules** configured statically. Data flows directly between the CAN bus and the PLC process image with no FB execution overhead per scan cycle.

**Use case:** Simple, deterministic I/O exchange without complex protocol handling in PLC code. Best throughput for fixed message sets.

**Transmission triggers (per mapped message):**
- Cyclic (time-based)
- Event-triggered (on change of process value)
- Manual (explicit trigger from PLC)

**Configuration parameters:**
- Baud rate
- CAN identifier per mapping rule (11-bit or 29-bit)
- Data byte mapping (which bytes in process image map to which bytes in CAN frame)
- Transmission trigger type and cycle time
- Process image size (8, 12, 16, 20, 24, 32, 40, or 48 bytes)
- Toggle byte (fixed component of mapped mode process image)
- Up to 6 receive filters

**Configuration tool:** WAGO-IO-Check (offline), or `CAN_FullConfig` + `CAN_Communication` FBs at runtime.

---

## Baud Rate Configuration

The module supports the following CAN baud rates:

| Setting | Rate |
|---|---|
| Fixed | 10 kbit/s |
| Fixed | 20 kbit/s |
| Fixed | 50 kbit/s |
| Fixed | 125 kbit/s |
| Fixed | 250 kbit/s |
| Fixed | 500 kbit/s |
| Fixed | 800 kbit/s |
| Fixed | 1000 kbit/s (1 Mbit/s) |
| Auto | Auto Baud Rate detection |

Auto Baud Rate passively listens to determine the bus rate before joining. All nodes on a CAN segment must use the same baud rate — this is a physical layer requirement, not specific to this module.

**Note for XTR variant (750-658/040-000):** Maximum supported baud rate is 800 kbit/s (not 1 Mbit/s).

---

## Protocol-Specific Configuration Parameters

### Raw CAN Layer 2

No higher-layer configuration. Parameters are entirely in the mapping rules or FB calls:

- **CAN identifier:** 11-bit (2.0A standard frame) or 29-bit (2.0B extended frame)
- **Data length code (DLC):** 0–8 bytes per frame
- **Frame type:** Data frame or Remote frame
- **Receive filters:** up to 6 identifier-based pass-through filters (identifier + mask)

### CANopen (CiA 301/305)

Implemented via CODESYS CANopen libraries on top of the transparent or mapped mode. The 750-658 acts as a **CANopen master or slave** depending on the PLC application.

| Parameter | Description |
|---|---|
| Node ID | 1–127; unique per device on the network |
| Baud rate | Must match all nodes; typically 125, 250, or 500 kbit/s |
| PDO (Process Data Object) | Cyclic or event-driven real-time data exchange; up to 512 PDOs per device |
| PDO COB-ID | Derived from node ID by default (e.g., TPDO1 = 0x180 + Node-ID); configurable |
| PDO mapping | Which object dictionary entries are packed into each PDO |
| PDO transmission type | 0 (acyclic sync), 1–240 (every N SYNC), 254–255 (event/RTR driven) |
| SDO (Service Data Object) | Acyclic read/write to object dictionary; used for configuration |
| SYNC message | Broadcast at configurable interval; COB-ID 0x080 by default |
| Heartbeat | Node sends heartbeat at configured interval; master monitors |
| NMT state machine | Initializing → Pre-Operational → Operational → Stopped |
| Emergency (EMCY) | COB-ID 0x080 + Node-ID; error codes per CiA 301 |
| LSS (Layer Setting Services) | Optional; used to assign Node-ID and baud rate dynamically |

**CODESYS FBs used:**
- `CAN_CIA405_NMT` — NMT master commands (Start, Stop, Pre-Op, Reset)
- `CAN_CIA_SDO_WRITE4` — SDO write to slave object dictionary (4-byte values)
- Standard PDOs handled via `CAN_L2_RX/TX_11Bit_Frame` or mapped mode

### SAE J1939

J1939 uses 29-bit extended CAN frames exclusively. Implemented in CODESYS via J1939 library on top of transparent mode.

| Parameter | Description |
|---|---|
| Source Address (SA) | 0–253; unique per Controller Application (CA) on the network |
| NAME (64-bit) | Unique device identity for address claiming (industry group, device class, instance, manufacturer code, identity number) |
| Address Claim (ACL) | PGN 0x00EE00 (60928); each CA broadcasts NAME + SA on power-up; arbitrated by NAME value |
| PGN (Parameter Group Number) | 18-bit group identifier embedded in 29-bit CAN ID; defines message content/type |
| Priority | 3-bit field (0=highest, 7=lowest) in 29-bit CAN ID |
| Destination Address (DA) | Peer-to-peer PGs include DA; broadcast PGs use DA=0xFF |
| Baud rate | J1939 standard: 250 kbit/s; 500 kbit/s and 1 Mbit/s used in some vehicle segments |
| Data length | 0–8 bytes per frame (single frame); multi-packet via Transport Protocol (TP, PGN 0xEC00/0xEB00) |
| Request PGN | PGN 0x00EA00; any CA can request another CA to transmit a specific PGN |
| Diagnostic trouble codes (DTC) | PGN 0x00FECA (DM1 active faults), PGN 0x00FECB (DM2 previously active) |

**CODESYS FBs used:**
- `CAN_L2_TX/RX` with 29-bit frame support (transparent mode)
- WAGO community examples show manual construction of 29-bit COB-IDs embedding priority, PGN, DA, and SA fields

### DeviceNet

DeviceNet uses 11-bit CAN identifiers with a specific message group structure (Groups 1–4). Implemented via CODESYS DeviceNet library on top of transparent mode.

| Parameter | Description |
|---|---|
| MAC ID (Node address) | 0–63; unique per device |
| Baud rate | 125, 250, or 500 kbit/s (DeviceNet standard rates only) |
| I/O messaging (Group 2) | Polled, Strobe, Change-of-State (COS), Cyclic |
| Explicit messaging (Group 3) | Acyclic read/write to device attributes via connection objects |
| Connection ID | Derived from MAC ID and message group (e.g., Master Out/Slave In = 0x000 + MAC ID) |
| Duplicate MAC check | Performed at startup using Group 3 unconnected messages |
| Object model | Identity (0x01), Message Router (0x02), DeviceNet (0x03), Connection (0x05) |

---

## Receive Filters

All three operating modes support up to **6 configurable pass-through filters** on received CAN frames. Each filter specifies:

- CAN identifier (11-bit or 29-bit)
- Mask (which bits to match)

Only frames matching at least one filter pass to the PLC process image/mailbox. Unmatched frames are silently discarded. This reduces bus load on the controller side and limits interrupt frequency.

---

## Process Image and Mailbox

The module occupies a configurable portion of the WAGO local bus process image:

**Process image size options:** 8, 12, 16, 20, 24, 32, 40, or 48 bytes

**Structure:**
- First byte (output direction): Control byte
- First byte (input direction): Status byte
- Mailbox: static section of the process image; used in transparent and sniffer modes to pass raw CAN frames between module and PLC
- Mailbox length: 2–6 bytes (shorter = higher throughput)
- Toggle byte: fixed component in mapped mode

**Register communication:** Setting bit 7 of the control byte activates register communication mode, exposing 64 internal registers (each 2 bytes = WORD) for advanced configuration. This is used by `CAN_FullConfig`.

---

## Protocol Coexistence on the Same Physical CAN Bus

### Hardware constraint: one baud rate per segment

All nodes on a single CAN segment must run at the **same baud rate**. This is a physical-layer requirement that applies regardless of which higher-layer protocols are in use.

### Multiple higher-layer protocols on one bus: technically possible but complex

Since CAN is a shared broadcast medium with arbitration based on CAN identifiers, different higher-layer protocols can technically coexist if their identifier spaces do not collide:

| Protocol pair | Coexistence feasibility |
|---|---|
| CANopen + Raw CAN L2 | Straightforward — use identifier ranges outside CANopen reserved space |
| J1939 + Raw CAN L2 | Possible — J1939 uses 29-bit IDs; raw L2 can use 11-bit IDs on same bus |
| CANopen + J1939 | Possible but unusual — CANopen uses 11-bit; J1939 uses 29-bit; no identifier collision possible, but CAN nodes must accept both frame formats (2.0B passive OK for 11-bit nodes) |
| CANopen + DeviceNet | Generally not recommended — both use 11-bit IDs; DeviceNet MAC ID 0–63 CAN identifier ranges overlap with CANopen node IDs; careful identifier assignment required |
| J1939 + DeviceNet | Possible — different ID lengths; bus load management required |

### Practical limitation: the 750-658 has a single CAN port

The module has **one CAN port**. It cannot act as a protocol bridge or gateway between two different CAN segments. It connects one CAN segment to the WAGO backplane. To run, say, CANopen master and J1939 simultaneously, both are handled by the same PLC application communicating over the single shared CAN bus through this one module.

### WAGO's position

WAGO documentation states the 750-658 "can be integrated into a CANopen, SAE-J1939 or DeviceNet network by using CoDeSys function blocks." The phrasing implies **one higher-layer protocol per deployment** is the intended use case. Running mixed protocols on the same bus through this module is possible at the CAN layer but requires the PLC application to fully manage identifier arbitration and protocol demultiplexing in software — WAGO provides no pre-built mixed-protocol library for this.

---

## Configuration Tools and Workflow

| Tool | Purpose |
|---|---|
| **WAGO-IO-Check** | GUI-based offline/online configuration of operating mode, baud rate, process image size, filters, and mapping rules. Writes configuration to module non-volatile memory. |
| **CODESYS IEC 61131-3** | Runtime configuration via `CAN_FullConfig` and `CAN_Communication` FBs. Overrides static WAGO-IO-Check config on each PLC startup if used. |
| **CAN_FullConfig** | Full module configuration from PLC code (mode, baud rate, filters, mailbox) |
| **CAN_Communication** | General communication control FB |
| **CAN_L2_RX_11Bit_Frame** | Receive one standard CAN frame in transparent mode |
| **CAN_L2_TX_11Bit_Frame** | Transmit one standard CAN frame in transparent mode |
| **CAN_CIA405_NMT** | CANopen NMT master commands |
| **CAN_CIA_SDO_WRITE4** | CANopen SDO write (4 bytes) to slave object dictionary |

Configuration can be stored in module non-volatile memory (via WAGO-IO-Check) or applied at every PLC startup by the application code.

---

## Limitations and Notes

1. **Single CAN port** — one module, one CAN segment. To connect multiple CAN segments, use multiple 750-658 modules.
2. **No built-in CANopen master stack** — CANopen master/slave logic lives entirely in CODESYS. The module is a CAN transceiver only.
3. **No built-in J1939 address claiming** — PLC application must implement the address claim procedure (PGN 0x00EE00 arbitration) in software.
4. **Auto baud rate detection** is passive: module listens until it detects valid frames. It cannot transmit until baud rate is locked. Use fixed baud rate in production for deterministic startup.
5. **XTR variant (750-658/040-000)** top baud rate is 800 kbit/s, not 1 Mbit/s.
6. **Termination:** The module has no built-in bus termination resistor. A 120 Ω resistor must be added externally at each end of the CAN trunk cable.
7. **Sniffer mode** does not send ACK bits — this means CAN nodes sending frames will see "no acknowledgement" errors if the 750-658 in sniffer mode is the only receiver. This can cause error frames on the bus if no other active node is present.
8. **Process image size** must be large enough to accommodate all mapped PDOs plus the control/status byte and mailbox. Size is configured once and affects local bus bandwidth allocation.

---

## References

- [WAGO 750-658 Product Page (Global)](https://www.wago.com/global/i-o-systems/can-gateway/p/750-658)
- [WAGO 750-658/040-000 XTR Product Page](https://www.wago.com/global/i-o-systems/can-gateway/p/750-658_040-000)
- [WAGO 750-658 Manual (ManualsLib)](https://www.manualslib.com/manual/1948122/Wago-750-658.html)
- [WAGO 750-658 Application Note (ManualsLib)](https://www.manualslib.com/manual/2686785/Wago-750-658.html)
- [WAGO 750-658 Datasheet (Conrad/PDF)](https://asset.conrad.com/media10/add/160267/c1/-/en/001923969DS01/datasheet-1923969-wago-wago-gmbh-co-kg-can-gateway-pre-plc-750-658-1-ks.pdf)
- [WAGO Community: J1939 with 750-658](https://www.wago.community/t/j1939-with-750-658/944)
- [WAGO Community: 750-658 with CANopen Slave Device](https://www.wago.community/t/750-658-working-with-can-open-slave-device/2149)
- [CODESYS Forge: Using the WAGO 750-658 CAN Gateway](https://forge.codesys.com/forge/talk/Runtime/thread/2f09a6be3b/)
- [Control Design: WAGO 750-658 CAN Layer 2 Overview](https://www.controldesign.com/vendors/products/2014/wago-750-658-can-io-gateway-module-supports-can-layer-2/)
- [CANopen vs J1939 coexistence discussion](https://www.gridconnect.com/blogs/news/can-higher-layer-protocols-qa)
