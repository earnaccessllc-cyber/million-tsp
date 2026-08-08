import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ALL_FUNDS } from '@/lib/tspFunds';
import { fetchLivePricesSheet } from '@/functions/fetchLivePricesSheet';
import { parseDollar } from './ob-constants';
import ObStep1 from './ObStep1';
import ObStep1b from './ObStep1b';
import ObStep2 from './ObStep2';
import ObStep3 from './ObStep3';
import ObLoading from './ObLoading';

export default function OnboardingFlow() {
  const { refreshProfiles } = useProfile();
  const { navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState({
    total_balance_manual: '',
    opening_balance: '',
    allocations: {},
    has_mfw: false,
    mfw_pct: '',
    mfw_balance: '',
    date_of_birth: '',
    career_start_date: '',
    retirement_system: 'FERS',
    balance_goal: '1,000,000',
    pay_schedule: 'biweekly',
    ob_trad_pct: '',
    ob_trad_dollar: '',
    ob_roth_pct: '',
    ob_roth_dollar: '',
  });

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSaveError('');

    try {
      // Verify auth is still valid before attempting any saves
      const currentUser = await base44.auth.me().catch(() => null);
      if (!currentUser) {
        navigateToLogin();
        return;
      }
      const totalManual = parseDollar(form.total_balance_manual);
      const openBal = parseDollar(form.opening_balance) || totalManual;
      const mfwBal = form.has_mfw ? (parseDollar(form.mfw_balance) || 0) : 0;
      const balanceGoal = parseDollar(form.balance_goal) || 1000000;
      const today = new Date().toISOString().split('T')[0];
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 3);
      const trialEndDate = trialEnd.toISOString().split('T')[0];

      // Check if a profile already exists — update it instead of creating a duplicate
      const existingProfiles = await base44.entities.TSPProfile.list();
      const existingProfile = existingProfiles[0] || null;
      const hadTrial = existingProfiles.some(p => p.trial_used === true);

      const profileData = {
        name: currentUser.full_name || 'My TSP',
        plan: hadTrial ? 'free' : 'trial',
        trial_start_date: hadTrial ? null : today,
        trial_end_date: hadTrial ? null : trialEndDate,
        trial_used: true,
        employment_type: 'civilian',
        entry_method: 'percent',
        total_balance_manual: totalManual || 0,
        opening_balance: openBal || 0,
        balance_last_confirmed: today,
        balance_install_date: today,
        has_mfw: form.has_mfw,
        mfw_balance: mfwBal,
        date_of_birth: form.date_of_birth || null,
        career_start_date: form.career_start_date || null,
        retirement_system: form.retirement_system || 'FERS',
        balance_goal: balanceGoal,
        pay_schedule: form.pay_schedule || 'biweekly',
        contrib_traditional_mode: form.ob_trad_pct ? 'percent' : (form.ob_trad_dollar ? 'dollar' : 'percent'),
        contrib_traditional_percent: parseFloat(form.ob_trad_pct) || 0,
        contrib_traditional_dollar: parseFloat(form.ob_trad_dollar) || 0,
        contrib_roth_mode: form.ob_roth_pct ? 'percent' : (form.ob_roth_dollar ? 'dollar' : 'percent'),
        contrib_roth_percent: parseFloat(form.ob_roth_pct) || 0,
        contrib_roth_dollar: parseFloat(form.ob_roth_dollar) || 0,
      };

      // Step 1: Update existing profile or create a new one — never create duplicates
      let profile;
      if (existingProfile) {
        profile = await base44.entities.TSPProfile.update(existingProfile.id, profileData);
        profile = { ...existingProfile, ...profileData }; // ensure id is present
      } else {
        profile = await base44.entities.TSPProfile.create(profileData);
      }

      if (!profile || !profile.id) {
        throw new Error('Profile could not be saved. Please try again.');
      }

      // Step 2: Fetch live prices (optional, 5s timeout — failure is fine)
      let livePrices = {};
      try {
        const res = await Promise.race([
          fetchLivePricesSheet({}),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]);
        for (const f of (res.data?.funds || [])) livePrices[f.fund_name] = f;
      } catch (_) { /* non-fatal */ }

      const nonMfwTotal = Math.max(0, totalManual - mfwBal);

      // Step 3: Create fund allocations — non-fatal if this fails
      try {
        await Promise.all(ALL_FUNDS.map(f => {
          const entry = form.allocations[f.name] || {};
          const isSelected = !!entry.selected;
          const allocPct = parseFloat(entry.pct) || 0;
          const closingPrice = livePrices[f.name]?.share_price ?? 0;
          const computedBalance = isSelected && nonMfwTotal > 0 ? nonMfwTotal * (allocPct / 100) : 0;
          const computedShares = computedBalance > 0 && closingPrice > 0 ? computedBalance / closingPrice : 0;
          return base44.entities.FundAllocation.create({
            profile_id: profile.id,
            fund_name: f.name,
            fund_type: f.key.startsWith('L') ? 'lifecycle' : 'core',
            is_selected: isSelected,
            allocation_percent: allocPct,
            balance: computedBalance,
            dollar_balance: computedBalance,
            shares: computedShares,
            share_price: closingPrice,
            last_price_update: closingPrice > 0 ? today : null,
          });
        }));
      } catch (allocError) {
        console.warn('Fund allocation save failed (non-fatal):', allocError);
        // User can fix allocations in Settings later
      }

      // Refresh profile context, then navigate to Dashboard
      await refreshProfiles();
      navigate('/', { replace: true });

    } catch (e) {
      console.error('Setup save error:', e);
      // Auth errors redirect to login instead of showing an inline error
      if (e?.status === 401 || e?.status === 403 || /auth|session|token/i.test(e?.message || '')) {
        navigateToLogin();
        return;
      }
      setSaveError(e?.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isSubmitting && !saveError) return <ObLoading />;

  return (
    <>
      {currentStep === 1 && (
        <ObStep1
          form={form}
          update={update}
          onNext={() => setCurrentStep(2)}
        />
      )}
      {currentStep === 2 && (
        <ObStep1b
          form={form}
          update={update}
          onNext={() => setCurrentStep(3)}
          onBack={() => setCurrentStep(1)}
        />
      )}
      {currentStep === 3 && (
        <ObStep2
          form={form}
          update={update}
          onNext={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
        />
      )}
      {currentStep === 4 && (
        <ObStep3
          form={form}
          update={update}
          onFinish={handleFinish}
          onBack={() => setCurrentStep(3)}
          saving={isSubmitting}
          saveError={saveError}
        />
      )}
    </>
  );
}