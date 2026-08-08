import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { Percent, DollarSign, ArrowRight, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function EntryMethodSettings() {
  const { activeProfile, refreshProfiles } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [method, setMethod] = useState(activeProfile?.entry_method || 'percent');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.TSPProfile.update(activeProfile.id, { entry_method: method });
    refreshProfiles();
    queryClient.invalidateQueries({ queryKey: ['fund-allocations', activeProfile.id] });
    setSaving(false);
    toast({ title: 'Tracking method updated', duration: 3000 });
  };

  const current = activeProfile?.entry_method || 'percent';

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowRight className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Balance Tracking Method</h3>
      </div>
      <p className="text-xs text-muted-foreground">Choose how you track your TSP fund balances. Funds tab will update to match.</p>

      <div className="space-y-2">
        <button
          onClick={() => setMethod('percent')}
          className={`w-full p-3 rounded-xl border text-left transition-all ${method === 'percent' ? 'bg-primary/10 border-primary' : 'border-border hover:border-primary/30'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${method === 'percent' ? 'bg-primary/20' : 'bg-muted'}`}>
              <Percent className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">% Allocation</p>
              <p className="text-xs text-muted-foreground">Enter total balance + % per fund</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setMethod('dollar')}
          className={`w-full p-3 rounded-xl border text-left transition-all ${method === 'dollar' ? 'bg-primary/10 border-primary' : 'border-border hover:border-primary/30'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${method === 'dollar' ? 'bg-primary/20' : 'bg-muted'}`}>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Dollar Amount</p>
              <p className="text-xs text-muted-foreground">Enter exact balance per fund</p>
            </div>
          </div>
        </button>
      </div>

      {method !== current && (
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Saving…' : 'Save Tracking Method'}
        </Button>
      )}
    </div>
  );
}