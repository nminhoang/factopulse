import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useSession } from '../utils/session';
import { Banner, Button, Card, ChipGroup, Field, IconButton, Screen } from '../ui/kit';
import { colors } from '../ui/theme';

/**
 * Shown once, right after an account signs in with no company yet
 * (a brand-new sign-up, or an older account from before companies
 * existed). Every machine and job belongs to a company, so nothing
 * else in the app works until this is done.
 */
export default function SetupCompany() {
  const { refreshProfile } = useSession();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [companyName, setCompanyName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  async function createCompany() {
    if (!companyName.trim()) {
      setError('Enter a company name.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('create_company', {
      company_name: companyName.trim(),
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    await refreshProfile();
    router.replace('/dashboard');
  }

  async function joinCompany() {
    if (!code.trim()) {
      setError('Enter the invite code your teammate gave you.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('join_company_by_code', {
      code: code.trim(),
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    await refreshProfile();
    router.replace('/dashboard');
  }

  return (
    <Screen
      title="Set Up Your Company"
      subtitle="One more step before you get in"
      right={<IconButton icon="logout" label="Log out" onPress={logOut} />}
    >
      <ChipGroup
        value={mode}
        onChange={(v) => {
          setMode(v as 'create' | 'join');
          setError(null);
        }}
        options={[
          { value: 'create', label: 'Create a new company' },
          { value: 'join', label: 'Join with a code' },
        ]}
      />

      {error ? <Banner tone="bad" icon="warning" title="Could not continue" text={error} /> : null}

      {mode === 'create' ? (
        <Card>
          <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 4 }}>
            You'll be the owner, and can invite technicians once you're in.
          </Text>
          <Field
            label="Company name"
            icon="machines"
            placeholder="e.g. Janco Engineered Products"
            value={companyName}
            onChangeText={setCompanyName}
          />
          <Button
            title="Create company"
            icon="check"
            variant="accent"
            loading={saving}
            onPress={createCompany}
            style={{ marginTop: 4 }}
          />
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 4 }}>
            Ask the person who set up your company for the 6-character invite code, found on
            their Team screen.
          </Text>
          <Field
            label="Invite code"
            icon="team"
            placeholder="e.g. 7K2QXM"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Button
            title="Join company"
            icon="check"
            variant="accent"
            loading={saving}
            onPress={joinCompany}
            style={{ marginTop: 4 }}
          />
        </Card>
      )}

      <View style={{ marginTop: 8 }}>
        <Button title="Log out" variant="secondary" onPress={logOut} />
      </View>
    </Screen>
  );
}
