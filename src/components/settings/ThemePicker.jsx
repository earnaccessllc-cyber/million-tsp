import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Check } from 'lucide-react';

const themes = [
  { id: 'black', label: 'Black/Gold', colors: ['#0a0a0a', '#eab308'] },
  { id: 'light', label: 'White/Gold', colors: ['#fafafa', '#eab308'] },
];

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Color Theme
      </h3>
      <div className="flex gap-4">
        {themes.map(t => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className={`relative w-12 h-12 rounded-xl border-2 transition-all ${
                theme === t.id ? 'border-primary scale-110' : 'border-border'
              }`}
              style={{ background: `linear-gradient(135deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)` }}
            >
              {theme === t.id && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white drop-shadow-lg" />
                </div>
              )}
            </div>
            <span className={`text-[10px] font-medium ${theme === t.id ? 'text-primary' : 'text-muted-foreground'}`}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}