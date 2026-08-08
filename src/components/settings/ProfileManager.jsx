import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Input } from '@/components/ui/input';
import { CheckCircle2, User } from 'lucide-react';

export default function ProfileManager() {
  const { activeProfile, refreshProfiles } = useProfile();
  const [name, setName] = useState(activeProfile?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(activeProfile?.name || '');
  }, [activeProfile?.id, activeProfile?.name]);

  if (!activeProfile) return null;

  const handleSave = async () => {
    if (!name.trim() || name === activeProfile.name) return;
    setSaving(true);
    await base44.entities.TSPProfile.update(activeProfile.id, { name: name.trim() });
    await refreshProfiles();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Account Name
      </h3>
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Input
          value={name}
          onChange={e => { setName(e.target.value); setSaved(false); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          onBlur={handleSave}
          className="h-9 text-sm"
          placeholder="My TSP"
        />
        {saved && <CheckCircle2 className="w-4 h-4 text-gain flex-shrink-0" />}
      </div>
    </div>
  );
}