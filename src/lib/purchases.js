import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

// These three identifiers come from the RevenueCat dashboard (Million TSP
// project) — confirmed against the live "default" offering on 2026-08-28.
// If any of these are renamed in RevenueCat, update them here too.
const ENTITLEMENT_ID = 'million_tsp_pro';
const OFFERING_ID = 'default';
const LIFETIME_PACKAGE_ID = '$rc_lifetime';

let configured = false;

export function isNative() {
  return Capacitor.getPlatform() !== 'web';
}

/**
 * Call once at app startup (see main.jsx). No-op on web — the existing
 * Stripe checkout flow there doesn't touch RevenueCat at all.
 */
export async function initPurchases() {
  if (!isNative() || configured) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
  if (!apiKey) {
    console.error('Missing VITE_REVENUECAT_IOS_API_KEY — RevenueCat will not be configured.');
    return;
  }
  try {
    await Purchases.configure({ apiKey });
    configured = true;
  } catch (e) {
    console.error('Purchases.configure failed:', e);
  }
}

function hasEntitlement(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}

/**
 * Runs the real Apple/Google In-App Purchase flow for the one-time Lifetime
 * unlock. Apple requires this path (not a web checkout) for unlocking
 * in-app digital features — see Guideline 3.1.1.
 *
 * Returns { success: true, customerInfo } or { success: false, reason }.
 * reason === 'cancelled' means the user backed out of the native purchase
 * sheet themselves — callers should treat that as silent, not an error.
 */
export async function purchaseLifetime() {
  if (!isNative()) return { success: false, reason: 'Not available on this platform.' };
  await initPurchases();

  try {
    const { current, all } = await Purchases.getOfferings();
    const offering = all?.[OFFERING_ID] || current;
    const pkg =
      offering?.lifetime ||
      offering?.availablePackages?.find(p => p.identifier === LIFETIME_PACKAGE_ID);

    if (!pkg) {
      return { success: false, reason: 'Lifetime plan is not available right now. Please try again later.' };
    }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    if (hasEntitlement(customerInfo)) {
      return { success: true, customerInfo };
    }
    return { success: false, reason: 'Purchase completed but access was not granted. Please contact support.' };
  } catch (e) {
    if (e?.userCancelled) return { success: false, reason: 'cancelled' };
    return { success: false, reason: e?.message || 'Purchase failed. Please try again.' };
  }
}

/**
 * Standard "Restore Purchases" flow — required by Apple guidelines for any
 * paid unlock, so a user who reinstalls or switches devices doesn't have to
 * pay twice.
 */
export async function restorePurchases() {
  if (!isNative()) return { success: false, reason: 'Not available on this platform.' };
  await initPurchases();
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    if (hasEntitlement(customerInfo)) return { success: true, customerInfo };
    return { success: false, reason: 'No previous purchase was found for this Apple ID.' };
  } catch (e) {
    return { success: false, reason: e?.message || 'Restore failed. Please try again.' };
  }
}
