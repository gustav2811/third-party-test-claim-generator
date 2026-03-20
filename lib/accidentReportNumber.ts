export const ACCIDENT_REPORT_NUMBER_MAX_LENGTH = 20;

/**
 * Police / accident report numbers must fit downstream limits; truncate from the end if too long.
 */
export function truncateAccidentReportNumber(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = typeof value === "string" ? value : String(value);
  if (s.length <= ACCIDENT_REPORT_NUMBER_MAX_LENGTH) return s;
  return s.slice(0, ACCIDENT_REPORT_NUMBER_MAX_LENGTH);
}
