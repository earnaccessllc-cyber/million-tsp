import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Mail, TrendingDown, Target, BarChart3, ChevronDown, ChevronUp, Trophy, Plus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PRESET_MILESTONES = [100000, 250000, 500000, 750000, 1000000];

export default function NotificationSettings() {
  const { activeProfile, refreshProfiles } = useProfile();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customMilestone, setCustomMilestone] = useState('');

  const [prefs, setPrefs] = useState({
    notif_nightly_email: activeProfile?.notif_nightly_email ?? true,
    notif_all_time_high: activeProfile?.notif_all_time_high ?? true,
    notif_big_drop: activeProfile?.notif_big_drop ?? true,
    notif_big_drop_threshold: activeProfile?.notif_big_drop_threshold ?? 2,
    notif_goal_off_track: activeProfile?.notif_goal_off_track ?? true,
    notif_weekly_checkin: activeProfile?.notif_weekly_checkin ?? true,
    notif_email_address: activeProfile?.notif_email_address || '',
    notif_email_time: activeProfile?.notif_email_time || '16:30',
    notif_milestone_amounts: activeProfile?.notif_milestone_amounts || [],
    notif_fund_drop_threshold: activeProfile?.notif_fund_drop_threshold || '',
    notif_near_goal_days: activeProfile?.notif_near_goal_days || 365,
    notif_ytd_gain_threshold: activeProfile?.notif_ytd_gain_threshold || '',
  });

  const update = (key, val) => setPrefs(p => ({ ...p, [key]: val }));

  const toggleMilestone = (amount) => {
    const current = prefs.notif_milestone_amounts;
    if (current.includes(amount)) {
      update('notif_milestone_amounts', current.filter(a => a !== amount));
    } else {
      update('notif_milestone_amounts', [...current, amount].sort((a, b) => a - b));
    }
  };

  const addCustomMilestone = () => {
    const val = parseFloat(customMilestone);
    if (!val || val <= 0) return;
    if (!prefs.notif_milestone_amounts.includes(val)) {
      update('notif_milestone_amounts', [...prefs.notif_milestone_amounts, val].sort((a, b) => a - b));
    }
    setCustomMilestone('');
  };

  const save = async () => {
    setSaving(true);
    await base44.entities.TSPProfile.update(activeProfile.id, {
      ...prefs,
      notif_fund_drop_threshold: prefs.notif_fund_drop_threshold ? parseFloat(prefs.notif_fund_drop_threshold) : null,
      notif_ytd_gain_threshold: prefs.notif_ytd_gain_threshold ? parseFloat(prefs.notif_ytd_gain_threshold) : null,
    });
    refreshProfiles();
    setSaving(false);
    toast({ title: 'Notification preferences saved', duration: 2000 });
  };

  const Row = ({ icon: Icon, label, desc, checked, onToggle, children }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{label}</p>
            {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onToggle} />
      </div>
      {children}
    </div>
  );

  // The stored value is Eastern because the job compares against an ET clock,
  // but people set it thinking in their own timezone — this has now caused two
  // rounds of "why didn't it send when I asked?". Show what it means locally.
  // Near a DST boundary this can be an hour out for times within an hour of the
  // switch; it's a hint, not the schedule itself.
  const localEmailTime = (() => {
    const hhmm = prefs.notif_email_time;
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    const now = new Date();
    // Find the UTC instant whose New York wall clock reads hh:mm today: take the
    // naive UTC guess, then shift it by that instant's ET-to-UTC gap.
    const naive = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const d = new Date(naive);
    const etWall = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const utcWall = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    const local = new Date(naive + (utcWall - etWall));
    if (isNaN(local.getTime())) return null;
    return local.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  })();

  return (
    <div className="p-4 bg-card rounded-xl border border-border space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Notification Preferences</h3>
      </div>

      {/* Email settings */}
      <div className="space-y-3 pb-4 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Notification email</label>
          <Input
            value={prefs.notif_email_address}
            onChange={e => update('notif_email_address', e.target.value)}
            placeholder="your@email.com"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Nightly email time (ET)</label>
          <Input
            type="time"
            value={prefs.notif_email_time}
            onChange={e => update('notif_email_time', e.target.value)}
            className="h-9 text-sm w-32"
          />
          {/* The stored value is Eastern because the job compares against an ET
              clock, but most people set it thinking in their own timezone — so
              show what it actually means locally instead of making them convert. */}
          {localEmailTime && (
            <p className="text-[10px] text-muted-foreground">
              {localEmailTime} your time · sends once the day's balance is in
            </p>
          )}
        </div>
      </div>

      {/* Email toggles */}
      <div className="space-y-4 pb-4 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Alerts</p>
        
        <Row icon={Mail} label="Nightly balance email" desc="Daily summary with balance & fund performance"
          checked={prefs.notif_nightly_email} onToggle={v => update('notif_nightly_email', v)} />
        
        <Row icon={Trophy} label="New all-time high" desc="Celebrate when you hit a new record"
          checked={prefs.notif_all_time_high} onToggle={v => update('notif_all_time_high', v)} />
        
        <Row icon={TrendingDown} label="Big drop alert" desc="Alert when daily drop exceeds threshold"
          checked={prefs.notif_big_drop} onToggle={v => update('notif_big_drop', v)}>
          {prefs.notif_big_drop && (
            <div className="ml-6 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Threshold:</span>
              <Select
                value={String(prefs.notif_big_drop_threshold)}
                onValueChange={v => update('notif_big_drop_threshold', parseFloat(v))}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5].map(v => (
                    <SelectItem key={v} value={String(v)}>{v}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Row>

        <Row icon={Target} label="Goal off-track alert" desc="When projected goal date shifts 30+ days"
          checked={prefs.notif_goal_off_track} onToggle={v => update('notif_goal_off_track', v)} />

        <Row icon={BarChart3} label="Weekly goal check-in" desc="Monday summary of your progress"
          checked={prefs.notif_weekly_checkin} onToggle={v => update('notif_weekly_checkin', v)} />
      </div>

      {/* Custom alerts */}
      <div className="space-y-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setShowCustom(!showCustom)}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Alert Triggers</p>
          {showCustom ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>

        {showCustom && (
          <div className="space-y-5">
            {/* Milestone amounts */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Balance milestone alerts</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_MILESTONES.map(amt => (
                  <button
                    key={amt}
                    onClick={() => toggleMilestone(amt)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      prefs.notif_milestone_amounts.includes(amt)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    ${(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customMilestone}
                  onChange={e => setCustomMilestone(e.target.value)}
                  placeholder="Custom amount"
                  className="h-8 text-xs"
                  type="number"
                />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={addCustomMilestone}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {prefs.notif_milestone_amounts.filter(a => !PRESET_MILESTONES.includes(a)).map(amt => (
                <div key={amt} className="flex items-center gap-2 text-xs">
                  <span className="text-primary">${amt.toLocaleString()}</span>
                  <button onClick={() => toggleMilestone(amt)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Fund drop */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Alert when any single fund drops more than</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={prefs.notif_fund_drop_threshold}
                  onChange={e => update('notif_fund_drop_threshold', e.target.value)}
                  placeholder="e.g. 3"
                  className="h-8 text-xs w-24"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>

            {/* Near goal date */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Alert when within X days of goal date</p>
              <Select
                value={String(prefs.notif_near_goal_days)}
                onValueChange={v => update('notif_near_goal_days', parseInt(v))}
              >
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 60, 90, 180, 365].map(d => (
                    <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* YTD gain */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Alert when YTD gain exceeds</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={prefs.notif_ytd_gain_threshold}
                  onChange={e => update('notif_ytd_gain_threshold', e.target.value)}
                  placeholder="e.g. 10"
                  className="h-8 text-xs w-24"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-9 text-sm">
        {saving ? 'Saving...' : 'Save Notification Preferences'}
      </Button>
    </div>
  );
}