import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Button, Field, Screen, Segmented } from '../../ui/kit';
import { normalizeCriticality, parseDate } from '../../utils/decisionEngine';

export default function AddEquipment() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expectedLifeYears, setExpectedLifeYears] = useState('');
  const [replacementCost, setReplacementCost] = useState('');
  const [criticality, setCriticality] = useState('Medium');
  const [saving, setSaving] = useState(false);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  async function saveEquipment() {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter the equipment name.');
      return;
    }

    if (purchaseDate.trim() && !parseDate(purchaseDate)) {
      Alert.alert(
        'Check purchase date',
        'Use MM/DD/YYYY (for example 05/14/2020) or YYYY-MM-DD.'
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('Equipment').insert([
      {
        Name: name.trim(),
        Location: location,
        Status: status,
        PurchaseCost: Number(purchaseCost) || 0,
        PurchaseDate: purchaseDate.trim(),
        ExpectedLifeYears: Number(expectedLifeYears) || 0,
        ReplacementCost: Number(replacementCost) || 0,
        Criticality: normalizeCriticality(criticality),
      },
    ]);

    setSaving(false);

    if (error) {
      Alert.alert('Save Failed', error.message);
      return;
    }

    goBack();
  }

  return (
    <Screen title="Add Equipment" subtitle="Enter what you know. You can edit it later." onBack={goBack}>
      <Field label="Name *" icon="machines" placeholder="e.g. Winding Machine 1" value={name} onChangeText={setName} />
      <Field label="Location" icon="pin" placeholder="e.g. Building A, Line 2" value={location} onChangeText={setLocation} />
      <Field label="Status" placeholder="e.g. Running" value={status} onChangeText={setStatus} />

      <Field
        label="Purchase Cost"
        icon="money"
        placeholder="0"
        keyboardType="decimal-pad"
        value={purchaseCost}
        onChangeText={setPurchaseCost}
      />
      <Field
        label="Purchase Date"
        icon="calendar"
        placeholder="MM/DD/YYYY"
        hint="Example: 05/14/2020"
        value={purchaseDate}
        onChangeText={setPurchaseDate}
      />
      <Field
        label="Expected Life (years)"
        placeholder="e.g. 15"
        keyboardType="decimal-pad"
        value={expectedLifeYears}
        onChangeText={setExpectedLifeYears}
      />
      <Field
        label="Replacement Cost"
        icon="money"
        placeholder="0"
        hint="What a new one would cost today. Used for the repair-vs-replace advice."
        keyboardType="decimal-pad"
        value={replacementCost}
        onChangeText={setReplacementCost}
      />

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
        <Button title="Save Equipment" icon="check" variant="accent" loading={saving} onPress={saveEquipment} />
        <Button title="Cancel" variant="secondary" onPress={goBack} style={{ marginTop: 10 }} />
      </View>
    </Screen>
  );
}
