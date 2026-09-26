import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Button, Field, Screen, Segmented } from '../../ui/kit';
import { normalizeCriticality } from '../../utils/decisionEngine';

export default function EditEquipment() {
  const router = useRouter();
  const { equipmentId } = useLocalSearchParams();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expectedLifeYears, setExpectedLifeYears] = useState('');
  const [replacementCost, setReplacementCost] = useState('');
  const [salvageValue, setSalvageValue] = useState('');
  const [criticality, setCriticality] = useState('Medium');
  const [estimatedDowntimeCostPerHour, setEstimatedDowntimeCostPerHour] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEquipment();
  }, []);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  async function fetchEquipment() {
    const { data, error } = await supabase
      .from('Equipment')
      .select('*')
      .eq('ID', equipmentId)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Could not load equipment');
      return;
    }

    setName(data.Name || '');
    setLocation(data.Location || '');
    setStatus(data.Status || '');
    setPurchaseCost(String(data.PurchaseCost || ''));
    setPurchaseDate(String(data.PurchaseDate || ''));
    setExpectedLifeYears(String(data.ExpectedLifeYears || ''));
    setReplacementCost(String(data.ReplacementCost || ''));
    setSalvageValue(String(data.SalvageValue || ''));
    setCriticality(normalizeCriticality(data.Criticality));
    setEstimatedDowntimeCostPerHour(String(data.EstimatedDowntimeCostPerHour || ''));
  }

  async function saveEquipment() {
    setSaving(true);

    const { error } = await supabase
      .from('Equipment')
      .update({
        Name: name,
        Location: location,
        Status: status,
        PurchaseCost: Number(purchaseCost) || 0,
        PurchaseDate: purchaseDate,
        ExpectedLifeYears: Number(expectedLifeYears) || 0,
        ReplacementCost: Number(replacementCost) || 0,
        SalvageValue: Number(salvageValue) || 0,
        Criticality: normalizeCriticality(criticality),
        EstimatedDowntimeCostPerHour: Number(estimatedDowntimeCostPerHour) || 0,
      })
      .eq('ID', equipmentId);

    setSaving(false);

    if (error) {
      Alert.alert('Save Failed', error.message);
      return;
    }

    router.back();
  }

  return (
    <Screen title="Edit Equipment" subtitle={name || undefined} onBack={goBack}>
      <Field label="Equipment Name" icon="machines" value={name} onChangeText={setName} />
      <Field label="Location" icon="pin" value={location} onChangeText={setLocation} />
      <Field label="Status" value={status} onChangeText={setStatus} />
      <Field label="Purchase Cost" icon="money" keyboardType="decimal-pad" value={purchaseCost} onChangeText={setPurchaseCost} />
      <Field
        label="Purchase Date"
        icon="calendar"
        placeholder="MM/DD/YYYY"
        value={purchaseDate}
        onChangeText={setPurchaseDate}
      />
      <Field label="Expected Life (years)" keyboardType="decimal-pad" value={expectedLifeYears} onChangeText={setExpectedLifeYears} />
      <Field label="Replacement Cost" icon="money" keyboardType="decimal-pad" value={replacementCost} onChangeText={setReplacementCost} />
      <Field label="Salvage Value" icon="money" keyboardType="decimal-pad" value={salvageValue} onChangeText={setSalvageValue} />
      <Field label="Downtime Cost Per Hour" icon="clock" keyboardType="decimal-pad" value={estimatedDowntimeCostPerHour} onChangeText={setEstimatedDowntimeCostPerHour} />

      <Segmented
        label="Criticality"
        value={criticality}
        onChange={setCriticality}
        options={[
          { value: 'High', tone: 'bad' },
          { value: 'Medium', tone: 'warn' },
          { value: 'Low', tone: 'good' },
        ]}
      />

      <View style={{ marginTop: 8 }}>
        <Button title="Save Changes" icon="check" variant="accent" loading={saving} onPress={saveEquipment} />
        <Button title="Cancel" variant="secondary" onPress={goBack} style={{ marginTop: 10 }} />
      </View>
    </Screen>
  );
}
