import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import ThemePicker from '@/components/settings/ThemePicker';
import ProfileManager from '@/components/settings/ProfileManager';
import GoalSettings from '@/components/settings/GoalSettings';
import OpeningBalanceSettings from '@/components/settings/OpeningBalanceSettings';
import AppGuide from '@/components/settings/AppGuide';
import NotificationSettings from '@/components/settings/NotificationSettings';
import EntryMethodSettings from '@/components/settings/EntryMethodSettings';
import CurrentBalanceSettings from '@/components/settings/CurrentBalanceSettings';
import ContributionsSettings from '@/components/settings/ContributionsSettings';
import TaxEstimator from '@/components/settings/TaxEstimator';
import AccountSetupForm from '@/components/settings/AccountSetupForm';
import UpgradePrompt from '@/components/common/UpgradePrompt';
import PlanStatusCard from '@/components/settings/PlanStatusCard';
import { Button } from '@/components/ui/button';
import { LogOut, Trash2, RotateCcw } from 'lucide-react';
import { useFeature } from '@/lib/proGating';
import { motion } from 'framer-motion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SettingsEnhanced() {
  const { activeProfile, resetAccount } = useProfile();
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const setupComplete = !!activeProfile;
  const { allowed: isPaid } = useFeature('notifications');

  const handleResetAccount = async () => {
    setResetting(true);
    await resetAccount();
    setResetting(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    await resetAccount();
    await base44.auth.logout();
  };

  // Show setup form if not set up yet
  if (!setupComplete) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AccountSetupForm />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <h2 className="text-lg font-bold mb-4">Settings</h2>

        <PlanStatusCard profile={activeProfile} />
        <ThemePicker />
        <ProfileManager />
        <OpeningBalanceSettings />
        <CurrentBalanceSettings />
        <EntryMethodSettings />
        <ContributionsSettings />
        {isPaid ? (
          <>
            <NotificationSettings />
            <GoalSettings />
            <TaxEstimator />
          </>
        ) : (
          <UpgradePrompt feature="notifications" />
        )}
        <AppGuide />

        <Button
          variant="outline"
          className="w-full min-h-[44px] border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>

        {/* Danger Zone */}
        <div className="border border-destructive/20 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Clear all your TSP data and start fresh. Your account stays active.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full min-h-[44px] border-destructive/30 text-destructive hover:bg-destructive/10">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Your Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all your TSP data (balances, allocations, history, settings) and take you back to the setup screen. Your login stays active. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
                    onClick={handleResetAccount}
                    disabled={resetting}
                  >
                    {resetting ? 'Resetting...' : 'Yes, Reset Everything'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="border-t border-destructive/10 pt-3 space-y-1">
            <p className="text-xs text-muted-foreground">Permanently delete your account and all TSP data. This cannot be undone.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full min-h-[44px]">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your TSP profile and all associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </motion.div>
    </div>
  );
}