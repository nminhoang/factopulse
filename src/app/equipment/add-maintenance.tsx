import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Banner, Button, ChipGroup, Field, Screen, Segmented } from '../../ui/kit';
import { money, WORK_TYPE_LABELS, workTypeColor } from '../../ui/theme';
import { defaultPlanned, WORK_TYPES } from '../../utils/decisionEngine';
import { friendlyDbError } from '../../utils/errors';

/** For jobs that already happened (or were done without the timer). */
export default function AddMaintenance() {
  const router = useRouter();
  const { equipmentId } = useLocalSearchParams();

  const [type, setType] = useState<string>('Breakdown');
  const [planned, setPlanned] = useState(false);
  const [description, setDescription] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [contractorCost, setContractorCost] = useState('');
  const [downtimeHours, setDowntimeHours] = useState('');
  const [saving, setSaving] = useState(false);

  const totalCost =
    (Number(laborCost) || 0) + (Number(partsCost) || 0) + (Number(contractorCost) || 0);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  function chooseType(next: string) {
    setType(next);
    setPlanned(defaultPlanned(next));
  }

  async function saveRecord() {
    const labor = Number(laborCost) || 0;
    const parts = Number(partsCost) || 0;
    const contractor = Number(contractorCost) || 0;
    const downtime = Number(downtimeHours) || 0;

    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email ?? null;

    const { error } = await supabase
      .from('MaintenanceHistory')
      .insert([
        {
          equipment_id: equipmentId,
          description: description,
          labor_cost: labor,
          parts_cost: parts,
          contractor_cost: contractor,
          downtime_hours: downtime,
          work_type: type,
          planned,
          status: 'Completed',
          technician_email: email,
        },
      ]);

    setSaving(false);

    if (error) {
      console.log('SAVE ERROR:', error);
      Alert.alert('Save Failed', friendlyDbError(error.message));
      return;
    }

    router.back();
  }

  return (
    <Screen title="Log Past Job" subtitle="For work that is already done" onBack={goBack}>
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

      <Field
        label="What was done?"
        icon="wrench"
        placeholder="Describe the repair or service..."
        multiline
        value={description}
        onChangeText={setDescription}
      />
      <Field label="Downtime Hours" icon="clock" placeholder="0" keyboardType="decimal-pad" value={downtimeHours} onChangeText={setDowntimeHours} />
      <Field label="Labor Cost" icon="money" placeholder="0" keyboardType="decimal-pad" value={laborCost} onChangeText={setLaborCost} />
      <Field label="Parts Cost" icon="money" placeholder="0" keyboardType="decimal-pad" value={partsCost} onChangeText={setPartsCost} />
      <Field label="Contractor Cost" icon="money" placeholder="0" keyboardType="decimal-pad" value={contractorCost} onChangeText={setContractorCost} />

      <Banner tone="info" icon="money" title={`Total cost: ${money(totalCost)}`} />

      <View style={{ marginTop: 16 }}>
        <Button title="Save Record" icon="check" variant="accent" loading={saving} onPress={saveRecord} />
        <Button title="Cancel" variant="secondary" onPress={goBack} style={{ marginTop: 10 }} />
      </View>
    </Screen>
  );
}
