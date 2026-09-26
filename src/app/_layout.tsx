import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { colors } from '../ui/theme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments() as string[];

  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Track whether someone is logged in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Route guard: signed-out users can only see the login screen;
  // signed-in users skip the login screen.
  useEffect(() => {
    if (!checked) return;

    const onLoginScreen = segments.length === 0 || segments[0] === 'index';

    if (!signedIn && !onLoginScreen) {
      router.replace('/');
    } else if (signedIn && onLoginScreen) {
      router.replace('/dashboard');
    }
  }, [checked, signedIn, segments, router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      />
    </>
  );
}
