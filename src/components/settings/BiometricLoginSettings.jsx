import React, { useEffect, useState } from 'react';
import { ScanFace } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  getBiometryInfo,
  hasBiometricLoginEnabled,
  enableBiometricLogin,
  disableBiometricLogin,
} from '@/lib/biometricAuth';

// Only renders on native iOS/Android builds where the device actually
// supports Face ID / Touch ID / fingerprint unlock. Silently renders
// nothing on the web, where there's no equivalent.
export default function BiometricLoginSettings() {
  const { toast } = useToast();
  const [info, setInfo] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await getBiometryInfo();
      setInfo(result);
      if (result.isAvailable) setEnabled(await hasBiometricLoginEnabled());
    })();
  }, []);

  if (!info?.isAvailable) return null;

  const handleToggle = async (checked) => {
    setBusy(true);
    try {
      if (checked) {
        await enableBiometricLogin();
        setEnabled(true);
        toast({ title: `${info.label} login enabled`, duration: 2000 });
      } else {
        await disableBiometricLogin();
        setEnabled(false);
        toast({ title: `${info.label} login disabled`, duration: 2000 });
      }
    } catch (err) {
      toast({ title: `Couldn't ${checked ? 'enable' : 'disable'} ${info.label}`, description: err?.message, variant: 'destructive', duration: 3000 });
    }
    setBusy(false);
  };

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{info.label} Login</p>
            <p className="text-xs text-muted-foreground">Sign in with {info.label} instead of your password</p>
          </div>
        </div>
        <Switch checked={enabled} disabled={busy} onCheckedChange={handleToggle} />
      </div>
    </div>
  );
}
