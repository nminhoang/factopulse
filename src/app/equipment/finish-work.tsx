import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Button, Card, ChipGroup, Field, KeyValue, Pill, Screen } from '../../ui/kit';
import { colors, money, WORK_TYPE_LABELS, workTypeColor } from '../../ui/theme';
import { CAUSES, isPlanned, normalizeWorkType, recordDowntimeHours } from '../../utils/decisionEngine';
import { friendlyDbError } from '../../utils/errors';
import { formatDateTime, formatElapsed, formatHours, useNow } from '../../utils/time';


export default function FinishWork() {
  const router = useRouter();
  const { recordId } = useLocalSearchParams();
  const now = useNow(1000);

  const [record, setRecord] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [cause, setCause] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [contractorCost, setContractorCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRecord();
  }, []);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  async function loadRecord() {
    const { data, error } = await supabase
      .from('MaintenanceHistory')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Could not load this job.');
      return;
    }

    setRecord(data);
    setDescription(data.description || '');
    setCause(data.cause || '');
    setLaborCost(data.labor_cost ? String(data.labor_cost) : '');
    setPartsCost(data.parts_cost ? String(data.parts_cost) : '');
    setContractorCost(data.contractor_cost ? String(data.contractor_cost) : '');
  }

  async function finishWork() {
    if (!record) return;
    setSaving(true);

    const completedAt = new Date();
    const downtime = recordDowntimeHours(
      { ...record, completed_at: completedAt.toISOString(), status: 'Completed' },
      completedAt
    );

    const { error } = await supabase
      .from('MaintenanceHistory')
      .update({
        status: 'Completed',
        completed_at: completedAt.toISOString(),
        description: description.trim(),
        cause: cause || null,
        labor_cost: Number(laborCost) || 0,
        parts_cost: Number(partsCost) || 0,
        contractor_cost: Number(contractorCost) || 0,
        downtime_hours: Number(downtime.toFixed(2)),
      })
      .eq('id', recordId);

    setSaving(false);

    if (error) {
      console.log('FINISH WORK ERROR:', error);
      Alert.alert('Could not finish', friendlyDbError(error.message));
      return;
    }

    goBack();
  }

  function confirmDiscard() {
    Alert.alert(
      'Discard this job?',
      'Use this only if the job was started by mistake. It will be deleted.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discard },
      ]
    );
  }

  async function discard() {
    const { error } = await supabase.from('MaintenanceHistory').delete().eq('id', recordId);
    if (error) {
      Alert.alert('Could not discard', error.message);
      return;
    }
    goBack();
  }

  const type = normalizeWorkType(record?.work_type);
  const planned = record ? isPlanned(record) : false;
  const started = record?.started_at ? new Date(record.started_at) : null;
  const elapsedMs = started ? now.getTime() - started.getTime() : 0;
  const downtimeSoFar = record ? recordDowntimeHours(record, now) : 0;
  const total = (Number(laborCost) || 0) + (Number(partsCost) || 0) + (Number(contractorCost) || 0);

  return (
    <Screen title="Finish Work" subtitle="Record what was done and what it cost" onBack={goBack}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pill text={WORK_TYPE_LABELS[type]} tone="neutral" />
          <Pill text={planned ? 'Planned' : 'Unplanned'} tone={planned ? 'good' : 'bad'} />
        </View>

        <Text
          style={{
            fontSize: 40,
            fontWeight: '800',
            color: workTypeColor(type),
            marginTop: 12,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatElapsed(elapsedMs)}
        </Text>
        <Text style={{ color: colors.muted }}>time since work started</Text>

        <View style={{ marginTop: 12 }}>
          <KeyValue label="Started" value={formatDateTime(record?.started_at)} />
          {!planned && record?.reported_at ? (
            <KeyValue label="Machine stopped" value={formatDateTime(record.reported_at)} />
          ) : null}
          <KeyValue label="Downtime so far" value={formatHours(downtimeSoFar)} bold />
          {record?.technician_email ? (
            <KeyValue label="Technician" value={record.technician_email} />
          ) : null}
        </View>
      </Card>

      <Field
        label="What was done?"
        icon="wrench"
        placeholder="Describe the work..."
        multiline
        value={description}
        onChangeText={setDescription}
      />

      {!planned ? (
        <ChipGroup label="Cause" value={cause} onChange={setCause} options={CAUSES.map((c) => ({ value: c }))} />
      ) : null}

      <Field label="Labor Cost" icon="money" placeholder="0" keyboardType="decimal-pad" value={laborCost} onChangeText={setLaborCost} />
      <Field label="Parts Cost" icon="money" placeholder="0" keyboardType="decimal-pad" value={partsCost} onChangeText={setPartsCost} />
      <Field label="Contractor Cost" icon="money" placeholder="0" keyboardType="decimal-pad" value={contractorCost} onChangeText={setContractorCost} />

      <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 12 }}>
        Total cost: {money(total)}
      </Text>

      <Button title="Finish work" icon="check" variant="accent" loading={saving} onPress={finishWork} />
      <Button title="Discard (started by mistake)" icon="trash" variant="danger" onPress={confirmDiscard} style={{ marginTop: 10 }} />
      <Button title="Back" variant="secondary" onPress={goBack} style={{ marginTop: 10 }} />
    </Screen>
  );
}
