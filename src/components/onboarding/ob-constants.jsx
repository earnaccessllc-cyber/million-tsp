export const BG = '#080800';
export const INPUT_BG = '#0f0e00';
export const GOLD = '#C9A832';
export const GOLD_BRIGHT = '#FFD700';
export const GOLD_DARK = '#8B6914';
export const GOLD_GRADIENT = 'linear-gradient(135deg, #FFE566 0%, #FFD700 40%, #C9A832 70%, #8B6914 100%)';
export const BTN_GRADIENT = 'linear-gradient(135deg, #FFD700 0%, #C9A832 100%)';
export const BTN_SHADOW = '0 4px 16px rgba(201,168,50,0.3)';
export const SUCCESS = '#00c851';
export const ERROR = '#ff4444';

export const CORE_FUND_COLORS = {
  'G Fund': '#22c55e',
  'F Fund': '#eab308',
  'C Fund': '#06b6d4',
  'S Fund': '#f97316',
  'I Fund': '#8b5cf6',
};
export const LIFECYCLE_COLOR = '#C9A832';

export const FUND_NAME_GROUPS = {
  core: ['G Fund', 'F Fund', 'C Fund', 'S Fund', 'I Fund'],
  lifecycle: ['L Income', 'L2030', 'L2035', 'L2040', 'L2045', 'L2050', 'L2055', 'L2060', 'L2065', 'L2070', 'L2075'],
};

export function parseDollar(str) {
  return parseFloat((str || '').replace(/,/g, '')) || 0;
}

export function formatCurrency(raw) {
  const cleaned = (raw || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (parts.length > 1) return parts[0] + '.' + parts[1].slice(0, 2);
  return parts[0];
}