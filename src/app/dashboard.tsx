import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Dashboard() {
  const [equipment, setEquipment] = useState<any[]>([]);

  useEffect(() => {
    fetchEquipment();
  }, []);

  async function fetchEquipment() {
    const { data, error } = await supabase.from('Equipment').select('*');

    console.log('Equipment data:', data);
    console.log('Equipment error:', error);

    if (!error) setEquipment(data || []);
  }

  return (
    <View style={{ flex: 1, padding: 20, marginTop: 60 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Equipment Dashboard
      </Text>

      <FlatList
        data={equipment}
        keyExtractor={(item) => item.ID.toString()}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              console.log('Tapped equipment:', item.ID);
              router.push({
                pathname: '/equipment/[id]',
                params: { id: item.ID.toString() },
              });
            }}
            style={{
              padding: 16,
              borderWidth: 1,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
              {item.Name}
            </Text>
            <Text>Location: {item.Location}</Text>
            <Text>Status: {item.Status}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}