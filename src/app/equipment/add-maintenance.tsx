import { useState } from 'react';
import {
    Alert,
    Button,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function AddMaintenance() {
  const [description, setDescription] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [contractorCost, setContractorCost] = useState('');
  const [downtimeHours, setDowntimeHours] = useState('');

  async function saveRecord() {
  Alert.alert(
    'Not Yet Connected',
    'Next step is Supabase save'
  );
}

  return (
    <View style={{ flex: 1, padding: 20, marginTop: 60 }}>
      <Text
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          marginBottom: 20,
        }}
      >
        Add Maintenance Record
      </Text>

      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 10,
        }}
      />

      <TextInput
        placeholder="Labor Cost"
        value={laborCost}
        onChangeText={setLaborCost}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 10,
        }}
      />

      <TextInput
        placeholder="Parts Cost"
        value={partsCost}
        onChangeText={setPartsCost}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 10,
        }}
      />

      <TextInput
        placeholder="Contractor Cost"
        value={contractorCost}
        onChangeText={setContractorCost}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 10,
        }}
      />

      <TextInput
        placeholder="Downtime Hours"
        value={downtimeHours}
        onChangeText={setDowntimeHours}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 20,
        }}
      />

      <Button
        title="Save Record"
        onPress={saveRecord}
      />
    </View>
  );
}