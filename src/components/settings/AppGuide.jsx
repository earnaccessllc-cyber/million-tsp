import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Updating your balance',
    body: "Your Current Balance on the Dashboard auto-saves as you type. You can also set it from Settings → Current TSP Balance. Once your fund allocations are saved (see below), your balance updates automatically every trading night from live TSP closing prices — you don't need to re-enter it by hand.",
  },
  {
    title: 'Fund allocations & live prices',
    body: 'Go to Funds → Allocations to select which TSP funds you hold and set each one as a percent of your total or a dollar amount — use the %/$ toggle next to each fund. Hit "Save Allocations" to pull live closing prices and immediately recalculate your balance. After that, prices and your balance refresh automatically every night.',
  },
  {
    title: 'Mutual Fund Window (MFW)',
    body: "If you invest part of your TSP through the Mutual Fund Window, turn it on in Settings → Current TSP Balance. Add each holding by ticker and either its share count or a dollar amount — the app fetches real closing prices for you and refreshes them nightly alongside your core TSP funds.",
  },
  {
    title: 'Goals & progress',
    body: 'Set a target balance in Settings → Goal. The Dashboard shows a progress bar toward that goal with a projected date based on your contributions and market growth.',
  },
  {
    title: 'Retirement planning',
    body: "The Retirement tab covers your FERS/CSRS pension estimate, Special Retirement Supplement (SRS) eligibility, Social Security timing, and a loan calculator. Fill in your date of birth, career start date, salary history, and Social Security benefit under the Benefits tab — empty fields are outlined in amber so you know what's still missing.",
  },
  {
    title: 'Analytics',
    body: 'The Analytics tab has tools for contribution optimization, risk/volatility scoring, inflation-adjusted projections, and comparing your funds against each other over time.',
  },
  {
    title: 'Notifications',
    body: 'Turn on alerts in Settings → Notifications for things like all-time highs, big drops, and nightly balance summaries by email.',
  },
];

export default function AppGuide() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-secondary/30 border-b border-border flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
        <p className="text-sm font-bold text-foreground">App Guide</p>
      </div>
      <div className="divide-y divide-border">
        {SECTIONS.map((s, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={s.title}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-foreground">{s.title}</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              {isOpen && (
                <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}