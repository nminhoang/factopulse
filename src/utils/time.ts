import { useEffect, useState } from 'react';

/** Re-renders the component every `intervalMs` and returns the current time. */
export function useNow(intervalMs: number = 60000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

/** 0.25 -> "15 min", 2.5 -> "2 h 30 min", 60 -> "2 d 12 h" */
export function formatHours(hours: number): string {
  if (!isFinite(hours) || hours <= 0) return '0 min';

  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  if (hours < 48) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  const days = Math.floor(hours / 24);
  const h = Math.round(hours - days * 24);
  return h ? `${days} d ${h} h` : `${days} d`;
}

/** Milliseconds -> "1:05:09" for a running timer. */
export function formatElapsed(ms: number): string {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** "Sep 19, 1:28 PM" */
export function formatDateTime(value: unknown): string {
  if (!value) return '-';
  const date = new Date(String(value));
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
