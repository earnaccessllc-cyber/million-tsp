import { createClient } from 'jsr:@supabase/supabase-js@2';

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

// Sends each profile's nightly balance summary email at whatever time they've
// chosen (notif_email_time, set in Notification Preferences). Polled every 15
// minutes by cron rather than run once at a fixed hour, since different users
// can pick different times — "due and not yet sent today" is checked on each
// poll, so a profile gets exactly one email per day, at or shortly after its
// configured time.
function isDST(date) {
  const year = date.getUTCFullYear();
  const marchSecondSun = nthSundayOfMonth(year, 2, 2);
  const novFirstSun = nthSundayOfMonth(year, 10, 1);
  return date >= marchSecondSun && date < novFirstSun;
}

function nthSundayOfMonth(year, month, n) {
  const d = new Date(Date.UTC(year, month, 1));
  const firstSunday = (7 - d.getUTCDay()) % 7;
  d.setUTCDate(1 + firstSunday + (n - 1) * 7);
  return d;
}

function formatCurrency(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildEmailHtml({ name, balance, dailyChange, dailyChangePct, isGain, funds, mfwBalance }) {
  const changeColor = isGain ? '#16a34a' : '#dc2626';
  const sign = dailyChange >= 0 ? '+' : '';
  const fundRows = funds.map(f => `
    <tr>
      <td style="padding:6px 0;color:#555;">${f.fund_name}</td>
      <td style="padding:6px 0;text-align:right;">${formatCurrency(f.balance)}</td>
      <td style="padding:6px 0;text-align:right;color:${(f.daily_return_percent || 0) >= 0 ? '#16a34a' : '#dc2626'};">
        ${(f.daily_return_percent || 0) >= 0 ? '+' : ''}${(f.daily_return_percent || 0).toFixed(2)}%
      </td>
    </tr>
  `).join('');

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h2 style="margin:0 0 4px;">${name ? `Hi ${name},` : 'Hi,'}</h2>
    <p style="color:#666;margin:0 0 20px;">Here's your MillionTSP balance update.</p>

    <div style="background:#f7f7f8;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0;color:#666;font-size:13px;">Total Balance</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:700;">${formatCurrency(balance)}</p>
      <p style="margin:6px 0 0;color:${changeColor};font-weight:600;">
        ${sign}${formatCurrency(dailyChange)} (${sign}${dailyChangePct.toFixed(2)}%) today
      </p>
    </div>

    ${funds.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr><th style="text-align:left;color:#999;font-size:12px;font-weight:500;padding-bottom:6px;">Fund</th>
        <th style="text-align:right;color:#999;font-size:12px;font-weight:500;padding-bottom:6px;">Balance</th>
        <th style="text-align:right;color:#999;font-size:12px;font-weight:500;padding-bottom:6px;">Today</th></tr>
      </thead>
      <tbody>${fundRows}</tbody>
    </table>` : ''}

    ${mfwBalance > 0 ? `<p style="color:#666;font-size:13px;">Mutual funds: ${formatCurrency(mfwBalance)}</p>` : ''}

    <p style="color:#999;font-size:12px;margin-top:24px;">
      You're receiving this because nightly balance emails are turned on in your MillionTSP notification settings.
    </p>
  </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 200);

    const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS') || 'MillionTSP <onboarding@resend.dev>';

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const nowUTC = new Date();
    const etOffset = isDST(nowUTC) ? -4 : -5;
    const etNow = new Date(nowUTC.getTime() + etOffset * 3600 * 1000);
    const today = etNow.toISOString().split('T')[0];
    const currentHHMM = etNow.toISOString().split('T')[1].slice(0, 5);

    const { data: profiles } = await adminClient
      .from('tsp_profiles')
      .select('*')
      .eq('notif_nightly_email', true)
      .not('notif_email_address', 'is', null);

    const results = [];

    for (const profile of (profiles || [])) {
      try {
        if (!profile.notif_email_address) {
          results.push({ profile_id: profile.id, skipped: true, reason: 'No email address set' });
          continue;
        }
        if (profile.notif_last_sent_date === today) {
          results.push({ profile_id: profile.id, skipped: true, reason: 'Already sent today' });
          continue;
        }
        const dueTime = profile.notif_email_time || '16:30';
        if (currentHHMM < dueTime) {
          results.push({ profile_id: profile.id, skipped: true, reason: `Not due yet (due ${dueTime}, now ${currentHHMM})` });
          continue;
        }

        const { data: allocations } = await adminClient
          .from('fund_allocations')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('is_selected', true);

        const { data: todayBal } = await adminClient
          .from('daily_balances')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('date', today)
          .maybeSingle();

        const balance = profile.total_balance_manual || 0;
        const dailyChange = todayBal?.daily_change || 0;
        const dailyChangePct = todayBal?.daily_change_percent || 0;
        const isGain = dailyChange >= 0;

        const html = buildEmailHtml({
          name: profile.name,
          balance,
          dailyChange,
          dailyChangePct,
          isGain,
          funds: allocations || [],
          mfwBalance: profile.has_mfw ? (profile.mfw_balance || 0) : 0,
        });

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: profile.notif_email_address,
            subject: `Your balance: ${formatCurrency(balance)} (${isGain ? '+' : ''}${dailyChangePct.toFixed(2)}% today)`,
            html,
          }),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          results.push({ profile_id: profile.id, error: `Resend error: ${emailRes.status} ${errText}` });
          continue;
        }

        await adminClient.from('tsp_profiles').update({ notif_last_sent_date: today }).eq('id', profile.id);
        results.push({ profile_id: profile.id, success: true });
      } catch (e) {
        results.push({ profile_id: profile.id, error: e.message });
      }
    }

    return jsonResponse({
      success: true,
      date: today,
      currentTime: currentHHMM,
      emailsSent: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});
