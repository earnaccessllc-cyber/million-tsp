import React, { useState } from 'react';
import { formatCurrency } from '@/lib/tspFunds';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const EVENTS = [
  {
    id: 'leave_early',
    label: 'Leave federal service early',
    emoji: '🚪',
    sections: [
      { title: 'Leave it in TSP', text: 'You can keep your TSP account after separation. No immediate taxes or penalties. Money continues to grow.' },
      { title: 'Roll it over', text: 'Roll to an IRA or new employer\'s plan within 60 days to avoid taxes. Direct rollover avoids 20% withholding.' },
      { title: 'Withdraw it', text: 'Subject to income tax + 10% early withdrawal penalty if under 59½ (unless under the Rule of 55 — separated at 55+).' },
    ],
    link: 'https://www.tsp.gov/tsp-basics/leaving-federal-service/',
  },
  {
    id: 'divorce',
    label: 'Get divorced',
    emoji: '⚖️',
    sections: [
      { title: 'QDRO / Retirement Benefits Court Order', text: 'TSP can be divided by a court order (RBCO). This is TSP\'s equivalent of a QDRO. Your spouse can receive a portion tax-free.' },
      { title: 'Impact', text: 'The court-ordered amount is paid out to the former spouse. You cannot prevent a valid RBCO. Update your beneficiaries after the divorce.' },
    ],
    link: 'https://www.tsp.gov/publications/tspbk31.pdf',
  },
  {
    id: 'deployed',
    label: 'Get deployed (military)',
    emoji: '🎖️',
    sections: [
      { title: 'Combat Zone Tax Exclusion', text: 'TSP contributions from combat pay are tax-exempt (Roth-like). These contributions grow tax-free AND are withdrawn tax-free.' },
      { title: 'Uniformed Services TSP', text: 'Military members can contribute to TSP up to $69,000/year including combat pay (vs normal $23,000 limit).' },
    ],
    link: 'https://www.tsp.gov/bulletins/tspcb-2.html',
  },
  {
    id: 'disabled',
    label: 'Become disabled',
    emoji: '♿',
    sections: [
      { title: 'Disability Retirement', text: 'TSP withdrawals for disability may be penalty-free regardless of age under IRS rules. You must have a permanent disability affecting your ability to work.' },
      { title: 'OPM Disability Retirement', text: 'If you receive disability annuity from OPM, you can still withdraw from TSP. The 10% early withdrawal penalty is waived.' },
    ],
    link: 'https://www.tsp.gov/tsp-basics/making-contributions/contribution-limits/',
  },
  {
    id: 'pass_away',
    label: 'Pass away before retirement',
    emoji: '💙',
    sections: [
      { title: 'Beneficiary Payout', text: 'Your TSP balance transfers to your designated beneficiaries. Spouses can keep it in TSP or roll to an inherited IRA. Non-spouse beneficiaries receive a taxable lump sum or installments.' },
      { title: 'Keep Beneficiaries Updated', text: 'TSP beneficiary designation supersedes your will. Update after any life event (marriage, divorce, death of beneficiary).' },
    ],
    link: 'https://www.tsp.gov/life-events/death/',
  },
  {
    id: 'transfer',
    label: 'Transfer between agencies',
    emoji: '🔄',
    sections: [
      { title: 'No Action Needed', text: 'TSP follows you automatically when you move between federal agencies. Your balance, contributions, and investment choices remain unchanged.' },
      { title: 'Check New Agency Payroll', text: 'Ensure your new agency payroll office is enrolled in EBIS to continue contributions without interruption.' },
    ],
  },
  {
    id: 'fers_switch',
    label: 'Move from FERS to another system',
    emoji: '🔀',
    sections: [
      { title: 'CSRS Offset', text: 'If you move from FERS to CSRS Offset, TSP contributions may change. You\'ll receive credit for FERS service under CSRS rules.' },
      { title: 'Consult HR', text: 'Retirement system changes are complex and rare. Contact your HR office and OPM for personalized guidance.' },
    ],
    link: 'https://www.opm.gov/retirement-services/',
  },
];

export default function LifeEventsPlanner({ profile, tspBalance }) {
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState({});

  const event = EVENTS.find(e => e.id === selected);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Life Events Planner</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">What happens to your TSP if you...</p>
        <div className="space-y-2">
          {EVENTS.map(e => (
            <button
              key={e.id}
              onClick={() => setSelected(selected === e.id ? null : e.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors ${
                selected === e.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span>{e.emoji}</span>
                {e.label}
              </span>
              {selected === e.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </div>

      {event && (
        <div className="bg-card rounded-xl border border-primary/20 p-4 space-y-3">
          <h3 className="text-sm font-bold">{event.emoji} {event.label}</h3>
          <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
            Your current balance: <span className="font-semibold text-foreground">{formatCurrency(tspBalance)}</span>
          </div>
          {event.sections.map((s, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          ))}
          {event.link && (
            <a href={event.link} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
              <ExternalLink className="w-3 h-3" />Learn more on TSP.gov
            </a>
          )}
        </div>
      )}
    </div>
  );
}