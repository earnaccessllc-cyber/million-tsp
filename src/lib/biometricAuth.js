import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { supabase } from '@/api/base44Client';

// Only the Supabase refresh token is ever stored on-device (never the
// password) — it lives in the OS Keychain/Keystore behind SecureStorage,
// and every access to it is gated by a Face ID / Touch ID / fingerprint
// prompt via BiometricAuth. This only applies on native iOS/Android builds;
// the web build has no equivalent, so all of these no-op / report
// unavailable in a plain browser.
const REFRESH_TOKEN_KEY = 'biometric_refresh_token';

function labelFor(biometryType) {
  switch (biometryType) {
    case BiometryType.faceId:
    case BiometryType.faceAuthentication:
      return 'Face ID';
    case BiometryType.touchId:
    case BiometryType.fingerprintAuthentication:
      return 'Touch ID';
    case BiometryType.irisAuthentication:
      return 'Iris Scan';
    default:
      return 'Biometric Login';
  }
}

// Info about what this device supports, for rendering the right button/copy.
export async function getBiometryInfo() {
  if (!Capacitor.isNativePlatform()) {
    return { isAvailable: false, label: 'Biometric Login' };
  }
  try {
    const result = await BiometricAuth.checkBiometry();
    return { isAvailable: result.isAvailable, label: labelFor(result.biometryType) };
  } catch {
    return { isAvailable: false, label: 'Biometric Login' };
  }
}

// Whether this device already has a saved session to unlock with biometrics.
export async function hasBiometricLoginEnabled() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return !!(await SecureStorage.getItem(REFRESH_TOKEN_KEY));
  } catch {
    return false;
  }
}

// Call after a successful password sign-in to opt this device into
// Face ID / biometric login going forward.
export async function enableBiometricLogin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.refresh_token) throw new Error('No active session to save.');
  await BiometricAuth.authenticate({ reason: 'Confirm to enable biometric login' });
  await SecureStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
}

export async function disableBiometricLogin() {
  await SecureStorage.removeItem(REFRESH_TOKEN_KEY).catch(() => {});
}

// Supabase rotates the refresh token each time it's used, so keep the
// stored copy current whenever the session changes — otherwise the token
// saved at enable-time goes stale the next time the app silently refreshes
// in the background, and biometric login would fail later.
export async function syncBiometricRefreshToken(session) {
  if (!session?.refresh_token || !(await hasBiometricLoginEnabled())) return;
  await SecureStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token).catch(() => {});
}

// The actual "log in with Face ID" action for the login screen.
export async function signInWithBiometrics() {
  await BiometricAuth.authenticate({ reason: 'Sign in to MillionTSP' });
  const refreshToken = await SecureStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('Biometric login is not set up on this device.');
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) {
    await disableBiometricLogin();
    throw error;
  }
  if (data.session?.refresh_token) {
    await SecureStorage.setItem(REFRESH_TOKEN_KEY, data.session.refresh_token).catch(() => {});
  }
  return data.session;
}
