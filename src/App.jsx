import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProfileProvider } from '@/context/ProfileContext';
import AppLayout from '@/components/layout/AppLayout';
import SplashScreen from '@/components/branding/SplashScreen';
import Login from '@/pages/Login';
import Admin from '@/pages/Admin';

// Pages are now imported directly inside AppLayout for multi-stack tab preservation

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();
  const [showSplash, setShowSplash] = React.useState(() => {
    const seen = sessionStorage.getItem('tsp_splash_seen');
    return !seen;
  });

  const handleSplashDone = () => {
    sessionStorage.setItem('tsp_splash_seen', '1');
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashDone} />;
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#08080a' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A832', borderTopColor: 'transparent' }}></div>
          <span className="text-sm" style={{ color: '#C9A832' }}>Loading MillionTSP...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoadingAuth) {
    return <Login />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // All other errors — fall through and render the app.
  }

  return (
    <ProfileProvider>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/*" element={<AppLayout />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </ProfileProvider>
  );

};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ThemeProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App