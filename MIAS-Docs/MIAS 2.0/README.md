# MIAS 2.0

The new PLC hardware management and code generation system.

## Components
- **MIAS-IO** — Web application (Next.js + tRPC + Prisma + PostgreSQL)
- **MIAS-Plugin** — CODESYS integration plugin (C#)
- **MIAS_Core** — PLC function block library (IEC 61131-3 ST)

## Contents

### Architecture
- [[Architecture/dependency-registry|Dependency Registry]] — non-obvious data relationships, enum sync chains, cascade impact
- [[Architecture/PMS Separation Principle|PMS Separation Principle]] — operation vs configuration, component self-management, setpoint-only PMS control
- [[Architecture/Self Regulating PMS Concept|Self-Regulating PMS Concept]] — priority-weighted power balancing, common component interface
- [[Architecture/CBM Lifecycle Pattern|CBM Lifecycle Pattern]] — CODESYS CBM (LConC) used by all MIAS_Core control FBs
- [[Architecture/Legacy vs New PMS Analysis|Legacy vs New PMS]] — gap analysis between Alveli and Lasse-Maja
- [[Architecture/Component Inventory and Feasibility Analysis|Component Inventory]] — what exists, what needs building, feasibility verdict
- [[Architecture/Outstanding Questions|Outstanding Questions]] — 21/21 resolved
- [[Architecture/Kreisel BMS CAN Protocol|Kreisel BMS Protocol]] — PT-CAN + P-CAN message maps from DBC files

### CODESYS Integration
- [[CODESYS Integration/codesys-api-contract|API Contract]] — authoritative spec for the REST API between MIAS-IO and MIAS-Plugin
- [[CODESYS Integration/pending-from-codesys|Pending from CODESYS]] — requests from the plugin team awaiting implementation
- [[CODESYS Integration/pending-for-codesys|Pending for CODESYS]] — requests from MIAS-IO awaiting plugin implementation

### DevTools
OPC UA bridge + mobile IO-check for commissioning. Live monitoring via WebSocket, IO-check with pass/fail tracking.

### Hardware Catalog
WAGO module and device catalog data, article numbers, specifications.

### Deployment
Coolify + Azure DevOps deployment, local Docker for commissioning.
