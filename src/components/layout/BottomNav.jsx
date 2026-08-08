import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PieChart, Shield, BarChart2, Settings } from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/funds', icon: PieChart, label: 'Funds' },
  { path: '/retirement', icon: Shield, label: 'Retire' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav({ getTabPath = (p) => p }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t border-border" style={{ background: 'rgba(8,8,10,0.95)', borderColor: 'rgba(201,168,50,0.15)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => navigate(getTabPath(path))}
              className="flex flex-col items-center py-3 px-4 min-h-[56px] justify-center transition-colors duration-200 select-none flex-1"
              style={{ color: isActive ? '#C9A832' : 'hsl(var(--muted-foreground))' }}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className={`text-xs mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}