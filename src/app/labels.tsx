import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Banner, Button, Card, EmptyText, Screen } from '../ui/kit';
import { QrCode } from '../ui/QrCode';
import { colors } from '../ui/theme';
import { buildLabelSheetHtml, LabelInfo } from '../utils/labelSheet';
import { machineCode } from '../utils/machineCode';

export default function LabelsScreen() {
  const router = useRouter();
  const { equipmentId } = useLocalSearchParams<{ equipmentId?: string }>();
  const single = typeof equipmentId === 'string' && equipmentId.length > 0;

  const [labels, setLabels] = useState<LabelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState<'print' | 'share' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let query = supabase.from('Equipment').select('ID, Name, Location').order('Name');
      if (single) query = query.eq('ID', equipmentId);
      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
      } else {
        setLoadError(null);
        setLabels(
          (data || []).map((row: any) => ({
            id: row.ID,
            name: row.Name || 'Machine',
            location: row.Location,
          }))
        );
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [single, equipmentId]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  async function printLabels() {
    setWorking('print');
    try {
      await Print.printAsync({ html: buildLabelSheetHtml(labels) });
    } catch (e: any) {
      const text = String(e?.message || e);
      // Closing the print dialog without printing is not an error.
      if (!/did not complete|cancel/i.test(text)) Alert.alert('Could not print', text);
    }
    setWorking(null);
  }

  async function shareLabels() {
    setWorking('share');
    try {
      const { uri } = await Print.printToFileAsync({
        html: buildLabelSheetHtml(labels),
        width: 612,
        height: 792,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Machine QR labels',
        });
      } else {
        Alert.alert('Sharing not available', 'This device cannot share files.');
      }
    } catch (e: any) {
      Alert.alert('Could not make the PDF', String(e?.message || e));
    }
    setWorking(null);
  }

  const first = labels[0];

  return (
    <Screen
      title={single ? 'QR Label' : 'QR Labels'}
      subtitle={
        single
          ? first?.name
          : labels.length === 1
            ? '1 machine'
            : `${labels.length} machines`
      }
      onBack={goBack}
    >
      {loadError ? (
        <Banner
          tone="bad"
          icon="warning"
          title="Can't load your machines"
          text={`${loadError}. Check your internet connection and try again.`}
        />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : labels.length === 0 && !loadError ? (
        <EmptyText>No machines yet. Add equipment first, then come back to print labels.</EmptyText>
      ) : labels.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            <Button
              title={single ? 'Print' : 'Print all'}
              icon="print"
              variant="accent"
              loading={working === 'print'}
              disabled={working !== null}
              style={{ flex: 1, marginRight: 8 }}
              onPress={printLabels}
            />
            <Button
              title="Share PDF"
              icon="share"
              variant="secondary"
              loading={working === 'share'}
              disabled={working !== null}
              style={{ flex: 1 }}
              onPress={shareLabels}
            />
          </View>

          <Banner
            tone="info"
            icon="bulb"
            title="Tip for the shop floor"
            text="Print on adhesive label paper and cover with clear tape or laminate, so oil, dust and cleaning do not wear the code off. Stick it near the control panel where it is easy to scan."
          />

          <View style={{ height: 12 }} />

          {labels.map((label) => (
            <Card key={String(label.id)} style={{ alignItems: 'center' }}>
              <QrCode value={machineCode(label.id)} size={220} />
              <Text
                style={{ fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 12, textAlign: 'center' }}
              >
                {label.name}
              </Text>
              {label.location ? (
                <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'center' }}>{label.location}</Text>
              ) : null}
              <Text style={{ color: colors.faint, fontSize: 12, marginTop: 6 }}>Scan to start or finish work</Text>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
