import { corsHeaders, jsonResponse, handleOptions } from '../_shared/cors.ts';

const LIVE_URL = 'https://opensheet.elk.sh/1ZAx2PyhwhaujcVdXNDMp6-BPUbmtJ1ixjkbtffDhES4/live%20prices';

function parsePercent(str) {
  if (!str) return null;
  const clean = String(str).replace(/[+%\s]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
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
      day_percent: parsePercent(row['Day %']),
      week_percent: parsePercent(row['Week %']),
      month_percent: parsePercent(row['Month %']),
      year_percent: parsePercent(row['Year %']),
      last_updated: row['Last Updated'] || '',
    })).filter(f => f.fund_name);

    return jsonResponse({ funds });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
