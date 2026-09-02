import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DrawerSelect from '@/components/common/DrawerSelect';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Check, ChevronDown } from 'lucide-react';
import { getFRA, getFRALabel, addYearsMonths } from '@/lib/retirementCalc';
import { getMRA } from '@/lib/tspFunds';
import SickLeaveInputs from '@/components/retirement/SickLeaveInputs';
import DateDrawer from '@/components/common/DateDrawer';

const SS_OPTIONS = [
  { value: '62', label: 'Age 62 (reduced)' },
  { value: '63', label: 'Age 63' },
  { value: '64', label: 'Age 64' },
  { value: '65', label: 'Age 65' },
  { value: '66', label: 'Age 66' },
  { value: 'fra', label: null }, // filled in dynamically
  { value: '67', label: 'Age 67' },
  { value: '68', label: 'Age 68' },
  { value: '69', label: 'Age 69' },
  { value: '70', label: 'Age 70 (max)' },
];

// Amber ring highlight for fields the user hasn't filled in yet.
const emptyRing = 'ring-2 ring-amber-500/60';
const hl = (val) => (val ? '' : emptyRing);

export default function RetirementInputs({ profile, onUpdate }) {
  const handleChange = (field, value) => onUpdate({ [field]: value });
  const [ssDrawerOpen, setSsDrawerOpen] = useState(false);

  // The default planned retirement date: the participant's Minimum Retirement
  // Age, from the birth-year table.
  //
  // This was hardcoded to age 57, which is only correct for people born in 1970
  // or later. An employee born 1953-1969 has an MRA between 56 and 56 years 10
  // months, so the default sat up to a year past the date they could actually
  // go — and contradicted the eligibility card immediately below it, which
  // computes the same figure properly.
  const autoRetirementDate = useMemo(() => {
    if (!profile?.date_of_birth) return '';
    const dob = new Date(profile.date_of_birth);
    const mra = getMRA(dob.getFullYear());
    const years = Math.floor(mra);
    const months = Math.round((mra - years) * 12);
    return addYearsMonths(dob, years, months).toISOString().split('T')[0];
  }, [profile?.date_of_birth]);

  // Fill the date in when there isn't one — but never overwrite one the user
  // picked.
  //
  // This effect runs on mount, and it used to write whenever the stored date
  // differed from the default at all. So a deliberately chosen date — retiring
  // at 62 for the 1.1% multiplier, say — was silently reset to the default
  // every time this tab was opened, and saved back over on the next save. The
  // helper text said "change anytime" while the code undid the change.
  //
  // A date is safe to replace only if this component is the one that put it
  // there and the date of birth has since moved, so that correcting a birth
  // date still carries an untouched default along with it.
  const lastAutoRef = useRef(null);
  useEffect(() => {
    if (!autoRetirementDate) return;
    const stored = profile?.planned_retirement_date;
    const isUntouchedDefault = !!stored && stored === lastAutoRef.current;
    if (stored && !isUntouchedDefault) return;
    if (stored === autoRetirementDate) return;
    lastAutoRef.current = autoRetirementDate;
    onUpdate({ planned_retirement_date: autoRetirementDate });
  }, [autoRetirementDate]);

  const plannedRetirementValue = profile?.planned_retirement_date || autoRetirementDate;

  const birthYear = profile?.date_of_birth ? new Date(profile.date_of_birth).getFullYear() : null;
  // "56y 10m" rather than "56.83" — the MRA table is in years and months.
  const mraLabel = useMemo(() => {
    if (!birthYear) return '';
    const mra = getMRA(birthYear);
    const years = Math.floor(mra);
    const months = Math.round((mra - years) * 12);
    return months > 0 ? `${years}y ${months}mo` : `${years}`;
  }, [birthYear]);
  const fraLabel = birthYear ? getFRALabel(birthYear) : 'Full Retirement Age (FRA)';
  // Spell out the actual FRA age next to "(at FRA)" so users who don't know what FRA stands
  // for still know which age to look up on their Social Security statement. Defaults to 67
  // (FRA for anyone born 1960+) until date of birth is set.
  const fraAge = birthYear ? getFRA(birthYear) : { years: 67, months: 0 };
  const fraAgeText = fraAge.months > 0 ? `${fraAge.years}y ${fraAge.months}mo` : `${fraAge.years}`;

  const ssYears = profile?.ss_claiming_age_years;
  const ssMonths = profile?.ss_claiming_age_months || 0;
  const currentSSValue = ssYears ? (ssMonths > 0 ? `fra` : String(ssYears)) : '62';

  const handleSSClaimingChange = (val) => {
    if (val === 'fra' && birthYear) {
      let fraYears = 67, fraMonths = 0;
      if (birthYear <= 1954) { fraYears = 66; fraMonths = 0; }
      else if (birthYear === 1955) { fraYears = 66; fraMonths = 2; }
      else if (birthYear === 1956) { fraYears = 66; fraMonths = 4; }
      else if (birthYear === 1957) { fraYears = 66; fraMonths = 6; }
      else if (birthYear === 1958) { fraYears = 66; fraMonths = 8; }
      else if (birthYear === 1959) { fraYears = 66; fraMonths = 10; }
      onUpdate({ ss_claiming_age_years: fraYears, ss_claiming_age_months: fraMonths });
    } else {
      onUpdate({ ss_claiming_age_years: parseInt(val), ss_claiming_age_months: 0 });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-amber-500 flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500/70" /> Amber-outlined fields are still empty
      </p>

      {/* Date of Birth + Career Start */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Date of Birth</Label>
          <DateDrawer
            value={profile?.date_of_birth || ''}
            onChange={v => handleChange('date_of_birth', v)}
            max={new Date().toISOString().split('T')[0]}
            className={`mt-1 ${hl(profile?.date_of_birth)}`}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Career Start Date</Label>
          <DateDrawer
            value={profile?.career_start_date || ''}
            onChange={v => handleChange('career_start_date', v)}
            max={new Date().toISOString().split('T')[0]}
            className={`mt-1 ${hl(profile?.career_start_date)}`}
          />
        </div>
      </div>

      {/* Planned Retirement Date */}
      <div>
        <Label className="text-xs text-muted-foreground">My Planned Retirement Date</Label>
        <DateDrawer
          value={plannedRetirementValue}
          onChange={v => handleChange('planned_retirement_date', v)}
          min={new Date().toISOString().split('T')[0]}
          className="mt-1"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {!profile?.planned_retirement_date && profile?.date_of_birth
            ? `Defaulting to your MRA (${mraLabel}) from your date of birth — change anytime`
            : 'Leave blank to use today\'s date for calculations'}
        </p>
      </div>

      {/* Retirement System */}
      <div>
        <Label className="text-xs text-muted-foreground">Retirement System</Label>
        <DrawerSelect
          value={profile?.retirement_system || 'FERS'}
          onChange={v => handleChange('retirement_system', v)}
          label="Retirement System"
          options={[
            { value: 'FERS', label: 'FERS' },
            { value: 'CSRS', label: 'CSRS' },
          ]}
        />
      </div>

      {/* Salary */}
      <div>
        <Label className="text-xs text-muted-foreground">Current Annual Salary</Label>
        <Input type="number" placeholder="$0" value={profile?.current_annual_salary || ''} onChange={e => handleChange('current_annual_salary', parseFloat(e.target.value) || 0)} className={`h-9 text-sm mt-1 ${hl(profile?.current_annual_salary)}`} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Salary Yr -1</Label>
          <Input type="number" placeholder="$0" value={profile?.salary_year_1 || ''} onChange={e => handleChange('salary_year_1', parseFloat(e.target.value) || 0)} className={`h-9 text-sm mt-1 ${hl(profile?.salary_year_1)}`} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Salary Yr -2</Label>
          <Input type="number" placeholder="$0" value={profile?.salary_year_2 || ''} onChange={e => handleChange('salary_year_2', parseFloat(e.target.value) || 0)} className={`h-9 text-sm mt-1 ${hl(profile?.salary_year_2)}`} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Salary Yr -3</Label>
          <Input type="number" placeholder="$0" value={profile?.salary_year_3 || ''} onChange={e => handleChange('salary_year_3', parseFloat(e.target.value) || 0)} className={`h-9 text-sm mt-1 ${hl(profile?.salary_year_3)}`} />
        </div>
      </div>

      {/* Social Security Benefit + Claiming Age */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Social Security Monthly Benefit (at FRA, age {fraAgeText})</Label>
          <Input type="number" placeholder="$0" value={profile?.ss_monthly_benefit || ''} onChange={e => handleChange('ss_monthly_benefit', parseFloat(e.target.value) || 0)} className={`h-9 text-sm mt-1 ${profile?.retirement_system === 'CSRS' ? '' : hl(profile?.ss_monthly_benefit)}`} />
          {profile?.retirement_system === 'CSRS' ? (
            <p className="text-[10px] text-amber-500 mt-1">
              CSRS employment isn't Social Security-covered, so this won't be included in your retirement income projections.
            </p>
          ) : (
            <a
              href="https://www.ssa.gov/myaccount/statement.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary underline mt-1 inline-block"
            >
              Don't know your benefit? Get your Social Security statement →
            </a>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Social Security Claiming Age</Label>
          <button
            type="button"
            onClick={() => setSsDrawerOpen(true)}
            className="w-full flex items-center justify-between h-9 px-3 mt-1 rounded-md border border-input bg-transparent text-sm select-none"
          >
            <span>{SS_OPTIONS.find(o => o.value === currentSSValue)?.label || fraLabel}</span>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </button>
          <Drawer open={ssDrawerOpen} onOpenChange={setSsDrawerOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Social Security Claiming Age</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-2">
                {SS_OPTIONS.map(opt => {
                  const label = opt.value === 'fra' ? fraLabel : opt.label;
                  const isSelected = opt.value === currentSSValue;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { handleSSClaimingChange(opt.value); setSsDrawerOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors select-none"
                      style={{
                        borderColor: isSelected ? 'rgba(201,168,50,0.5)' : 'hsl(var(--border))',
                        background: isSelected ? 'rgba(201,168,50,0.08)' : 'transparent',
                      }}
                    >
                      <span className="text-sm font-medium">{label}</span>
                      {isSelected && <Check className="w-4 h-4" style={{ color: '#C9A832' }} />}
                    </button>
                  );
                })}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* TSP Withdrawal */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">TSP Withdrawal Method</Label>
          <DrawerSelect
            value={profile?.tsp_withdrawal_method || 'fixed_percent'}
            onChange={v => handleChange('tsp_withdrawal_method', v)}
            label="TSP Withdrawal Method"
            options={[
              { value: 'fixed_percent', label: 'Fixed % / Month' },
              { value: 'fixed_dollar', label: 'Fixed $ / Month' },
              { value: 'life_expectancy', label: 'Life Expectancy' },
            ]}
          />
        </div>
        <div>
          {profile?.tsp_withdrawal_method === 'fixed_percent' && (
            <>
              <Label className="text-xs text-muted-foreground">Monthly %</Label>
              <Input type="number" step="0.1" placeholder="4" value={profile?.tsp_withdrawal_percent || ''} onChange={e => handleChange('tsp_withdrawal_percent', parseFloat(e.target.value) || 0)} className={`h-9 text-sm mt-1 ${hl(profile?.tsp_withdrawal_percent)}`} />
            </>
          )}
          {profile?.tsp_withdrawal_method === 'fixed_dollar' && (
            <>
              <Label className="text-xs text-muted-foreground">Monthly $</Label>
              <Input type="number" placeholder="$3000" value={profile?.tsp_withdrawal_amount || ''} onChange={e => handleChange('tsp_withdrawal_amount', parseFloat(e.target.value) || 0)} className={`h-9 text-sm mt-1 ${hl(profile?.tsp_withdrawal_amount)}`} />
            </>
          )}
          {profile?.tsp_withdrawal_method === 'life_expectancy' && (
            <div className="pt-5"><p className="text-xs text-muted-foreground">Uses IRS life expectancy factor</p></div>
          )}
        </div>
      </div>

      {/* Sick Leave */}
      <div className="border-t border-border pt-4">
        <SickLeaveInputs profile={profile} onUpdate={onUpdate} />
      </div>
    </div>
  );
}