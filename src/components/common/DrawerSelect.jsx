import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Check, ChevronDown } from 'lucide-react';

const MOBILE_QUERY = '(max-width: 639px)';

/**
 * Renders a standard shadcn Select on desktop and a slide-up vaul Drawer
 * picker on mobile (<640px), matching the native feel used elsewhere in the app.
 */
export default function DrawerSelect({ value, onChange, options, label }) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const selected = options.find((o) => o.value === value);

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between h-9 px-3 mt-1 rounded-md border border-input bg-transparent text-sm select-none"
      >
        <span className="truncate">{selected?.label || ''}</span>
        <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors select-none"
                  style={{
                    borderColor: isSelected ? 'rgba(201,168,50,0.5)' : 'hsl(var(--border))',
                    background: isSelected ? 'rgba(201,168,50,0.08)' : 'transparent',
                  }}
                >
                  <span className="text-sm font-medium text-left">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A832' }} />}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}