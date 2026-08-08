/**
 * US Federal Holidays observed by TSP / stock markets.
 * Covers 2024-2027. Add more years as needed.
 */
const MARKET_HOLIDAYS = new Set([
  // 2024
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-05-27',
  '2024-06-19', '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25',
  // 2025
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26',
  '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

/**
 * Returns true if the given YYYY-MM-DD date string is a market trading day
 * (i.e. a weekday that is not a US federal holiday).
 */
export function isMarketDay(dateStr) {
  if (!dateStr) return false;
  if (MARKET_HOLIDAYS.has(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow !== 0 && dow !== 6; // exclude Sunday (0) and Saturday (6)
}