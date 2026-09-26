import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Banner, Button, ChipGroup, Field, Screen, Segmented } from '../../ui/kit';
import { colors, WORK_TYPE_LABELS, workTypeColor } from '../../ui/theme';
import { defaultPlanned, isInProgress, WORK_TYPES } from '../../utils/decisionEngine';
import { friendlyDbError } from '../../utils/errors';

const STOPPED_OPTIONS = [
  { value: '0', label: 'Just now' },
  { value: '15', label: '15 min ago' },
  { value: '30', label: '30 min ago' },
  { value: '60', label: '1 hour ago' },
  { value: '120', label: '2 hours ago' },
  { value: '240', label: '4 hours ago' },
];

export default function StartWork() {
  const router = useRouter();
  const { equipmentId } = useLocalSearchParams();

  const [type, setType] = useState<string>('Breakdown');
  const [planned, setPlanned] = useState(false);
  const [stoppedMinutesAgo, setStoppedMinutesAgo] = useState('0');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  function chooseType(next: string) {
    setType(next);
    setPlanned(defaultPlanned(next));
  }

  async function startWork() {
    setSaving(true);

    // Only one open job per machine, so timers and downtime stay honest.
    const { data: open, error: openError } = await supabase
      .from('MaintenanceHistory')
      .select('*')
      .eq('equipment_id', equipmentId);

    if (openError) {
      setSaving(false);
      Alert.alert('Could not start', friendlyDbError(openError.message));
      return;
    }

    if ((open || []).some(isInProgress)) {
      setSaving(false);
      Alert.alert(
        'Work already in progress',
        'Finish the current job on this machine before starting another one.'
      );
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email ?? null;

    const now = new Date();
    const reportedAt = planned
      ? null
      : new Date(now.getTime() - Number(stoppedMinutesAgo) * 60 * 1000);

    const { error } = await supabase.from('MaintenanceHistory').insert([
      {
        equipment_id: equipmentId,
        description: description.trim(),
        work_type: type,
        planned,
        status: 'In Progress',
        reported_at: reportedAt ? reportedAt.toISOString() : null,
        started_at: now.toISOString(),
        technician_email: email,
        labor_cost: 0,
        parts_cost: 0,
        contractor_cost: 0,
        downtime_hours: 0,
      },
    ]);

    setSaving(false);

    if (error) {
      console.log('START WORK ERROR:', error);
      Alert.alert('Could not start', friendlyDbError(error.message));
      return;
    }

    goBack();
  }

  return (
    <Screen title="Start Work" subtitle="The timer starts when you tap the button" onBack={goBack}>
      <ChipGroup
        label="What kind of work?"
        value={type}
        onChange={chooseType}
        options={WORK_TYPES.map((t) => ({
          value: t,
          label: WORK_TYPE_LABELS[t],
          color: workTypeColor(t),
        }))}
      />

      <Segmented
        label="Was this planned?"
        value={planned ? 'Planned' : 'Unplanned'}
        onChange={(v) => setPlanned(v === 'Planned')}
        options={[
          { value: 'Unplanned', tone: 'bad' },
          { value: 'Planned', tone: 'good' },
        ]}
      />

      {!planned ? (
        <ChipGroup
          label="When did the machine stop?"
          value={stoppedMinutesAgo}
          onChange={setStoppedMinutesAgo}
          options={STOPPED_OPTIONS}
        />
      ) : null}

      <Field
        label="What is the issue or task?"
        icon="wrench"
        placeholder={planned ? 'e.g. Monthly lubrication and belt check' : 'e.g. Mandrel drive stopped turning'}
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <Banner
        tone="info"
        icon="clock"
        title={
          planned
            ? 'Downtime is counted from the moment you start.'
            : 'Downtime is counted from when the machine stopped until you finish.'
        }
      />

      <View style={{ marginTop: 16 }}>
        <Button title="Start work" icon="wrench" variant="accent" loading={saving} onPress={startWork} />
        <Button title="Cancel" variant="secondary" onPress={goBack} style={{ marginTop: 10 }} />
      </View>

      <Text style={{ color: colors.faint, fontSize: 12, marginTop: 14, textAlign: 'center' }}>
        Your login email is saved as the technician on this job.
      </Text>
    </Screen>
  );
}
