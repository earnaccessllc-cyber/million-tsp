import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { formatCurrency } from '@/lib/tspFunds';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Save, Target } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function GoalSettings() {
  const { activeProfile, refreshProfiles } = useProfile();
  const { toast } = useToast();
  const [goal, setGoal] = useState(activeProfile?.balance_goal || 1000000);
  const [method, setMethod] = useState(activeProfile?.goal_method || 'trailing');
  const [fixedReturn, setFixedReturn] = useState(activeProfile?.fixed_annual_return || 7);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.TSPProfile.update(activeProfile.id, {
      balance_goal: goal,
      goal_method: method,
      fixed_annual_return: fixedReturn,
    });
    refreshProfiles();
    setSaving(false);
    toast({ title: 'Saved', description: 'Goal settings updated.' });
  };

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Balance Goal
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Goal Amount</Label>
          <Input
            type="number"
            value={goal}
            onChange={e => setGoal(parseFloat(e.target.value) || 0)}
            className="h-9 text-sm mt-1"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Fixed Return Rate</p>
            <p className="text-xs text-muted-foreground">
              {method === 'fixed' ? `Using ${fixedReturn}% annual return` : 'Using trailing average growth'}
            </p>
          </div>
          <Switch
            checked={method === 'fixed'}
            onCheckedChange={checked => setMethod(checked ? 'fixed' : 'trailing')}
          />
        </div>

        {method === 'fixed' && (
          <div>
            <Label className="text-xs text-muted-foreground">Annual Return %</Label>
            <Input
              type="number"
              step="0.1"
              value={fixedReturn}
              onChange={e => setFixedReturn(parseFloat(e.target.value) || 0)}
              className="h-9 text-sm mt-1"
            />
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          <Save className="w-4 h-4 mr-1" />
          Save Goal Settings
        </Button>
      </div>
    </div>
  );
}