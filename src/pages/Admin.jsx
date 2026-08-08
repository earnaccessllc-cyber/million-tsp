import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = 'antonio@earnaccessllc.com';

const PLAN_BADGE = {
  paid: { label: 'PAID', bg: '#166534', color: '#86efac' },
  trial: { label: 'TRIAL', bg: '#713f12', color: '#fde68a' },
  free: { label: 'FREE', bg: '#374151', color: '#9ca3af' },
};

export default function Admin() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(null);
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState({}); // userId → TSPProfile
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState({}); // userId → true

  useEffect(() => {
    const init = async () => {
      const me = await base44.auth.me().catch(() => null);
      if (!me || me.email !== ADMIN_EMAIL) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);

      const allUsers = await base44.entities.User.list();
      const allProfiles = await base44.entities.TSPProfile.list();

      console.log('Admin: users', allUsers.length, 'profiles', allProfiles.length);

      const profileMap = {};
      for (const p of allProfiles) {
        const key = p.user_id || p.created_by_id;
        if (key) profileMap[key] = p;
      }

      setUsers(allUsers);
      setProfiles(profileMap);
      setLoading(false);
    };
    init();
  }, []);

  const updatePlan = async (userId, planData) => {
    const profile = profiles[userId];
    if (!profile) return;
    await base44.entities.TSPProfile.update(profile.id, planData);
    setProfiles(prev => ({ ...prev, [userId]: { ...prev[userId], ...planData } }));
    setSaved(prev => ({ ...prev, [userId]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [userId]: false })), 2000);
  };

  if (authorized === false) return null;
  if (authorized === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#08080a' }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#FFD700', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const paid = users.filter(u => profiles[u.id]?.plan === 'paid').length;
  const trial = users.filter(u => profiles[u.id]?.plan === 'trial').length;
  const free = users.filter(u => profiles[u.id] && profiles[u.id].plan !== 'paid' && profiles[u.id].plan !== 'trial').length;

  return (
    <div className="min-h-screen pb-12" style={{ background: '#08080a' }}>
      {/* Header */}
      <div className="px-4 pt-8 pb-4 border-b border-yellow-900/40">
        <h1 className="font-orbitron text-2xl font-bold tracking-widest" style={{ color: '#FFD700' }}>
          MillionTSP Admin
        </h1>
        <p className="text-sm text-gray-400 mt-1">User Management</p>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Total', value: users.length, color: '#FFD700' },
            { label: 'Paid', value: paid, color: '#86efac' },
            { label: 'Free', value: free, color: '#9ca3af' },
            { label: 'Trial', value: trial, color: '#fde68a' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: '#111' }}>
              <div className="text-xl font-bold font-orbitron" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* User cards */}
      <div className="px-4 mt-4 space-y-3">
        {users.map(user => {
          const profile = profiles[user.id];
          const plan = profile?.plan || null;
          const badge = plan ? PLAN_BADGE[plan] || PLAN_BADGE.free : null;

          return (
            <div key={user.id} className="rounded-xl p-4 border border-gray-800" style={{ background: '#111' }}>
              {/* Name + email + badge row */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-white">{user.full_name || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    Joined {user.created_date ? new Date(user.created_date).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {badge ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">NO PROFILE</span>
                  )}
                  {profile?.trial_used && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">trial used</span>
                  )}
                </div>
              </div>

              {/* Plan controls */}
              {profile ? (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Free', action: () => updatePlan(user.id, { plan: 'free' }) },
                    { label: 'Trial', action: () => updatePlan(user.id, { plan: 'free', trial_used: false }) },
                    { label: 'Paid', action: () => updatePlan(user.id, { plan: 'paid', trial_used: true }) },
                  ].map(btn => {
                    const isActive =
                      (btn.label === 'Paid' && plan === 'paid') ||
                      (btn.label === 'Trial' && plan === 'trial') ||
                      (btn.label === 'Free' && (plan === 'free' || !plan));
                    return (
                      <button
                        key={btn.label}
                        onClick={btn.action}
                        className="px-3 py-1 text-xs font-semibold rounded-lg border transition-colors"
                        style={isActive
                          ? { background: '#FFD700', color: '#080800', borderColor: '#FFD700' }
                          : { background: 'transparent', color: '#9ca3af', borderColor: '#374151' }
                        }
                      >
                        {btn.label}
                      </button>
                    );
                  })}

                  {/* Unlimited Access toggle */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] text-gray-500">Unlimited</span>
                    <button
                      onClick={() => updatePlan(user.id, plan === 'paid' ? { plan: 'free' } : { plan: 'paid', trial_used: true })}
                      className={`relative w-9 h-5 rounded-full transition-colors ${plan === 'paid' ? 'bg-yellow-500' : 'bg-gray-700'}`}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform"
                        style={{ transform: plan === 'paid' ? 'translateX(16px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>

                  {saved[user.id] && (
                    <span className="text-[10px] text-green-400 font-semibold ml-1">Saved!</span>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-gray-600 mt-2">No TSPProfile found for this user.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}