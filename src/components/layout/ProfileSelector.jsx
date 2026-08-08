import React from 'react';
import { useProfile } from '@/context/ProfileContext';
import TSPWordmark from '@/components/branding/TSPWordmark';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProfileSelector({ notificationBell }) {
  const { profiles, activeProfile, setActiveProfileId } = useProfile();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14"
      style={{ background: 'rgba(8,8,10,0.92)', borderBottom: '1px solid rgba(201,168,50,0.15)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-2">
        <TSPWordmark />
      </div>

      <div className="flex items-center gap-2">
        {notificationBell}
      </div>
    </header>
  );
}