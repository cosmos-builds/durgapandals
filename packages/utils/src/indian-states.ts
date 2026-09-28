// India's states/UTs are a fixed, exhaustive list (unlike cities, which are
// never hardcoded here) — this backs deriving a `stateCode` for a city
// resolved from a live geocoder result, where only the state's full English
// name (as Nominatim returns it) is available.
const INDIAN_STATE_CODES: Record<string, string> = {
  "andhra pradesh": "AP",
  "arunachal pradesh": "AR",
  assam: "AS",
  bihar: "BR",
  chhattisgarh: "CG",
  goa: "GA",
  gujarat: "GJ",
  haryana: "HR",
  "himachal pradesh": "HP",
  jharkhand: "JH",
  karnataka: "KA",
  kerala: "KL",
  "madhya pradesh": "MP",
  maharashtra: "MH",
  manipur: "MN",
  meghalaya: "ML",
  mizoram: "MZ",
  nagaland: "NL",
  odisha: "OD",
  punjab: "PB",
  rajasthan: "RJ",
  sikkim: "SK",
  "tamil nadu": "TN",
  telangana: "TG",
  tripura: "TR",
  "uttar pradesh": "UP",
  uttarakhand: "UK",
  "west bengal": "WB",
  // Union territories
  "andaman and nicobar islands": "AN",
  chandigarh: "CH",
  "dadra and nagar haveli and daman and diu": "DN",
  delhi: "DL",
  "nct of delhi": "DL",
  "national capital territory of delhi": "DL",
  "jammu and kashmir": "JK",
  ladakh: "LA",
  lakshadweep: "LD",
  puducherry: "PY",
  pondicherry: "PY",
};

// Falls back to a truncated guess rather than blocking city creation — an
// admin can correct an imprecise code later via the existing city edit
// endpoint; availability matters more than perfect data here.
export function getIndianStateCode(stateName: string): string {
  const normalized = stateName.trim().toLowerCase();
  return INDIAN_STATE_CODES[normalized] ?? stateName.trim().slice(0, 2).toUpperCase();
}
