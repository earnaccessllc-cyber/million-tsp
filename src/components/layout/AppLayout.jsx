import React, { useRef, useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from './BottomNav';
import NavigationHeader from '@/components/layout/NavigationHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import { NotificationProvider } from '@/context/NotificationContext';
import { useProfile } from '@/context/ProfileContext';
import TrialBanner from '@/components/trial/TrialBanner';
import PaywallScreen from '@/components/trial/PaywallScreen';
import { getTrialStatus } from '@/lib/trialUtils';
import { RetirementSaveBarProvider, useRetirementSaveBar } from '@/context/RetirementSaveBarContext';
import { Button } from '@/components/ui/button';
import { Save, CheckCircle2 } from 'lucide-react';

// Lazy-import all tab pages to avoid circular deps — they're already imported in App.jsx
import Dashboard from '@/pages/Dashboard';
import FundsEnhanced from '@/pages/FundsEnhanced';
import FundPriceLookup from '@/pages/FundPriceLookup';
import RetirementEnhanced from '@/pages/RetirementEnhanced';
import Analytics from '@/pages/Analytics';
import SettingsEnhanced from '@/pages/SettingsEnhanced';

// Map each route to its root tab index for slide direction
const TAB_ORDER = ['/', '/funds', '/retirement', '/analytics', '/settings'];

function tabRootOf(pathname) {
  for (let i = TAB_ORDER.length - 1; i >= 0; i--) {
    const root = TAB_ORDER[i];
    if (root === '/') {
      if (pathname === '/') return '/';
    } else if (pathname === root || pathname.startsWith(root + '/')) {
      return root;
    }
  }
  return '/';
}

function getTabIndex(pathname) {
  return TAB_ORDER.indexOf(tabRootOf(pathname));
}

// Sub-page routes rendered on top of the hidden-tab stack (slide in from right)
function SubPageRoutes() {
  const location = useLocation();
  const isSubPage = !TAB_ORDER.includes(location.pathname);

  return (
    <AnimatePresence>
      {isSubPage && (
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-0 z-10 bg-background overflow-y-auto overflow-x-hidden pb-safe scroll-container"
          style={{ willChange: 'transform, opacity', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
        >
          <Routes>
            <Route path="/funds/history" element={<FundPriceLookup />} />
          </Routes>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Renders the actual fixed "Save" bar for the Retirement tab, published via
// RetirementSaveBarContext by RetirementEnhanced. Rendered as a plain sibling
// of BottomNav (not portaled, not nested inside the animated/momentum-scrolling
// tab stack) because that's the one structure that's proven to stay reliably
// fixed on iOS Safari in this app — BottomNav itself never drifts.
function RetirementSaveBar() {
  const location = useLocation();
  const { state } = useRetirementSaveBar();
  const isRetirementTab = location.pathname === '/retirement' || location.pathname.startsWith('/retirement/');
  if (!isRetirementTab || !state) return null;

  const { saveStatus, hasPending, onSave } = state;
  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <Button
        size="lg"
        disabled={saveStatus === 'saving' || saveStatus === 'saved' || !hasPending}
        onClick={onSave}
        className="pointer-events-auto w-full max-w-lg gap-2 h-12 text-sm font-bold rounded-xl border-0 disabled:opacity-50"
        style={{
          background: 'linear-gradient(135deg, #FFD700 0%, #C9A832 100%)',
          color: '#000',
          boxShadow: '0 4px 20px rgba(201,168,50,0.45)',
        }}
      >
        {saveStatus === 'saving' && <><Save className="w-4 h-4 animate-pulse" /> Saving…</>}
        {saveStatus === 'saved' && <><CheckCircle2 className="w-4 h-4" /> Saved</>}
        {saveStatus === 'idle' && <><Save className="w-4 h-4" /> {hasPending ? 'Save Changes' : 'Saved'}</>}
      </Button>
    </div>
  );
}

export default function AppLayout() {
  return (
    <RetirementSaveBarProvider>
      <AppLayoutInner />
    </RetirementSaveBarProvider>
  );
}

function AppLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const prevTabRef = useRef(getTabIndex(location.pathname));
  const currTab = getTabIndex(location.pathname);
  prevTabRef.current = currTab;
  // Per-tab sub-route memory — remembers the last active path under each tab
  const tabHistoryRef = useRef({});
  const { activeProfile, isLoading: profileLoading } = useProfile();
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isSubPage = !TAB_ORDER.includes(location.pathname);
  const isOnSettings = location.pathname === '/settings';

  // Once loading is done: if no profile exists, send to settings; if profile exists and on settings root, send to dashboard
  useEffect(() => {
    if (profileLoading) return;
    if (!activeProfile && !isOnSettings) {
      navigate('/settings', { replace: true });
    }
  }, [profileLoading, activeProfile, isOnSettings]);

  // Record the current route under its owning tab so switching back to the tab restores it
  useEffect(() => {
    const root = tabRootOf(location.pathname);
    tabHistoryRef.current[root] = location.pathname;
  }, [location.pathname]);

  // Show onboarding chrome (no nav/header) only while loading or when no profile and not on settings
  const isOnboarding = profileLoading ? false : (!activeProfile && !isOnSettings);

  // Each tab stays mounted but hidden — preserves scroll + state
  const tabRoutes = [
    { path: '/', component: <Dashboard /> },
    { path: '/funds', component: <FundsEnhanced /> },
    { path: '/retirement', component: <RetirementEnhanced /> },
    { path: '/analytics', component: <Analytics /> },
    { path: '/settings', component: <SettingsEnhanced /> },
  ];

  const trialStatus = getTrialStatus(activeProfile);
  const showPaywall = trialStatus.isExpired && !paywallDismissed;
  const showBanner = trialStatus.isOnTrial && !bannerDismissed;

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {!isOnboarding && <NavigationHeader notificationBell={<NotificationBell />} />}
        {!isOnboarding && showBanner && (
          <TrialBanner profile={activeProfile} onDismiss={() => setBannerDismissed(true)} />
        )}
        {showPaywall && (
          <PaywallScreen onContinueFree={() => setPaywallDismissed(true)} />
        )}
        <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          {/* Hidden-tab stack: all tabs stay mounted, only active one is visible */}
          {tabRoutes.map(({ path, component }) => {
            const tabIdx = getTabIndex(path);
            const isActive = currTab === tabIdx && !isSubPage;
            return (
              <motion.div
                key={path}
                animate={{
                  opacity: isActive ? 1 : 0,
                  x: isActive ? 0 : (tabIdx < currTab ? -16 : 16),
                }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: isActive ? 'auto' : 'none',
                  willChange: 'transform, opacity',
                  overflowY: isActive ? 'auto' : 'hidden',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  scrollBehavior: 'smooth',
                }}
                className={`scroll-container ${isOnboarding ? '' : 'pb-safe'}`}
              >
                {component}
              </motion.div>
            );
          })}

          {/* Sub-pages render on top */}
          <SubPageRoutes />
        </main>
        {!isOnboarding && <RetirementSaveBar />}
        {!isOnboarding && <BottomNav getTabPath={(tab) => tabHistoryRef.current[tab] || tab} />}
      </div>
    </NotificationProvider>
  );
}