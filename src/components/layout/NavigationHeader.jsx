import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TSPWordmark from '@/components/branding/TSPWordmark';

// Root pages — show logo. Sub-pages — show back button.
const ROOT_PATHS = ['/', '/funds', '/retirement', '/analytics', '/ai-coach', '/settings'];

const PAGE_TITLES = {
  '/funds/history': 'Price History',
};

export default function NavigationHeader({ notificationBell }) {
  const location = useLocation();
  const navigate = useNavigate();

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

      {/* Right: notification bell only */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {notificationBell}
      </div>
    </header>
  );
}