import React, { createContext, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  // ProfileProvider only ever mounts once AuthContext has already resolved
  // an authenticated user (see App.jsx), so `user` is guaranteed here —
  // no need for a second, independent auth.me() round-trip with its own
  // race/timeout (that duplicate call used to time out on slow connections
  // and wrongly report "no profile", bouncing the user into onboarding).
  const { user } = useAuth();
  const currentUserId = user?.id || null;
  const queryClient = useQueryClient();

  // Clear the old localStorage keys that were the source of cross-user leakage.
  useEffect(() => {
    localStorage.removeItem('tsp-active-profile');
    localStorage.removeItem('onboardingComplete');
  }, []);

  // Base44 entity SDK automatically filters by created_by_id (the logged-in user).
  // We include currentUserId in the query key so React Query never serves a
  // cached result from a different user's session.
  const { data: rawProfiles = [], isLoading: queryLoading } = useQuery({
    queryKey: ['tsp-profiles', currentUserId],
    queryFn: () => base44.entities.TSPProfile.list('-updated_date'),
    enabled: !!currentUserId,
    staleTime: 0,
  });

  // Auto-deduplicate: if multiple profiles exist, silently delete all but the most
  // recently updated one. One profile per user — always.
  useEffect(() => {
    if (rawProfiles.length > 1) {
      const [keep, ...duplicates] = rawProfiles; // sorted by -updated_date, so first is newest
      duplicates.forEach(p => base44.entities.TSPProfile.delete(p.id).catch(() => {}));
    }
  }, [rawProfiles]);

  const profiles = rawProfiles.slice(0, 1); // always expose at most one

  // currentUserId is available as soon as this provider mounts (see above),
  // so loading is just whether the profile query itself is in flight.
  const isLoading = !!currentUserId && queryLoading;

  // The active profile is always the single profile for this user.
  const activeProfile = profiles[0] || null;
  const activeProfileId = activeProfile?.id || null;

  const refreshProfiles = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tsp-profiles', currentUserId] });
    await queryClient.refetchQueries({ queryKey: ['tsp-profiles', currentUserId] });
  };

  // Reset: delete all user data for the current user, then re-trigger onboarding
  const resetAccount = async () => {
    if (!activeProfile) return;
    try {
      // Delete all related data
      const [funds, balances, snapshots, notifications, beneficiaries, summaries, openingHistory] = await Promise.all([
        base44.entities.FundAllocation.filter({ profile_id: activeProfile.id }),
        base44.entities.DailyBalance.filter({ profile_id: activeProfile.id }),
        base44.entities.FundDailySnapshot.filter({ profile_id: activeProfile.id }),
        base44.entities.AppNotification.filter({ profile_id: activeProfile.id }),
        base44.entities.Beneficiary.filter({ profile_id: activeProfile.id }),
        base44.entities.AnnualSummary.filter({ profile_id: activeProfile.id }),
        base44.entities.OpeningBalanceHistory.filter({ profile_id: activeProfile.id }),
      ]);

      await Promise.all([
        ...funds.map(r => base44.entities.FundAllocation.delete(r.id)),
        ...balances.map(r => base44.entities.DailyBalance.delete(r.id)),
        ...snapshots.map(r => base44.entities.FundDailySnapshot.delete(r.id)),
        ...notifications.map(r => base44.entities.AppNotification.delete(r.id)),
        ...beneficiaries.map(r => base44.entities.Beneficiary.delete(r.id)),
        ...summaries.map(r => base44.entities.AnnualSummary.delete(r.id)),
        ...openingHistory.map(r => base44.entities.OpeningBalanceHistory.delete(r.id)),
      ]);

      // Delete the profile itself last
      await base44.entities.TSPProfile.delete(activeProfile.id);
    } catch (e) {
      console.error('Reset error:', e);
    }

    // Clear React Query cache so the app immediately shows setup
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: ['tsp-profiles', currentUserId] });
    queryClient.refetchQueries({ queryKey: ['tsp-profiles', currentUserId] });
  };

  return (
    <ProfileContext.Provider value={{
      profiles,
      activeProfile,
      activeProfileId,
      setActiveProfileId: () => {}, // no-op — kept for API compatibility
      isLoading,
      refreshProfiles,
      resetAccount,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}