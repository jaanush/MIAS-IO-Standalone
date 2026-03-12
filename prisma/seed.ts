import { PrismaClient, IoCardType } from "@prisma/client";

const prisma = new PrismaClient();

type ModuleInput = {
  vendorName: string;
  articleNumber: string;
  description?: string;
  cardType: IoCardType;
  maxInputChannels?: number;
  maxOutputChannels?: number;
  bitResolution?: number;
  supplyVoltageField?: string;
  filterTimeMs?: number;
  galvanicIsolation?: boolean;
  isolationVoltageV?: number;
  tempMinC?: number;
  tempMaxC?: number;
  maxChannelCurrentMa?: number;
  shortCircuitProtected?: boolean;
  providesNetwork?: boolean;
  ipRating?: string;
  moduleWidthMm?: number;
  signalRange?: string;
  busCurrentConsumptionMa?: number;
  fieldCurrentConsumptionMa?: number;
  approvals?: string; // legacy — ignored on create (use approval join table)
  conversionTimeMs?: number;
  notes?: string;
};

// WAGO 750 Series — verified from wago.com datasheets
// Width: 6 mm (2-ch standard DI/DO) or 12 mm (4/8-ch, analog, relay, supply, comms)
// busCurrentConsumptionMa  = drawn from coupler's internal 5 V backplane bus
// fieldCurrentConsumptionMa = drawn from 24 V DC field supply
const modules: ModuleInput[] = [
  // ───────────────────────────────────────────────
  // DIGITAL INPUT
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-400",
    description: "2-Channel Digital Input, 24 VDC, 3 ms",
    cardType: "DI", maxInputChannels: 2, supplyVoltageField: "24 VDC",
    filterTimeMs: 3, galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 6,
    signalRange: "24 VDC", busCurrentConsumptionMa: 5,
    fieldCurrentConsumptionMa: 4, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-401",
    description: "2-Channel Digital Input, 24 VDC, 0.1 ms",
    cardType: "DI", maxInputChannels: 2, supplyVoltageField: "24 VDC",
    filterTimeMs: 0.1, galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 6,
    signalRange: "24 VDC", busCurrentConsumptionMa: 5,
    fieldCurrentConsumptionMa: 4, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-402",
    description: "4-Channel Digital Input, 24 VDC, 3 ms",
    cardType: "DI", maxInputChannels: 4, supplyVoltageField: "24 VDC",
    filterTimeMs: 3, galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 6,
    signalRange: "24 VDC", busCurrentConsumptionMa: 5,
    fieldCurrentConsumptionMa: 8, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-403",
    description: "8-Channel Digital Input, 24 VDC, 3 ms",
    cardType: "DI", maxInputChannels: 8, supplyVoltageField: "24 VDC",
    filterTimeMs: 3, galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 16, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-408",
    description: "2-Channel Digital Input, 120 VAC, 10 ms",
    cardType: "DI", maxInputChannels: 2, supplyVoltageField: "120 VAC",
    filterTimeMs: 10, galvanicIsolation: true, isolationVoltageV: 1500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "120 VAC", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 4, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-409",
    description: "2-Channel Digital Input, 230 VAC, 10 ms",
    cardType: "DI", maxInputChannels: 2, supplyVoltageField: "230 VAC",
    filterTimeMs: 10, galvanicIsolation: true, isolationVoltageV: 1500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "230 VAC", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 4, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-410",
    description: "2-Channel Digital Input, NAMUR IEC 60947-5-6",
    cardType: "DI", maxInputChannels: 2, supplyVoltageField: "8.2 VDC",
    filterTimeMs: 3, galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "8.2 VDC (NAMUR)", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 10, approvals: "CE, UL, ATEX",
    notes: "NAMUR IEC 60947-5-6; suitable for hazardous areas",
  },
  {
    vendorName: "Wago", articleNumber: "750-412",
    description: "2-Channel Digital Input, 48 VDC, 3 ms",
    cardType: "DI", maxInputChannels: 2, supplyVoltageField: "48 VDC",
    filterTimeMs: 3, galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "48 VDC", busCurrentConsumptionMa: 5,
    fieldCurrentConsumptionMa: 4, approvals: "CE, UL",
  },

  // ───────────────────────────────────────────────
  // DIGITAL OUTPUT — transistor
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-501",
    description: "2-Channel Digital Output, 24 VDC, 0.5 A",
    cardType: "DO", maxOutputChannels: 2, supplyVoltageField: "24 VDC",
    galvanicIsolation: false, maxChannelCurrentMa: 500,
    shortCircuitProtected: true,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 6,
    signalRange: "24 VDC, 0.5 A", busCurrentConsumptionMa: 5,
    fieldCurrentConsumptionMa: 10, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-502",
    description: "4-Channel Digital Output, 24 VDC, 0.5 A",
    cardType: "DO", maxOutputChannels: 4, supplyVoltageField: "24 VDC",
    galvanicIsolation: false, maxChannelCurrentMa: 500,
    shortCircuitProtected: true,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 6,
    signalRange: "24 VDC, 0.5 A", busCurrentConsumptionMa: 5,
    fieldCurrentConsumptionMa: 20, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-504",
    description: "4-Channel Digital Output, 24 VDC, 2 A",
    cardType: "DO", maxOutputChannels: 4, supplyVoltageField: "24 VDC",
    galvanicIsolation: false, maxChannelCurrentMa: 2000,
    shortCircuitProtected: true,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC, 2 A", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 80, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-506",
    description: "2-Channel Digital Output, 24 VDC, 0.5 A, with Diagnostics",
    cardType: "DO", maxOutputChannels: 2, supplyVoltageField: "24 VDC",
    galvanicIsolation: false, maxChannelCurrentMa: 500,
    shortCircuitProtected: true,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC, 0.5 A", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 10, approvals: "CE, UL, ATEX",
    notes: "Per-channel wire-break and short-circuit diagnostics",
  },
  {
    vendorName: "Wago", articleNumber: "750-509",
    description: "8-Channel Digital Output, 24 VDC, 0.5 A",
    cardType: "DO", maxOutputChannels: 8, supplyVoltageField: "24 VDC",
    galvanicIsolation: false, maxChannelCurrentMa: 500,
    shortCircuitProtected: true,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC, 0.5 A", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 40, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-513",
    description: "2-Channel Digital Output, 230 VAC, 0.3 A (Triac)",
    cardType: "DO", maxOutputChannels: 2, supplyVoltageField: "230 VAC",
    galvanicIsolation: true, isolationVoltageV: 1500,
    maxChannelCurrentMa: 300, shortCircuitProtected: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "230 VAC, 0.3 A (Triac)", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 10, approvals: "CE, UL",
  },

  // ───────────────────────────────────────────────
  // RELAY OUTPUT
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-516",
    description: "2-Channel Relay Output, 250 VAC / 30 VDC, 2 A",
    cardType: "RELAY", maxOutputChannels: 2, supplyVoltageField: "24 VDC (coil)",
    galvanicIsolation: true, isolationVoltageV: 2500,
    maxChannelCurrentMa: 2000, shortCircuitProtected: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "250 VAC / 30 VDC, 2 A", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 40, approvals: "CE, UL, ATEX",
    notes: "SPDT contacts; mechanical lifetime 10 M ops",
  },
  {
    vendorName: "Wago", articleNumber: "750-517",
    description: "2-Channel Relay Output, 250 VAC / 30 VDC, 2 A, with Feedback",
    cardType: "RELAY", maxOutputChannels: 2, supplyVoltageField: "24 VDC (coil)",
    galvanicIsolation: true, isolationVoltageV: 2500,
    maxChannelCurrentMa: 2000, shortCircuitProtected: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "250 VAC / 30 VDC, 2 A", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 40, approvals: "CE, UL, ATEX",
    notes: "Relay feedback contact monitoring",
  },
  {
    vendorName: "Wago", articleNumber: "750-519",
    description: "4-Channel Relay Output, 250 VAC / 30 VDC, 1 A",
    cardType: "RELAY", maxOutputChannels: 4, supplyVoltageField: "24 VDC (coil)",
    galvanicIsolation: true, isolationVoltageV: 2500,
    maxChannelCurrentMa: 1000, shortCircuitProtected: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "250 VAC / 30 VDC, 1 A", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 60, approvals: "CE, UL",
  },

  // ───────────────────────────────────────────────
  // ANALOG INPUT
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-452",
    description: "2-Channel Analog Input, 4–20 mA, 12-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "4–20 mA", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 25, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-453",
    description: "2-Channel Analog Input, 0–20 mA, 12-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–20 mA", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 25, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-454",
    description: "2-Channel Analog Input, 0–10 V, 12-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–10 V", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 5, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-455",
    description: "4-Channel Analog Input, 4–20 mA, 12-bit",
    cardType: "AI", maxInputChannels: 4, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "4–20 mA", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 50, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-456",
    description: "2-Channel Analog Input, ±10 V, 12-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "±10 V", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 5, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-457",
    description: "4-Channel Analog Input, 0–10 V, 12-bit",
    cardType: "AI", maxInputChannels: 4, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–10 V", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 10, approvals: "CE, UL, ATEX",
  },
  {
    vendorName: "Wago", articleNumber: "750-460",
    description: "2-Channel Analog Input, RTD (Pt100/Pt1000/Ni100/Ni1000), 16-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "Pt100 / Pt1000 / Ni100 / Ni1000",
    busCurrentConsumptionMa: 15, fieldCurrentConsumptionMa: 5,
    approvals: "CE, UL, ATEX", conversionTimeMs: 320,
    notes: "2- or 3-wire connection",
  },
  {
    vendorName: "Wago", articleNumber: "750-461",
    description: "2-Channel Analog Input, Thermocouple (J/K/T/E/N/R/S/B), 16-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "TC J/K/T/E/N/R/S/B",
    busCurrentConsumptionMa: 15, fieldCurrentConsumptionMa: 5,
    approvals: "CE, UL, ATEX", conversionTimeMs: 100,
    notes: "Internal cold-junction compensation",
  },
  {
    vendorName: "Wago", articleNumber: "750-462",
    description: "2-Channel Analog Input, 0–25 mA, 12-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–25 mA", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 25, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-465",
    description: "4-Channel Analog Input, 4–20 mA, 16-bit, Differential",
    cardType: "AI", maxInputChannels: 4, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "4–20 mA", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 50, approvals: "CE, UL, DNV GL",
    conversionTimeMs: 1,
    notes: "Differential inputs; wire-break detection; NAMUR NE43",
  },
  {
    vendorName: "Wago", articleNumber: "750-466",
    description: "4-Channel Analog Input, 0–10 V, 16-bit, Differential",
    cardType: "AI", maxInputChannels: 4, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–10 V", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 10, approvals: "CE, UL, DNV GL",
    conversionTimeMs: 1,
  },
  {
    vendorName: "Wago", articleNumber: "750-467",
    description: "4-Channel Analog Input, RTD (Pt100/Pt1000), 16-bit",
    cardType: "AI", maxInputChannels: 4, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "Pt100 / Pt1000",
    busCurrentConsumptionMa: 20, fieldCurrentConsumptionMa: 10,
    approvals: "CE, UL", conversionTimeMs: 100,
  },
  {
    vendorName: "Wago", articleNumber: "750-469",
    description: "4-Channel Analog Input, Thermocouple (J/K/T/E/N/R/S/B), 16-bit",
    cardType: "AI", maxInputChannels: 4, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "TC J/K/T/E/N/R/S/B",
    busCurrentConsumptionMa: 20, fieldCurrentConsumptionMa: 10,
    approvals: "CE, UL", conversionTimeMs: 100,
    notes: "Internal cold-junction compensation",
  },
  {
    vendorName: "Wago", articleNumber: "750-480",
    description: "2-Channel Analog Input, 0/4–20 mA, HART-capable, 16-bit",
    cardType: "AI", maxInputChannels: 2, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0/4–20 mA (HART 5/6/7)", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 25, approvals: "CE, UL",
    notes: "HART pass-through; requires HART-capable fieldbus coupler",
  },

  // ───────────────────────────────────────────────
  // ANALOG OUTPUT
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-550",
    description: "2-Channel Analog Output, 0–10 V, 12-bit",
    cardType: "AO", maxOutputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–10 V", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 15, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-552",
    description: "2-Channel Analog Output, 4–20 mA, 12-bit",
    cardType: "AO", maxOutputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "4–20 mA", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 20, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-553",
    description: "2-Channel Analog Output, 0–20 mA, 12-bit",
    cardType: "AO", maxOutputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–20 mA", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 20, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-554",
    description: "2-Channel Analog Output, ±10 V, 12-bit",
    cardType: "AO", maxOutputChannels: 2, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "±10 V", busCurrentConsumptionMa: 15,
    fieldCurrentConsumptionMa: 15, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-556",
    description: "4-Channel Analog Output, 4–20 mA, 12-bit",
    cardType: "AO", maxOutputChannels: 4, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "4–20 mA", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 40, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-557",
    description: "4-Channel Analog Output, 0–10 V, 12-bit",
    cardType: "AO", maxOutputChannels: 4, bitResolution: 12,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0–10 V", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 30, approvals: "CE, UL",
  },
  {
    vendorName: "Wago", articleNumber: "750-585",
    description: "2-Channel Analog Output, 0/4–20 mA, HART-capable, 16-bit",
    cardType: "AO", maxOutputChannels: 2, bitResolution: 16,
    supplyVoltageField: "24 VDC",
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "0/4–20 mA (HART 5/6/7)", busCurrentConsumptionMa: 20,
    fieldCurrentConsumptionMa: 25, approvals: "CE, UL",
    notes: "HART pass-through",
  },

  // ───────────────────────────────────────────────
  // COUNTER / ENCODER
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-404",
    description: "1-Channel Counter Input, 24 VDC, 100 kHz",
    cardType: "COUNTER", maxInputChannels: 1,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC, 0–100 kHz", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 5, approvals: "CE, UL",
    notes: "32-bit up/down counter; A/B/Z quadrature encoder support",
  },
  {
    vendorName: "Wago", articleNumber: "750-638",
    description: "1-Channel Incremental Encoder Interface, 24 VDC, 250 kHz",
    cardType: "COUNTER", maxInputChannels: 1,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "A/B/Z 24 VDC, 0–250 kHz", busCurrentConsumptionMa: 10,
    fieldCurrentConsumptionMa: 10, approvals: "CE, UL",
    notes: "Quadrature A/B/Z; 32-bit counter; zero-pulse reference",
  },

  // ───────────────────────────────────────────────
  // SERIAL COMMUNICATION
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-650",
    description: "RS-232 Serial Interface Module",
    cardType: "SERIAL", maxInputChannels: 1,
    galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "RS-232, up to 115200 baud",
    busCurrentConsumptionMa: 20, fieldCurrentConsumptionMa: 0,
    approvals: "CE, UL",
    notes: "Transparent serial tunnel; Modbus RTU master/slave",
  },
  {
    vendorName: "Wago", articleNumber: "750-653",
    description: "RS-485 Serial Interface Module",
    cardType: "SERIAL", maxInputChannels: 1,
    galvanicIsolation: true, isolationVoltageV: 500,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "RS-485, 2-wire, up to 115200 baud",
    busCurrentConsumptionMa: 20, fieldCurrentConsumptionMa: 0,
    approvals: "CE, UL",
    notes: "Half-duplex; Modbus RTU master/slave",
  },

  // ───────────────────────────────────────────────
  // IO-LINK MASTER
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-657",
    description: "4-Port IO-Link Master, Class A",
    cardType: "IO_LINK", maxInputChannels: 4,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "IO-Link V1.1 Class A", busCurrentConsumptionMa: 30,
    fieldCurrentConsumptionMa: 500, approvals: "CE, UL",
    providesNetwork: true,
    notes: "Max 230 mA per port; process data via fieldbus coupler",
  },
  {
    vendorName: "Wago", articleNumber: "750-658",
    description: "4-Port IO-Link Master, Class B (separate field supply per port pair)",
    cardType: "IO_LINK", maxInputChannels: 4,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "IO-Link V1.1 Class B", busCurrentConsumptionMa: 30,
    fieldCurrentConsumptionMa: 800, approvals: "CE, UL",
    providesNetwork: true,
    notes: "Class B = separate 24V supply per port pair; max 200 mA/port",
  },

  // ───────────────────────────────────────────────
  // SUPPLY / POWER
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-602",
    description: "Field Supply Module, 24 VDC Segment Feed",
    cardType: "SUPPLY", supplyVoltageField: "24 VDC",
    galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC field power feed",
    busCurrentConsumptionMa: 2, fieldCurrentConsumptionMa: 0,
    approvals: "CE, UL",
    notes: "Feeds 24V field supply to subsequent modules; starts new field supply segment",
  },
  {
    vendorName: "Wago", articleNumber: "750-610",
    description: "Potential Distribution Module, 24 VDC",
    cardType: "SUPPLY", supplyVoltageField: "24 VDC",
    galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC potential distribution",
    busCurrentConsumptionMa: 0, fieldCurrentConsumptionMa: 0,
    approvals: "CE, UL",
    notes: "Injects 24V potential; breaks field supply bus for new segment",
  },
  {
    vendorName: "Wago", articleNumber: "750-626",
    description: "Internal Power Supply Coupler, 5 VDC Backplane Extension",
    cardType: "SUPPLY", galvanicIsolation: false,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "5 VDC internal backplane bus",
    busCurrentConsumptionMa: 0, fieldCurrentConsumptionMa: 1000,
    approvals: "CE, UL",
    notes: "Extends 5V backplane bus capacity; max 1 A output",
  },

  // ───────────────────────────────────────────────
  // MIXED (DI + DO)
  // ───────────────────────────────────────────────
  {
    vendorName: "Wago", articleNumber: "750-1405",
    description: "2-Channel DI + 2-Channel DO, 24 VDC",
    cardType: "MIXED", maxInputChannels: 2, maxOutputChannels: 2,
    supplyVoltageField: "24 VDC", galvanicIsolation: false,
    maxChannelCurrentMa: 500, shortCircuitProtected: true,
    tempMinC: -25, tempMaxC: 55, moduleWidthMm: 12,
    signalRange: "24 VDC DI + DO 0.5 A",
    busCurrentConsumptionMa: 10, fieldCurrentConsumptionMa: 20,
    approvals: "CE, UL",
    notes: "2 DI (3 ms filter) + 2 DO (0.5 A); common GND; point-wired",
  },
];

async function main() {
  console.log(`Seeding ${modules.length} WAGO 750 Series modules into module_catalog…`);

  let created = 0;
  let updated = 0;

  for (const m of modules) {
    const { approvals: approvalStr, ...data } = m;
    const mod = await prisma.moduleCatalog.upsert({
      where: { vendorName_articleNumber: { vendorName: m.vendorName, articleNumber: m.articleNumber } },
      create: data,
      update: data,
      select: { id: true },
    });

    // Check if it was a create or update for logging
    const wasNew = await prisma.moduleCatalog.count({
      where: { id: mod.id, createdAt: { gte: new Date(Date.now() - 1000) } },
    });
    if (wasNew > 0) created++;
    else updated++;

    if (approvalStr) {
      await linkModuleApprovals(mod.id, approvalStr);
    }
  }

  const total = await prisma.moduleCatalog.count();
  const approvalLinks = await prisma.moduleCatalogApproval.count();
  console.log(`Done — created ${created}, updated ${updated}. Total rows: ${total}. Approval links: ${approvalLinks}.`);
}

/** Map approval display names from seed data → approval.code */
const APPROVAL_CODE_MAP: Record<string, string> = {
  "CE": "CE",
  "UL": "UL",
  "ATEX": "ATEX",
  "DNV GL": "DNV",
  "RoHS": "RoHS",
  "IECEx": "IECEx",
  "SIL2": "SIL2",
  "SIL3": "SIL3",
};

async function linkModuleApprovals(moduleCatalogId: number, approvalStr: string) {
  const names = approvalStr.split(",").map((s) => s.trim()).filter(Boolean);
  for (const name of names) {
    const code = APPROVAL_CODE_MAP[name];
    if (!code) {
      console.warn(`  Unknown approval "${name}" — skipping`);
      continue;
    }
    const approval = await prisma.approval.findUnique({ where: { code } });
    if (!approval) {
      console.warn(`  Approval code "${code}" not in DB — skipping`);
      continue;
    }
    await prisma.moduleCatalogApproval.upsert({
      where: { moduleCatalogId_approvalId: { moduleCatalogId, approvalId: approval.id } },
      create: { moduleCatalogId, approvalId: approval.id },
      update: {},
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
