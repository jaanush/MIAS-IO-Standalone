# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

(no open items — FR-019 + FR-019 follow-up + FR-020 + FR-021 closed
2026-05-02 via NOTIF-026 round-trip; FR-022 closed 2026-05-03 via
NOTIF-028 round-trip; FR-023 closed 2026-05-04 via NOTIF-029 round-trip
— per-instance commissioning metadata `partId / variant / nodeId / networkId`
landed on `signals[].instance.commissioning` + `instanceUpdate` tRPC + UI;
LasseMaja's 7 Editron converters backfilled by componentName parsing
(4 dcdc + 2 mc + 2 afe). `nodeId` left null — operator must assign before
plugin's CommissioningRenderer walks them. FR-025 closed 2026-05-05 via
NOTIF-031 round-trip — Q1 (drop analog severity, use level convention),
Q2 (plugin-side eUnit alias table; LasseMaja distinct units listed),
Q3a/b (SF stays default-armed, IEC path stays by convention).
FR-026 closed 2026-05-05 via NOTIF-032 round-trip — Q1 (DAO α/β plugin's
call), Q2 (`exports/PLC/*` retired; consume API + JMobile XML), Q3
(emit unqualified), Q4 (4-symbol HMI contract `ab/axAlarm{Digital,Analogue}{State,Acks}HMI`),
Q5 (Param.gvl plugin-emitted from API counts), Q6 (suppression stays
empty), Q7 (Factory + Live PERSISTENT pattern; runtime HMI edits do not
propagate back to mias-io DB).)
