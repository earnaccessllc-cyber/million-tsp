/**
 * Trial utility functions shared across the app.
 */

export function getTrialStatus(profile) {
  if (!profile) return { plan: 'free', isOnTrial: false, isExpired: false, daysRemaining: 0 };

  const plan = profile.plan;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (plan === 'paid') {
    return { plan: 'paid', isOnTrial: false, isExpired: false, daysRemaining: 0 };
  }

  if (plan === 'trial' && profile.trial_end_date) {
    const endDate = new Date(profile.trial_end_date);
    endDate.setHours(0, 0, 0, 0);
    const msRemaining = endDate - today;
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    if (daysRemaining > 0) {
      return { plan: 'trial', isOnTrial: true, isExpired: false, daysRemaining };
    } else {
      return { plan: 'trial', isOnTrial: false, isExpired: true, daysRemaining: 0 };
    }
  }

  return { plan: 'free', isOnTrial: false, isExpired: false, daysRemaining: 0 };
}

// "paid" and active "trial" both get full access
export function hasFullAccess(profile) {
  const { plan, isOnTrial } = getTrialStatus(profile);
  return plan === 'paid' || isOnTrial;
}