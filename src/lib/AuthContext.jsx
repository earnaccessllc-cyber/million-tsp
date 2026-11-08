import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { supabase, base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Supabase fires several auth events on every launch and login
  // (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED) on top of the explicit
  // check from the login screen. Each used to flip isLoadingAuth back on,
  // which unmounted the whole app (profile included) and remounted it —
  // the flash of an empty, new-user looking account right after login.
  // Only the very first check shows the loading screen; re-checks for the
  // same user leave the app mounted, and concurrent checks share one call.
  const userIdRef = useRef(null);
  const inFlightRef = useRef(null);

  const checkUserAuth = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const run = (async () => {
    try {
      if (!userIdRef.current) setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await base44.auth.me();
      if (userIdRef.current !== currentUser.id) {
        userIdRef.current = currentUser.id;
        setUser(currentUser);
      }
      setIsAuthenticated(true);
    } catch (error) {
      userIdRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      inFlightRef.current = null;
    }
    })();
    inFlightRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    checkUserAuth();

    // Keep auth state in sync with Supabase's own session (handles token
    // refresh, sign-in/out from another tab, magic-link redirects, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        checkUserAuth();
      } else {
        userIdRef.current = null;
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserAuth]);

  // Await the sign-out so the persisted session is fully cleared before the
  // page reloads — otherwise the reload can pick the old session back up.
  const logout = async () => {
    await base44.auth.logout(false);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/app/';
  };

  const navigateToLogin = async () => {
    await base44.auth.logout(false);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/app/';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      // Base44 had a separate "is this app's public config loaded" phase
      // (app-level registration gating). Supabase has no such concept — any
      // authenticated user is a valid user — so these stay permanently resolved.
      isLoadingPublicSettings: false,
      appPublicSettings: null,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
