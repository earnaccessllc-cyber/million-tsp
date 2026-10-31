const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function handleOptions(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

const LIVE_URL = 'https://opensheet.elk.sh/1ZAx2PyhwhaujcVdXNDMp6-BPUbmtJ1ixjkbtffDhES4/live%20prices';

function parsePercent(str) {
  if (!str) return null;
  const clean = String(str).replace(/[+%\s]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

// The sheet's "Day %" column has been stale/wrong for some funds (L2075 stuck
// at +6.04%). Derive it from Price and $ Change instead, which are reliable:
// day% = change / (price - change) * 100. Fall back to the sheet value only
// when the price data is missing.
function computeDayPercent(row) {
  const price = parseFloat(row['Price']);
  const change = parseFloat(row['$ Change']);
  if (Number.isFinite(price) && Number.isFinite(change) && price - change > 0) {
    return Math.round((change / (price - change)) * 100 * 100) / 100;
  }
  return parsePercent(row['Day %']);
}

// Even Price/$ Change can be wrong for a fund (L2075 still showed ~+6% when
// every other fund moved well under 1%). TSP funds all track the same
// underlying markets, so a daily move far from the median of all funds is a
// data error, not a real move. Return null so it isn't shown as a "mover".
const MAX_DEVIATION_FROM_MEDIAN = 3; // percentage points
function dropOutliers(values) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length < 3) return values;
  const mid = Math.floor(nums.length / 2);
  const median = nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  return values.map((v) =>
    Number.isFinite(v) && Math.abs(v - median) > MAX_DEVIATION_FROM_MEDIAN ? null : v
  );
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const res = await fetch(LIVE_URL);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    const funds = data.map(row => ({
      fund_name: row['Fund'],
      share_price: parseFloat(row['Price']) || 0,
      dollar_change: parseFloat(row['$ Change']) || 0,
      day_percent: computeDayPercent(row),
      week_percent: parsePercent(row['Week %']),
      month_percent: parsePercent(row['Month %']),
      year_percent: parsePercent(row['Year %']),
      last_updated: row['Last Updated'] || '',
    })).filter(f => f.fund_name);

    const cleaned = dropOutliers(funds.map(f => f.day_percent));
    funds.forEach((f, i) => { f.day_percent = cleaned[i]; });

    return jsonResponse({ funds });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
