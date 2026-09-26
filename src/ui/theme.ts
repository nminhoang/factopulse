import type { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

export const colors = {
  bg: '#F1F4F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0B3B66', // deep industrial navy
  headerSub: '#B6C8DC',
  accent: '#F97316', // safety orange
  text: '#0F172A',
  muted: '#64748B',
  faint: '#94A3B8',
} as const;

export const radius = { card: 16, input: 12, pill: 999 } as const;

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

/** fg = text/icon color, bg = soft background, bar = brighter fill for progress bars */
export const toneStyles: Record<Tone, { fg: string; bg: string; bar: string }> = {
  good: { fg: '#15803D', bg: '#DCFCE7', bar: '#22C55E' },
  warn: { fg: '#B45309', bg: '#FEF3C7', bar: '#F59E0B' },
  bad: { fg: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444' },
  info: { fg: '#1D4ED8', bg: '#DBEAFE', bar: '#3B82F6' },
  neutral: { fg: '#475569', bg: '#E2E8F0', bar: '#94A3B8' },
};

/** Fixed color per kind of work, so charts and pills always match. */
export const WORK_TYPE_COLORS: Record<string, string> = {
  Breakdown: '#EF4444',
  Preventive: '#22C55E',
  'Part Replacement': '#F59E0B',
  Cleaning: '#3B82F6',
  Inspection: '#8B5CF6',
  Other: '#94A3B8',
};

export const WORK_TYPE_LABELS: Record<string, string> = {
  Breakdown: 'Breakdown',
  Preventive: 'Preventive (PM)',
  'Part Replacement': 'Part replacement',
  Cleaning: 'Cleaning',
  Inspection: 'Inspection',
  Other: 'Other',
};

/** Fixed color per breakdown cause (fleet-wide "top causes" chart). Distinct hues from
 *  WORK_TYPE_COLORS on purpose - a different chart, so no risk of the two being confused. */
export const CAUSE_COLORS: Record<string, string> = {
  'Wear / age': '#F59E0B',
  Electrical: '#EF4444',
  Mechanical: '#0EA5E9',
  Operator: '#8B5CF6',
  'Material / process': '#14B8A6',
  Unknown: '#94A3B8',
};

export function causeColor(cause: string): string {
  return CAUSE_COLORS[cause] ?? CAUSE_COLORS.Unknown;
}

export function workTypeColor(type: string): string {
  return WORK_TYPE_COLORS[type] ?? WORK_TYPE_COLORS.Other;
}

export function scoreTone(score: number): Tone {
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}

export function statusTone(status: string): Tone {
  if (status === 'Good') return 'good';
  if (status === 'Monitor') return 'warn';
  if (status === 'High Risk') return 'bad';
  return 'neutral';
}

export function recommendationTone(recommendation: string): Tone {
  if (recommendation === 'Replace Immediately') return 'bad';
  if (recommendation === 'Plan Replacement' || recommendation === 'Budget for Replacement') {
    return 'warn';
  }
  if (recommendation === 'Not enough data' || recommendation === 'No asset value entered yet') {
    return 'neutral';
  }
  return 'good';
}

export function criticalityTone(criticality: string | null | undefined): Tone {
  if (criticality === 'High') return 'bad';
  if (criticality === 'Low') return 'good';
  if (criticality === 'Medium') return 'warn';
  return 'neutral';
}

export function money(value: number | string | null | undefined): string {
  const n = Math.round(Number(value) || 0);
  return `$${n.toLocaleString('en-US')}`;
}

type SymbolName = Extract<ComponentProps<typeof SymbolView>['name'], object>;

/** One place to name every icon; iOS uses SF Symbols, Android/web use Material symbols. */
export const ICONS = {
  wrench: { ios: 'wrench.and.screwdriver.fill', android: 'build' },
  machines: { ios: 'gearshape.2.fill', android: 'settings' },
  money: { ios: 'dollarsign.circle.fill', android: 'attach_money' },
  clock: { ios: 'clock.fill', android: 'schedule' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  plus: { ios: 'plus', android: 'add' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  mail: { ios: 'envelope.fill', android: 'mail' },
  lock: { ios: 'lock.fill', android: 'lock' },
  edit: { ios: 'pencil', android: 'edit' },
  trash: { ios: 'trash.fill', android: 'delete' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  trend: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  heart: { ios: 'heart.fill', android: 'favorite' },
  bulb: { ios: 'lightbulb.fill', android: 'lightbulb' },
  scan: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  qr: { ios: 'qrcode', android: 'qr_code_2' },
  print: { ios: 'printer.fill', android: 'print' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  flash: { ios: 'bolt.fill', android: 'flashlight_on' },
  team: { ios: 'person.2.fill', android: 'group' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;
