import { base44 } from '@/api/base44Client';

// Replaces the Base44 vite-plugin's auto-generated `@/functions/*` legacy
// import shim — now a thin wrapper over base44.functions.invoke, which maps
// straight onto a Supabase Edge Function of the same name.
export function calcOpeningBalance(payload = {}) {
  return base44.functions.invoke('calcOpeningBalance', payload);
}
