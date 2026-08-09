import { jsonResponse, handleOptions } from '../_shared/cors.ts';
import { getClients, getUser } from '../_shared/auth.ts';

const HISTORICAL_URL = 'https://opensheet.elk.sh/1ZAx2PyhwhaujcVdXNDMp6-BPUbmtJ1ixjkbtffDhES4/historical%20prices';

const FUND_KEYS = ['G', 'F', 'C', 'S', 'I', 'L2075', 'L2070', 'L2065', 'L2060', 'L2055', 'L2050', 'L2045', 'L2040', 'L2035', 'L2030', 'L Income'];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { userClient, adminClient } = getClients(req);
    const user = await getUser(userClient, adminClient);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { date } = await req.json();
    if (!date) return jsonResponse({ error: 'Missing date' }, 400);

    const res = await fetch(HISTORICAL_URL);
    if (!res.ok) return jsonResponse({ error: `Fetch failed: ${res.status}` }, 503);

    const rows = await res.json();
    if (!rows || rows.length === 0) return jsonResponse({ error: 'No historical data' }, 404);

    rows.sort((a, b) => a.Date.localeCompare(b.Date));

    let matchIdx = rows.findIndex(r => r.Date === date);
    let actualDate = date;

    if (matchIdx === -1) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].Date <= date) { matchIdx = i; actualDate = rows[i].Date; break; }
      }
    }

    if (matchIdx === -1) {
      return jsonResponse({ error: 'No data found on or before requested date', date }, 404);
    }

    const row = rows[matchIdx];
    const prevRow = matchIdx > 0 ? rows[matchIdx - 1] : null;

    const prices = {};
    const changes = {};
    const changePcts = {};

    for (const fund of FUND_KEYS) {
      const price = parseFloat(row[fund]);
      if (!isNaN(price) && price > 0) {
        prices[fund] = price;
        const prev = prevRow ? parseFloat(prevRow[fund]) : null;
        if (prev && prev > 0) {
          changes[fund] = price - prev;
          changePcts[fund] = ((price - prev) / prev) * 100;
        } else {
          changes[fund] = 0;
          changePcts[fund] = 0;
        }
      }
    }

    return jsonResponse({ success: true, date: actualDate, requested_date: date, prices, changes, change_pcts: changePcts });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
