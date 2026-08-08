import React, { useState } from 'react';

const FUND_COLORS = {
  'G': '#22c55e', 'F': '#eab308', 'C': '#06b6d4', 'S': '#f97316', 'I': '#8b5cf6',
  'L Income': '#eab308', 'L2030': '#ec4899', 'L2035': '#f43f5e', 'L2040': '#f97316',
  'L2045': '#d97706', 'L2050': '#84cc16', 'L2055': '#10b981', 'L2060': '#06b6d4',
  'L2065': '#0ea5e9', 'L2070': '#6366f1', 'L2075': '#8b5cf6',
};

const FUND_ORDER = ['G', 'F', 'C', 'S', 'I', 'L Income', 'L2030', 'L2035', 'L2040', 'L2045', 'L2050', 'L2055', 'L2060', 'L2065', 'L2070', 'L2075'];

// Map display name to entity fund_name for looking up user holdings.
// FundAllocation.fund_name stores lifecycle funds with a space ('L 2030'), unlike the display key ('L2030').
const DISPLAY_TO_ENTITY = {
  'G': 'G Fund', 'F': 'F Fund', 'C': 'C Fund', 'S': 'S Fund', 'I': 'I Fund',
  'L Income': 'L Income', 'L2030': 'L 2030', 'L2035': 'L 2035', 'L2040': 'L 2040',
  'L2045': 'L 2045', 'L2050': 'L 2050', 'L2055': 'L 2055', 'L2060': 'L 2060',
  'L2065': 'L 2065', 'L2070': 'L 2070', 'L2075': 'L 2075',
};

function pct(val) {
  if (val == null) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val).replace(/%/, '') + '%';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function PctCell({ value }) {
  const n = parseFloat(value);
  const text = pct(value);
  const color = isNaN(n) ? undefined : n >= 0 ? '#00c851' : '#ff4444';
  return <span style={{ color }}>{text}</span>;
}

function DollarCell({ value }) {
  if (value == null) return <span>—</span>;
  const n = parseFloat(value);
  const pos = n >= 0;
  return <span style={{ color: pos ? '#00c851' : '#ff4444' }}>{pos ? '+' : '-'}${Math.abs(n).toFixed(4)}</span>;
}

export default function PriceTableView({ priceData = {}, selectedDate, nearestDateNote = '', isLive = true, myFunds = [], mfwHoldings = [] }) {
  const liveEntry = Object.values(priceData).find(d => d?.last_updated);
  const lastUpdated = liveEntry?.last_updated || null;

  // Build a quick lookup for user's fund allocations
  const myFundMap = {};
  for (const f of myFunds) {
    if (f.is_selected) myFundMap[f.fund_name] = f;
  }
  const hasMyFunds = Object.keys(myFundMap).length > 0;

  const validMfwHoldings = mfwHoldings.filter(h => h.ticker);
  const hasMfw = validMfwHoldings.length > 0;
  // MFW value is always "mine" (there's no separate market-wide price table for arbitrary tickers),
  // so its rows need the My Balance/My Shares columns even if the user holds no core TSP funds.
  const showMineCols = hasMyFunds || hasMfw;

  return (
    <div className="px-4 space-y-2">
      {/* Date / status line */}
      <div className="text-center text-sm text-muted-foreground">
        {nearestDateNote
          ? <span className="text-amber-500">{nearestDateNote}</span>
          : isLive
            ? <span>Live Closing Prices{lastUpdated ? ` · Updated ${lastUpdated}` : ''}</span>
            : selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        }
      </div>

      {/* Scrollable table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-xs">
            <thead>
              <tr className="bg-secondary/30 border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground sticky left-0 bg-secondary/30 z-10">Fund</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Closing Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">$ Chg</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Day %</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Week %</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Month %</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">YTD %</th>
                {showMineCols && <th className="px-4 py-3 text-right font-medium text-primary">My Balance</th>}
                {showMineCols && <th className="px-4 py-3 text-right font-medium text-muted-foreground">My Shares</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FUND_ORDER.map((name, idx) => {
                const data = priceData[name] || {};
                const rowBg = idx % 2 === 0 ? '#0f0f0f' : '#141414';
                const entityName = DISPLAY_TO_ENTITY[name];
                const myFund = myFundMap[entityName];
                const myBalance = myFund ? (myFund.shares > 0 && data.share_price ? myFund.shares * data.share_price : myFund.balance || myFund.dollar_balance || 0) : null;
                const myShares = myFund?.shares || null;

                return (
                  <tr key={name} style={{ background: rowBg }} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-0 py-3 sticky left-0 z-10" style={{ background: rowBg }}>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-8" style={{ background: FUND_COLORS[name] }} />
                        <span className="font-medium" style={{ color: '#ffffff' }}>{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: '#ffffff' }}>
                      {data.share_price != null ? `$${parseFloat(data.share_price).toFixed(4)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DollarCell value={data.daily_change ?? data.daily_change_dollars} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={data.daily_change_percent ?? data.daily_return_percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={data.wtd_return_percent ?? data.wtd_percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={data.mtd_return_percent ?? data.mtd_percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={data.ytd_return_percent ?? data.return_percent ?? data.ytd_percent} />
                    </td>
                    {showMineCols && (
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: myBalance ? '#C9A832' : undefined }}>
                        {myBalance != null && myBalance > 0
                          ? `$${myBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                    )}
                    {showMineCols && (
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {myShares != null && myShares > 0
                          ? myShares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'
                        }
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Mutual Fund Window holdings */}
              {hasMfw && (
                <tr>
                  <td colSpan={7 + (showMineCols ? 2 : 0)} className="px-4 py-1.5 bg-secondary/20">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Mutual Fund Window</span>
                  </td>
                </tr>
              )}
              {validMfwHoldings.map((h, idx) => {
                const price = parseFloat(h.last_price) || 0;
                const shares = parseFloat(h.shares) || 0;
                const value = h.entry_mode === 'dollar' ? (parseFloat(h.dollar_value) || 0) : shares * price;
                const rowBg = idx % 2 === 0 ? '#0f0f0f' : '#141414';
                return (
                  <tr key={`mfw-${h.ticker}`} style={{ background: rowBg }} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-0 py-3 sticky left-0 z-10" style={{ background: rowBg }}>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-8" style={{ background: '#C9A832' }} />
                        <span className="font-medium" style={{ color: '#ffffff' }}>{h.ticker}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: '#ffffff' }}>
                      {price > 0 ? `$${price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={h.daily_change_percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={h.week_change_percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={h.month_change_percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PctCell value={h.ytd_change_percent} />
                    </td>
                    {showMineCols && (
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: value ? '#C9A832' : undefined }}>
                        {value > 0
                          ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                    )}
                    {showMineCols && (
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {shares > 0 ? shares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Account total row */}
              {priceData.account && (
                <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                  <td className="px-0 py-3 sticky left-0 z-10 bg-primary/10">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-8" style={{ background: '#C9A832' }} />
                      <span className="text-foreground">Account</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    ${(priceData.account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DollarCell value={priceData.account.daily_change} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PctCell value={priceData.account.daily_change_percent} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  {showMineCols && <td className="px-4 py-3" />}
                  {showMineCols && <td className="px-4 py-3" />}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}