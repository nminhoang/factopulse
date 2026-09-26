import { SymbolView } from 'expo-symbols';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ICONS, IconName, radius, Tone, toneStyles } from './theme';

/* ------------------------------------------------------------------ Icon */

export function Icon({
  name,
  size = 20,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const symbol = ICONS[name];
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size}
      tintColor={color}
      fallback={<View style={{ width: size, height: size }} />}
    />
  );
}

/* ---------------------------------------------------------------- Screen */

export function Screen({
  title,
  subtitle,
  onBack,
  right,
  refreshing = false,
  onRefresh,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          backgroundColor: colors.primary,
          paddingTop: insets.top + 12,
          paddingBottom: 22,
          paddingHorizontal: 16,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack ? (
            <IconButton icon="back" label="Back" onPress={onBack} style={{ marginRight: 12 }} />
          ) : null}

          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800' }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={{ color: colors.headerSub, fontSize: 14, marginTop: 2 }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {right}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 56 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Round translucent icon button that sits on the navy header. */
export function IconButton({
  icon,
  label,
  onPress,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)',
        },
        style,
      ]}
    >
      <Icon name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[base, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{children}</Text>
      {right}
    </View>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: colors.muted, marginBottom: 12, fontSize: 15 }}>{children}</Text>
  );
}

/* ------------------------------------------------------------- StatCard */

export function StatCard({
  icon,
  label,
  value,
  tone = 'info',
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: Tone;
}) {
  const t = toneStyles[tone];
  return (
    <View
      style={{
        width: '48.5%',
        backgroundColor: colors.card,
        borderRadius: radius.card,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <Icon name={icon} size={18} color={t.fg} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
}

/* --------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  accent: { bg: colors.accent, fg: '#FFFFFF', border: colors.accent },
  secondary: { bg: '#FFFFFF', fg: colors.primary, border: colors.border },
  danger: { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA' },
};

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = BUTTON_STYLES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: 48,
          borderRadius: radius.input,
          backgroundColor: v.bg,
          borderWidth: 1,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          opacity: pressed || disabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={v.fg} /> : null}
          <Text
            style={{
              color: v.fg,
              fontSize: 16,
              fontWeight: '700',
              marginLeft: icon ? 8 : 0,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Field */

export function Field({
  label,
  icon,
  hint,
  containerStyle,
  ...inputProps
}: Omit<TextInputProps, 'style'> & {
  label: string;
  icon?: IconName;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ marginBottom: 14 }, containerStyle]}>
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 }}
      >
        {label}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: inputProps.multiline ? 'flex-start' : 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: radius.input,
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : colors.border,
          paddingHorizontal: 12,
          minHeight: 48,
        }}
      >
        {icon ? (
          <View style={{ paddingTop: inputProps.multiline ? 14 : 0 }}>
            <Icon name={icon} size={18} color={focused ? colors.primary : colors.faint} />
          </View>
        ) : null}

        <TextInput
          {...inputProps}
          placeholderTextColor={colors.faint}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={{
            flex: 1,
            fontSize: 16,
            color: colors.text,
            paddingVertical: 12,
            marginLeft: icon ? 10 : 0,
            minHeight: inputProps.multiline ? 88 : undefined,
            textAlignVertical: inputProps.multiline ? 'top' : 'center',
          }}
        />
      </View>

      {hint ? (
        <Text style={{ fontSize: 12, color: colors.faint, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ Segmented */

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; tone: Tone }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        {options.map((option, index) => {
          const selected = value === option.value;
          const t = toneStyles[option.tone];
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.input,
                borderWidth: 1.5,
                borderColor: selected ? t.fg : colors.border,
                backgroundColor: selected ? t.bg : '#FFFFFF',
                marginRight: index === options.length - 1 ? 0 : 8,
              }}
            >
              <Text
                style={{
                  fontWeight: selected ? '800' : '600',
                  color: selected ? t.fg : colors.muted,
                }}
              >
                {option.value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------- Pill */

export function Pill({
  text,
  tone = 'neutral',
  icon,
}: {
  text: string;
  tone?: Tone;
  icon?: IconName;
}) {
  const t = toneStyles[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: t.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      {icon ? <Icon name={icon} size={12} color={t.fg} /> : null}
      <Text
        style={{
          color: t.fg,
          fontSize: 12,
          fontWeight: '800',
          marginLeft: icon ? 4 : 0,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------- ProgressBar */

export function ProgressBar({ value, tone }: { value: number; tone: Tone }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 4,
          backgroundColor: toneStyles[tone].bar,
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------- KeyValue */

export function KeyValue({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 15 }}>{label}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 15,
          fontWeight: bold ? '800' : '600',
          marginLeft: 12,
          flexShrink: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/* --------------------------------------------------------------- Banner */

export function Banner({
  tone,
  icon,
  title,
  text,
}: {
  tone: Tone;
  icon: IconName;
  title: string;
  text?: string;
}) {
  const t = toneStyles[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: t.bg,
        borderRadius: radius.input,
        padding: 12,
        marginTop: 10,
      }}
    >
      <View style={{ marginTop: 2 }}>
        <Icon name={icon} size={18} color={t.fg} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: t.fg, fontWeight: '800', fontSize: 15 }}>{title}</Text>
        {text ? (
          <Text style={{ color: t.fg, fontSize: 13, marginTop: 2 }}>{text}</Text>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- ChipGroup */

/** Pick one option from a wrapped set of chips (work type, cause, "stopped how long ago"...). */
export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: string; label?: string; color?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text
          style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 8 }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {options.map((option) => {
          const selected = option.value === value;
          const accent = option.color ?? colors.primary;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => onChange(option.value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                height: 40,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: selected ? accent : colors.border,
                backgroundColor: selected ? '#FFFFFF' : '#FFFFFF',
                marginRight: 8,
                marginBottom: 8,
              }}
            >
              {option.color ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: option.color,
                    marginRight: 8,
                  }}
                />
              ) : null}
              <Text
                style={{
                  fontWeight: selected ? '800' : '600',
                  color: selected ? colors.text : colors.muted,
                }}
              >
                {option.label ?? option.value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------- Legend */

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 6 }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: item.color,
              marginRight: 6,
            }}
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------- StackedBarChart */

function shortNumber(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

/** Vertical stacked bars, e.g. downtime hours per month split by reason. */
export function StackedBarChart({
  bars,
  height = 140,
}: {
  bars: { label: string; segments: { color: string; value: number }[] }[];
  height?: number;
}) {
  const totals = bars.map((bar) => bar.segments.reduce((sum, seg) => sum + seg.value, 0));
  const max = Math.max(1, ...totals);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: height + 40,
      }}
    >
      {bars.map((bar, index) => {
        const total = totals[index];
        return (
          <View key={`${bar.label}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 3, height: 14 }}>
              {total > 0 ? `${shortNumber(total)} h` : ''}
            </Text>
            <View
              style={{
                width: '58%',
                height: total > 0 ? Math.max((total / max) * height, 4) : 2,
                borderRadius: 6,
                overflow: 'hidden',
                backgroundColor: total > 0 ? 'transparent' : '#E2E8F0',
              }}
            >
              {bar.segments.map((seg, i) =>
                seg.value > 0 ? (
                  <View key={i} style={{ flex: seg.value, backgroundColor: seg.color }} />
                ) : null
              )}
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{bar.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- HBarList */

/** Horizontal bars, one row per category (e.g. downtime hours by reason). */
export function HBarList({
  rows,
}: {
  rows: { label: string; value: number; color: string; display: string }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <View>
      {rows.map((row) => (
        <View
          key={row.label}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ width: 112, color: colors.text, fontSize: 14 }} numberOfLines={1}>
            {row.label}
          </Text>
          <View
            style={{
              flex: 1,
              height: 12,
              borderRadius: 6,
              backgroundColor: '#E2E8F0',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 3 : 0)}%`,
                height: '100%',
                borderRadius: 6,
                backgroundColor: row.color,
              }}
            />
          </View>
          <Text
            style={{
              width: 74,
              textAlign: 'right',
              color: colors.text,
              fontWeight: '700',
              fontSize: 13,
            }}
          >
            {row.display}
          </Text>
        </View>
      ))}
    </View>
  );
}
