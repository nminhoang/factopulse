import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Share, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Banner, Button, Card, EmptyText, Pill, Screen, SectionTitle } from '../ui/kit';
import { colors } from '../ui/theme';

interface Teammate {
  id: string;
  email: string | null;
  role: string;
}

export default function TeamScreen() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      setLoadError(profileError?.message || 'Could not load your profile');
      setLoading(false);
      return;
    }

    setMyRole(profile.role);

    const [{ data: company, error: companyError }, { data: members, error: membersError }] =
      await Promise.all([
        supabase.from('companies').select('name, join_code').eq('id', profile.company_id).single(),
        supabase
          .from('profiles')
          .select('id, email, role')
          .eq('company_id', profile.company_id)
          .order('role', { ascending: true }),
      ]);

    const problem = companyError || membersError;
    setLoadError(problem ? problem.message : null);

    if (company) {
      setCompanyName(company.name || '');
      setJoinCode(company.join_code || '');
    }
    setTeammates(members || []);
    setLoading(false);
  }

  async function shareCode() {
    try {
      await Share.share({
        message: `Join ${companyName || 'our company'} on FactoPulse. Open the app, tap Create account, then "Join with a code" and enter: ${joinCode}`,
      });
    } catch {
      // sharing was cancelled; nothing to do
    }
  }

  function confirmRegenerate() {
    Alert.alert(
      'Create a new invite code?',
      'The old code will stop working right away. Anyone you already invited will need the new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create new code', style: 'destructive', onPress: regenerate },
      ]
    );
  }

  async function regenerate() {
    setRegenerating(true);
    const { data, error } = await supabase.rpc('regenerate_join_code');
    setRegenerating(false);

    if (error) {
      Alert.alert('Could not create a new code', error.message);
      return;
    }
    if (data) setJoinCode(data as string);
  }

  return (
    <Screen title="Team" subtitle={companyName || undefined} onBack={goBack}>
      {loadError ? (
        <Banner
          tone="bad"
          icon="warning"
          title="Can't load your team"
          text={`${loadError}. Check your internet connection and try again.`}
        />
      ) : null}

      {!loading && !loadError ? (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>
              INVITE CODE
            </Text>
            <Text
              style={{
                fontSize: 40,
                fontWeight: '800',
                color: colors.primary,
                letterSpacing: 4,
                marginVertical: 6,
              }}
            >
              {joinCode}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
              Share this with a technician. In the app they tap Create account, then "Join with a
              code".
            </Text>
            <Button title="Share code" icon="share" variant="accent" onPress={shareCode} />
            {myRole === 'owner' ? (
              <Button
                title="Create new code"
                icon="qr"
                variant="secondary"
                loading={regenerating}
                onPress={confirmRegenerate}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </Card>

          <SectionTitle>People ({teammates.length})</SectionTitle>
          {teammates.length === 0 ? (
            <EmptyText>Just you so far.</EmptyText>
          ) : (
            teammates.map((person) => (
              <Card key={person.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
                    {person.email || 'Unknown'}
                  </Text>
                  <Pill text={person.role === 'owner' ? 'Owner' : 'Technician'} tone={person.role === 'owner' ? 'info' : 'neutral'} />
                </View>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
