export const CORE_FUNDS = [
  { name: 'G Fund', key: 'G', description: 'Government Securities Investment Fund' },
  { name: 'F Fund', key: 'F', description: 'Fixed Income Index Investment Fund' },
  { name: 'C Fund', key: 'C', description: 'Common Stock Index Investment Fund' },
  { name: 'S Fund', key: 'S', description: 'Small Cap Stock Index Investment Fund' },
  { name: 'I Fund', key: 'I', description: 'International Stock Index Investment Fund' },
];

export const LIFECYCLE_FUNDS = [
  { name: 'L Income', key: 'LIncome', description: 'Lifecycle Income Fund' },
  { name: 'L 2025', key: 'L2025', description: 'Lifecycle 2025 Fund' },
  { name: 'L 2030', key: 'L2030', description: 'Lifecycle 2030 Fund' },
  { name: 'L 2035', key: 'L2035', description: 'Lifecycle 2035 Fund' },
  { name: 'L 2040', key: 'L2040', description: 'Lifecycle 2040 Fund' },
  { name: 'L 2045', key: 'L2045', description: 'Lifecycle 2045 Fund' },
  { name: 'L 2050', key: 'L2050', description: 'Lifecycle 2050 Fund' },
  { name: 'L 2055', key: 'L2055', description: 'Lifecycle 2055 Fund' },
  { name: 'L 2060', key: 'L2060', description: 'Lifecycle 2060 Fund' },
  { name: 'L 2065', key: 'L2065', description: 'Lifecycle 2065 Fund' },
];

export const ALL_FUNDS = [...CORE_FUNDS, ...LIFECYCLE_FUNDS];

export function formatCurrency(value) {
  if (value == null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value, decimals = 2) {
  if (value == null || isNaN(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatNumber(value, decimals = 4) {
  if (value == null || isNaN(value)) return '0';
  return value.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

// IRS Life Expectancy Table (simplified, age -> factor)
export const LIFE_EXPECTANCY_FACTORS = {
  55: 31.6, 56: 30.6, 57: 29.8, 58: 28.9, 59: 28.0,
  60: 27.1, 61: 26.2, 62: 25.4, 63: 24.5, 64: 23.7,
  65: 22.9, 66: 22.0, 67: 21.2, 68: 20.4, 69: 19.6,
  70: 18.8, 71: 18.0, 72: 17.2, 73: 16.4, 74: 15.6,
  75: 14.8, 76: 14.1, 77: 13.3, 78: 12.6, 79: 11.9,
  80: 11.2, 81: 10.5, 82: 9.9, 83: 9.2, 84: 8.6,
  85: 8.0, 86: 7.4, 87: 6.9, 88: 6.3, 89: 5.8,
  90: 5.3,
};

// MRA table based on birth year for FERS
export function getMRA(birthYear) {
  if (birthYear <= 1947) return 55;
  if (birthYear === 1948) return 55 + 2/12;
  if (birthYear === 1949) return 55 + 4/12;
  if (birthYear === 1950) return 55 + 6/12;
  if (birthYear === 1951) return 55 + 8/12;
  if (birthYear === 1952) return 55 + 10/12;
  if (birthYear >= 1953 && birthYear <= 1964) return 56;
  if (birthYear === 1965) return 56 + 2/12;
  if (birthYear === 1966) return 56 + 4/12;
  if (birthYear === 1967) return 56 + 6/12;
  if (birthYear === 1968) return 56 + 8/12;
  if (birthYear === 1969) return 56 + 10/12;
  return 57;
}