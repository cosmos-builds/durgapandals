// The set of festival years a visitor can pick, anywhere in the app — a
// fixed calendar-based window, not derived from any one city's data. Year
// is not a property of a city (a city doesn't "have" 2026, a pandal within
// it might have a 2026 record or might not yet); this keeps the two
// concepts independent instead of gating the year list on a per-city
// `activeFestivalYear` scalar that could never look forward.
export function getAvailableFestivalYears(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
}
