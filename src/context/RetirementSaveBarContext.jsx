import React, { createContext, useContext, useState, useCallback } from 'react';

// Lets RetirementEnhanced (deep inside the animated, momentum-scrolling tab
// stack) hand its save state up to AppLayout, which renders the actual fixed
// button as a plain sibling of BottomNav — the exact same DOM position/pattern
// BottomNav already uses and that reliably stays fixed on iOS Safari. A
// React-portaled fixed element inside the same page as this app's
// -webkit-overflow-scrolling:touch tab container was unreliable on Safari
// (position:fixed can misbehave there during momentum scroll); matching
// BottomNav's own structure sidesteps that entirely instead of fighting it.
const RetirementSaveBarContext = createContext(null);

export function RetirementSaveBarProvider({ children }) {
  const [state, setState] = useState(null); // null when the Retirement tab has nothing to publish

  const publish = useCallback((next) => setState(next), []);
  const clear = useCallback(() => setState(null), []);

  return (
    <RetirementSaveBarContext.Provider value={{ state, publish, clear }}>
      {children}
    </RetirementSaveBarContext.Provider>
  );
}

export function useRetirementSaveBar() {
  const ctx = useContext(RetirementSaveBarContext);
  if (!ctx) throw new Error('useRetirementSaveBar must be used within RetirementSaveBarProvider');
  return ctx;
}
