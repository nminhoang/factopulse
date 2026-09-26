import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Banner, Button, Card, Screen } from '../ui/kit';
import { colors, Tone } from '../ui/theme';
import { parseMachineCode } from '../utils/machineCode';

interface Message {
  tone: Tone;
  title: string;
  text?: string;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // The camera fires many times per second while a code is in view.
  // These refs make sure each code is handled once.
  const busy = useRef(false);
  const lastIgnored = useRef<{ data: string; at: number } | null>(null);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  }

  async function handleScan(result: { data: string }) {
    if (busy.current) return;

    const id = parseMachineCode(result.data);

    if (!id) {
      const now = Date.now();
      const last = lastIgnored.current;
      if (last && last.data === result.data && now - last.at < 4000) return;
      lastIgnored.current = { data: result.data, at: now };
      setMessage({
        tone: 'warn',
        title: "That's not a machine label",
        text: 'Scan a QR label made in this app (Dashboard, then QR Labels).',
      });
      return;
    }

    busy.current = true;
    setChecking(true);
    setMessage(null);

    const { data: machine, error } = await supabase
      .from('Equipment')
      .select('ID, Name')
      .eq('ID', id)
      .maybeSingle();

    setChecking(false);

    if (error) {
      setMessage({
        tone: 'bad',
        title: "Couldn't look up that machine",
        text: `${error.message}. Check your internet connection and scan again.`,
      });
      setTimeout(() => {
        busy.current = false;
      }, 2500);
      return;
    }

    if (!machine) {
      setMessage({
        tone: 'warn',
        title: 'Machine not found',
        text: 'This label points to a machine that was deleted or is not in your account.',
      });
      setTimeout(() => {
        busy.current = false;
      }, 2500);
      return;
    }

    // replace, so Back from the machine page returns to the dashboard
    router.replace({ pathname: '/equipment/[id]', params: { id: String(machine.ID) } });
  }

  const granted = permission?.granted === true;

  return (
    <Screen title="Scan Machine" subtitle="Point at the QR label on the machine" onBack={goBack}>
      {!permission ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : !granted ? (
        <Card>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
            Camera access needed
          </Text>
          <Text style={{ color: colors.muted, marginTop: 6, marginBottom: 12 }}>
            The camera is only used to read machine QR labels. Nothing is recorded or saved.
          </Text>
          <Button
            title={permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
            icon="scan"
            variant="accent"
            onPress={() => {
              if (permission.canAskAgain) requestPermission();
              else Linking.openSettings();
            }}
          />
        </Card>
      ) : (
        <>
          <View
            style={{
              height: 420,
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: '#000000',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CameraView
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />
            <View
              pointerEvents="none"
              style={{
                width: 230,
                height: 230,
                borderWidth: 3,
                borderColor: colors.accent,
                borderRadius: 24,
              }}
            />
            {checking ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', marginLeft: 8, fontWeight: '700' }}>
                  Finding machine...
                </Text>
              </View>
            ) : null}
          </View>

          {message ? <Banner tone={message.tone} icon="warning" title={message.title} text={message.text} /> : null}

          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Button
              title={torch ? 'Light off' : 'Light on'}
              icon="flash"
              variant="secondary"
              style={{ flex: 1, marginRight: 8 }}
              onPress={() => setTorch((on) => !on)}
            />
            <Button
              title="Pick from list"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={goBack}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
