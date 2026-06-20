import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function EquipmentDetail() {
  const { id } = useLocalSearchParams();

  const [equipment, setEquipment] = useState<any>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [totalDowntime, setTotalDowntime] = useState(0);

  useEffect(() => {
    fetchEquipment();
    fetchMaintenanceHistory();
  }, [id]);

  async function fetchEquipment() {
    const { data, error } = await supabase
      .from('Equipment')
      .select('*')
      .eq('ID', id)
      .single();

    console.log('Selected equipment:', data);
    console.log('Selected equipment error:', error);

    if (!error) setEquipment(data);
  }

  async function fetchMaintenanceHistory() {
    const { data, error } = await supabase
      .from('MaintenanceHistory')
      .select('*')
      .eq('equipment_id', id);

    console.log('Maintenance history:', data);
    console.log('Maintenance history error:', error);

    if (error) return;

    const cost = data.reduce((sum, item) => {
      return (
        sum +
        Number(item.labor_cost || 0) +
        Number(item.parts_cost || 0) +
        Number(item.contractor_cost || 0)
      );
    }, 0);

    const downtime = data.reduce((sum, item) => {
      return sum + Number(item.downtime_hours || 0);
    }, 0);

    setTotalCost(cost);
    setTotalDowntime(downtime);
  }

  if (!equipment) {
    return (
      <View style={{ flex: 1, padding: 20, marginTop: 60 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, marginTop: 60 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold' }}>
        {equipment.Name}
      </Text>
<Button
  title="Add Maintenance Record"
  onPress={() => router.push('/equipment/add-maintenance')}
/>
      <Text style={{ marginTop: 20 }}>
        Location: {equipment.Location}
      </Text>
      <Text>Status: {equipment.Status}</Text>

      <Text style={{ marginTop: 30, fontSize: 22, fontWeight: 'bold' }}>
        Cost Summary
      </Text>

      <Text>Total Repair Cost: ${totalCost}</Text>
      <Text>Total Downtime: {totalDowntime} hours</Text>
    </View>
  );
}