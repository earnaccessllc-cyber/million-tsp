import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import TSPWordmark from '@/components/branding/TSPWordmark';
import { useAuth } from '@/lib/AuthContext';

// Root pages — show logo. Sub-pages — show back button.
const ROOT_PATHS = ['/', '/funds', '/retirement', '/analytics', '/ai-coach', '/settings'];

const PAGE_TITLES = {
  '/funds/history': 'Price History',
};

export default function NavigationHeader({ notificationBell }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isRoot = ROOT_PATHS.includes(location.pathname);
  const pageTitle = PAGE_TITLES[location.pathname] || '';

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4"
      style={{
        height: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'rgba(8,8,10,0.92)',
        borderBottom: '1px solid rgba(201,168,50,0.15)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: Back button OR Logo */}
      <div className="flex items-center gap-2 min-w-0">
        {isRoot ? (
          <TSPWordmark />
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-primary font-medium text-sm min-h-[44px] pr-2"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="truncate max-w-[120px]">{pageTitle || 'Back'}</span>
          </button>
        )}
      </div>

      {/* Right: notification bell + sign out */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {notificationBell}
        <button
          onClick={logout}
          className="flex items-center justify-center w-11 h-11 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}