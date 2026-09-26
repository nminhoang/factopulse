import { Stack, useRouter, useSegments } from 'expo-router';
import { ReactNode, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../ui/theme';
import { SessionProvider, useSession } from '../utils/session';

/**
 * Route guard:
 * - signed out              -> only the login screen
 * - signed in, no company   -> only Set Up Your Company
 * - signed in, in a company -> everything else, never login or setup
 */
function Gate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { checked, signedIn, companyId } = useSession();

  useEffect(() => {
    if (!checked) return;

    const onLoginScreen = segments.length === 0 || segments[0] === 'index';
    const onSetupScreen = segments[0] === 'setup-company';

    if (!signedIn) {
      if (!onLoginScreen) router.replace('/');
      return;
    }

    if (companyId === undefined) return; // still loading, don't bounce anywhere yet

    if (companyId === null) {
      if (!onSetupScreen) router.replace('/setup-company');
      return;
    }

    if (onLoginScreen || onSetupScreen) router.replace('/dashboard');
  }, [checked, signedIn, companyId, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Gate>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        />
      </Gate>
    </SessionProvider>
  );
}
