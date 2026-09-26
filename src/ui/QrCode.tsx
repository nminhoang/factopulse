import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { colors } from './theme';
import { encodeQr } from '../utils/qr';

const QUIET = 2; // white margin around the code, in modules

/**
 * Draws a QR code with plain Views (no graphics library needed).
 * Each row is drawn as a few wide blocks instead of one View per module, so it stays fast.
 */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const matrix = useMemo(() => {
    try {
      return encodeQr(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return <Text style={{ color: colors.muted }}>Could not make a QR code for this machine.</Text>;
  }

  const n = matrix.length;
  const cell = Math.max(1, Math.floor(size / (n + QUIET * 2)));
  const outer = cell * (n + QUIET * 2);

  return (
    <View
      accessibilityLabel="QR code"
      style={{ width: outer, height: outer, backgroundColor: '#FFFFFF', padding: QUIET * cell }}
    >
      {matrix.map((row, y) => {
        const runs: { dark: boolean; len: number }[] = [];
        for (const dark of row) {
          const last = runs[runs.length - 1];
          if (last && last.dark === dark) last.len += 1;
          else runs.push({ dark, len: 1 });
        }
        return (
          <View key={y} style={{ flexDirection: 'row', height: cell }}>
            {runs.map((run, i) => (
              <View
                key={i}
                style={{
                  width: run.len * cell,
                  height: cell,
                  backgroundColor: run.dark ? '#000000' : '#FFFFFF',
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
