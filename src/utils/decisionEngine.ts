/* =====================================================================
 * Decision engine v2
 *
 * Rules of thumb used here (all deterministic, all explained to the user):
 *  - Only BREAKDOWN (unplanned) work counts against a machine's health and
 *    replace-vs-repair score. Planned work (PM, cleaning, inspection...) is
 *    a normal cost of ownership, not a sign of decline.
 *  - Repair ratio   = breakdown repair cost, last 24 months, as a % of what a
 *                     new machine costs.
 *  - Yearly cost    = breakdown repair cost + downtime cost, last 12 months,
 *    ratio            compared with the yearly cost of a new machine
 *                     ((replacement cost - salvage value) / expected life).
 * ===================================================================== */

export const WORK_TYPES = [
  'Breakdown',
  'Preventive',
  'Part Replacement',
  'Cleaning',
  'Inspection',
  'Other',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export interface AssetMetrics {
  currentAge: number;
  remainingLife: number;
  currentValue: number;
  /** Breakdown repair cost over the last 24 months, as % of a new machine. */
  repairRatio: number;
  /** Last-12-month breakdown repair + downtime cost, as % of a new machine's yearly cost. */
  annualCostRatio: number;
  annualizedReplacementCost: number;
  downtimeCost12m: number;
  recommendation: string;
  reasons: string[];
}

export interface FailurePrediction {
  averageDaysBetweenRepairs: number;
  predictedNextFailureDate: string;
  confidence: string;
  recommendedAction: string;
  isOverdue: boolean;
  breakdownCount: number;
}

export interface HealthResult {
  healthIndex: number;
  status: 'Good' | 'Monitor' | 'High Risk';
  costScore: number;
  downtimeScore: number;
  repairFrequencyScore: number;
  ageScore: number;
}

export interface AssetStats {
  /** Breakdown repair cost, last 24 months. */
  repairCost24m: number;
  /** Breakdown repair cost, last 12 months. */
  repairCost12m: number;
  /** Breakdown downtime hours, last 12 months. */
  downtimeHours12m: number;
  correctiveCount12m: number;
  plannedCount12m: number;
  /** All maintenance cost (any type), last 12 months. */
  totalCost12m: number;
  /** All downtime hours (any type), last 12 months. */
  totalDowntimeHours12m: number;
}

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_YEAR = MS_PER_DAY * 365.25;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ------------------------------------------------------------ small helpers */

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}

function fmtMoney(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function buildDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  return valid ? date : null;
}

/**
 * Parses the date formats users actually type:
 *   2020-05-14   (ISO)
 *   05/14/2020   (US, also 5/14/20, 5-14-2020, 5.14.2020)
 * Falls back to the JS Date parser, and returns null if nothing works.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const us = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (us) {
    let year = Number(us[3]);
    if (year < 100) year += 2000;
    return buildDate(year, Number(us[1]), Number(us[2]));
  }

  const fallback = new Date(text);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** Turns "high", "HIGH ", "med" etc. into exactly 'High' | 'Medium' | 'Low' (default 'Medium'). */
export function normalizeCriticality(value: string | null | undefined): string {
  const text = String(value || '').trim().toLowerCase();
  if (text.startsWith('h')) return 'High';
  if (text.startsWith('l')) return 'Low';
  return 'Medium';
}

/** Labor + parts + contractor cost of one MaintenanceHistory row. */
export function repairItemCost(item: any): number {
  return (
    Number(item?.labor_cost || 0) +
    Number(item?.parts_cost || 0) +
    Number(item?.contractor_cost || 0)
  );
}

/* ---------------------------------------------------------------- work types */

/** Unknown or missing types are treated as Breakdown (what every old record was). */
export function normalizeWorkType(value: string | null | undefined): WorkType {
  const text = String(value || '').trim().toLowerCase();
  const exact = WORK_TYPES.find((type) => type.toLowerCase() === text);
  if (exact) return exact;
  if (text.startsWith('pm') || text.startsWith('prevent')) return 'Preventive';
  if (text.startsWith('part')) return 'Part Replacement';
  if (text.startsWith('clean')) return 'Cleaning';
  if (text.startsWith('inspect')) return 'Inspection';
  return 'Breakdown';
}

/** Everything except a breakdown is planned by default. */
export function defaultPlanned(type: string | null | undefined): boolean {
  return normalizeWorkType(type) !== 'Breakdown';
}

export function isPlanned(item: any): boolean {
  if (typeof item?.planned === 'boolean') return item.planned;
  return defaultPlanned(item?.work_type);
}

export function isInProgress(item: any): boolean {
  return item?.status === 'In Progress' && !item?.completed_at;
}

/** When the job happened: start time if we have one, otherwise when it was logged. */
export function eventDate(item: any): Date | null {
  return toDate(item?.started_at) ?? toDate(item?.created_at);
}

/**
 * Downtime for one record, in hours.
 *  - breakdown: from "machine stopped" (reported_at) to completed
 *  - planned:   from work start to completed
 *  - still in progress: counted up to now
 *  - old/manual records without timestamps: the hours the user typed
 */
export function recordDowntimeHours(item: any, now: Date = new Date()): number {
  const start = toDate(item?.reported_at) ?? toDate(item?.started_at);
  const end = toDate(item?.completed_at) ?? (isInProgress(item) ? now : null);
  if (start && end) return Math.max((end.getTime() - start.getTime()) / MS_PER_HOUR, 0);
  return Number(item?.downtime_hours || 0);
}

/** Hands-on repair time (started -> completed), or null if we don't have both times. */
export function repairHours(item: any): number | null {
  const start = toDate(item?.started_at);
  const end = toDate(item?.completed_at);
  if (!start || !end) return null;
  return Math.max((end.getTime() - start.getTime()) / MS_PER_HOUR, 0);
}

/** Waiting time (reported -> work started), or null if we don't have both times. */
export function responseHours(item: any): number | null {
  const reported = toDate(item?.reported_at);
  const start = toDate(item?.started_at);
  if (!reported || !start) return null;
  return Math.max((start.getTime() - reported.getTime()) / MS_PER_HOUR, 0);
}

/* --------------------------------------------------------------------- stats */

export function computeAssetStats(history: any[], now: Date = new Date()): AssetStats {
  const stats: AssetStats = {
    repairCost24m: 0,
    repairCost12m: 0,
    downtimeHours12m: 0,
    correctiveCount12m: 0,
    plannedCount12m: 0,
    totalCost12m: 0,
    totalDowntimeHours12m: 0,
  };

  for (const item of history || []) {
    const date = eventDate(item);
    if (!date) continue;

    const ageDays = (now.getTime() - date.getTime()) / MS_PER_DAY;
    if (ageDays > 730) continue;

    const cost = repairItemCost(item);
    const hours = recordDowntimeHours(item, now);
    const planned = isPlanned(item);

    if (!planned) stats.repairCost24m += cost;

    if (ageDays <= 365) {
      stats.totalCost12m += cost;
      stats.totalDowntimeHours12m += hours;

      if (planned) {
        stats.plannedCount12m += 1;
      } else {
        stats.repairCost12m += cost;
        stats.downtimeHours12m += hours;
        stats.correctiveCount12m += 1;
      }
    }
  }

  return stats;
}

function zeroByType(): Record<WorkType, number> {
  return {
    Breakdown: 0,
    Preventive: 0,
    'Part Replacement': 0,
    Cleaning: 0,
    Inspection: 0,
    Other: 0,
  };
}

/** Downtime hours per work type over the last `days` days. */
export function downtimeByType(
  history: any[],
  days: number = 365,
  now: Date = new Date()
): Record<WorkType, number> {
  const totals = zeroByType();
  for (const item of history || []) {
    const date = eventDate(item);
    if (!date) continue;
    if ((now.getTime() - date.getTime()) / MS_PER_DAY > days) continue;
    totals[normalizeWorkType(item.work_type)] += recordDowntimeHours(item, now);
  }
  return totals;
}

/** Downtime hours per work type for each of the last `months` calendar months (oldest first). */
export function downtimeByMonth(
  history: any[],
  months: number = 6,
  now: Date = new Date()
): { label: string; hours: Record<WorkType, number> }[] {
  const buckets: { year: number; month: number; label: string; hours: Record<WorkType, number> }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: MONTHS[d.getMonth()],
      hours: zeroByType(),
    });
  }

  for (const item of history || []) {
    const date = eventDate(item);
    if (!date) continue;
    const bucket = buckets.find(
      (b) => b.year === date.getFullYear() && b.month === date.getMonth()
    );
    if (bucket) bucket.hours[normalizeWorkType(item.work_type)] += recordDowntimeHours(item, now);
  }

  return buckets.map(({ label, hours }) => ({ label, hours }));
}

/** Simple maintenance KPIs from the last 12 months. */
export function calculateWorkStats(history: any[], now: Date = new Date()) {
  let repairSum = 0;
  let repairCount = 0;
  let responseSum = 0;
  let responseCount = 0;
  let unplannedHours = 0;
  let totalHours = 0;

  for (const item of history || []) {
    const date = eventDate(item);
    if (!date) continue;
    if ((now.getTime() - date.getTime()) / MS_PER_DAY > 365) continue;

    const hours = recordDowntimeHours(item, now);
    totalHours += hours;

    if (!isPlanned(item)) {
      unplannedHours += hours;

      const repair = repairHours(item);
      if (repair !== null) {
        repairSum += repair;
        repairCount += 1;
      }

      const response = responseHours(item);
      if (response !== null) {
        responseSum += response;
        responseCount += 1;
      }
    }
  }

  return {
    /** Mean time to repair, hours (breakdowns with start and finish times). */
    mttrHours: repairCount > 0 ? repairSum / repairCount : null,
    /** Average wait between "machine stopped" and "work started", hours. */
    avgResponseHours: responseCount > 0 ? responseSum / responseCount : null,
    /** Share of the last 12 months' downtime that was unplanned, percent. */
    unplannedSharePct: totalHours > 0 ? (unplannedHours / totalHours) * 100 : null,
    totalDowntimeHours12m: totalHours,
  };
}

/* ------------------------------------------------------ replace vs repair */

interface AssetInput {
  purchaseCost: number;
  purchaseDate: string;
  expectedLifeYears: number;
  replacementCost: number;
  salvageValue?: number;
  downtimeCostPerHour?: number;
  criticality: string;
  stats: AssetStats;
}

export function calculateAssetMetrics({
  purchaseCost,
  purchaseDate,
  expectedLifeYears,
  replacementCost,
  salvageValue = 0,
  downtimeCostPerHour = 0,
  criticality,
  stats,
}: AssetInput): AssetMetrics {
  const today = new Date();
  const purchased = parseDate(purchaseDate);

  const currentAge = purchased
    ? Math.max((today.getTime() - purchased.getTime()) / MS_PER_YEAR, 0)
    : 0;

  const remainingLife = Math.max(expectedLifeYears - currentAge, 0);

  // Straight-line depreciation down to the salvage value.
  const salvage = Math.min(Math.max(salvageValue, 0), Math.max(purchaseCost, 0));
  const currentValue =
    expectedLifeYears > 0
      ? salvage + (purchaseCost - salvage) * (remainingLife / expectedLifeYears)
      : 0;

  // If no replacement cost has been entered, fall back to the purchase cost.
  const replacementBasis = replacementCost > 0 ? replacementCost : purchaseCost;

  const repairRatio =
    replacementBasis > 0 ? (stats.repairCost24m / replacementBasis) * 100 : 0;

  // What a new machine costs per year, after selling the old one for salvage.
  const netReplacement = Math.max(replacementBasis - Math.max(salvageValue, 0), 0);
  const annualizedReplacementCost =
    expectedLifeYears > 0 ? netReplacement / expectedLifeYears : 0;

  const downtimeCost12m = stats.downtimeHours12m * Math.max(downtimeCostPerHour, 0);
  const yearlyCost = stats.repairCost12m + downtimeCost12m;

  const annualCostRatio =
    annualizedReplacementCost > 0 ? (yearlyCost / annualizedReplacementCost) * 100 : 0;

  let recommendation = 'Continue Repair';

  if (repairRatio >= 70 || annualCostRatio >= 100) {
    recommendation = 'Replace Immediately';
  } else if (repairRatio >= 50 || annualCostRatio >= 70) {
    recommendation = 'Plan Replacement';
  } else if (criticality === 'High' && (repairRatio >= 35 || annualCostRatio >= 50)) {
    recommendation = 'Budget for Replacement';
  }

  const reasons: string[] = [];

  if (replacementBasis > 0) {
    reasons.push(
      `Breakdown repairs over the last 24 months cost ${fmtMoney(stats.repairCost24m)}, ` +
        `which is ${Math.round(repairRatio)}% of a new machine (${fmtMoney(replacementBasis)}).`
    );
  } else {
    reasons.push('Enter a replacement cost to compare repairs with a new machine.');
  }

  if (annualizedReplacementCost > 0) {
    reasons.push(
      `Over the last 12 months, breakdown repairs${downtimeCostPerHour > 0 ? ' plus downtime' : ''} ` +
        `cost ${fmtMoney(yearlyCost)}. A new machine costs about ${fmtMoney(annualizedReplacementCost)} ` +
        `per year, so that is ${Math.round(annualCostRatio)}%.`
    );
  } else if (replacementBasis > 0) {
    reasons.push('Enter the expected life to turn on the yearly cost comparison.');
  }

  if (downtimeCostPerHour <= 0 && stats.downtimeHours12m > 0) {
    reasons.push(
      `Breakdown downtime (${stats.downtimeHours12m.toFixed(1)} h) is not costed yet. ` +
        'Enter "Downtime Cost Per Hour" on this machine.'
    );
  }

  if (expectedLifeYears > 0 && remainingLife <= 0) {
    reasons.push('This machine is past its expected life.');
  }

  return {
    currentAge: Number(currentAge.toFixed(1)),
    remainingLife: Number(remainingLife.toFixed(1)),
    currentValue: Number(currentValue.toFixed(0)),
    repairRatio: Number(repairRatio.toFixed(1)),
    annualCostRatio: Number(annualCostRatio.toFixed(1)),
    annualizedReplacementCost: Number(annualizedReplacementCost.toFixed(0)),
    downtimeCost12m: Number(downtimeCost12m.toFixed(0)),
    recommendation,
    reasons,
  };
}

/**
 * The one health formula used by BOTH the dashboard and the equipment detail
 * screen, so a machine always shows the same score everywhere.
 *
 * Weights: repair cost 35%, downtime 25%, breakdown frequency 25%, age 15%.
 * High-criticality machines lose 10 points once repair ratio reaches 35%.
 * This is a rule-of-thumb score, not a statistical model.
 */
export function calculateHealthIndex({
  repairRatio,
  totalDowntimeHours,
  repairsLast12Months,
  currentAge,
  expectedLifeYears,
  criticality,
}: {
  repairRatio: number;
  /** Breakdown downtime hours, last 12 months. */
  totalDowntimeHours: number;
  /** Number of breakdowns in the last 12 months. */
  repairsLast12Months: number;
  currentAge: number;
  expectedLifeYears: number;
  criticality?: string | null;
}): HealthResult {
  const ageRatio =
    expectedLifeYears > 0 ? (currentAge / expectedLifeYears) * 100 : 0;

  let costScore = 100;
  if (repairRatio >= 75) costScore = 30;
  else if (repairRatio >= 50) costScore = 50;
  else if (repairRatio >= 30) costScore = 70;
  else if (repairRatio >= 15) costScore = 85;

  let downtimeScore = 100;
  if (totalDowntimeHours >= 80) downtimeScore = 30;
  else if (totalDowntimeHours >= 40) downtimeScore = 50;
  else if (totalDowntimeHours >= 20) downtimeScore = 70;
  else if (totalDowntimeHours >= 10) downtimeScore = 85;

  let repairFrequencyScore = 100;
  if (repairsLast12Months >= 12) repairFrequencyScore = 30;
  else if (repairsLast12Months >= 8) repairFrequencyScore = 50;
  else if (repairsLast12Months >= 4) repairFrequencyScore = 70;
  else if (repairsLast12Months >= 2) repairFrequencyScore = 85;

  let ageScore = 100;
  if (ageRatio >= 100) ageScore = 30;
  else if (ageRatio >= 80) ageScore = 50;
  else if (ageRatio >= 60) ageScore = 70;
  else if (ageRatio >= 40) ageScore = 85;

  let score =
    costScore * 0.35 +
    downtimeScore * 0.25 +
    repairFrequencyScore * 0.25 +
    ageScore * 0.15;

  if (criticality === 'High' && repairRatio >= 35) score -= 10;

  const healthIndex = Math.max(0, Math.min(100, Math.round(score)));

  let status: HealthResult['status'] = 'Good';
  if (healthIndex < 60) status = 'High Risk';
  else if (healthIndex < 80) status = 'Monitor';

  return {
    healthIndex,
    status,
    costScore,
    downtimeScore,
    repairFrequencyScore,
    ageScore,
  };
}

/**
 * Predicts the next breakdown from the average gap between past breakdowns.
 * Planned work (PM, cleaning...) is ignored. If the predicted date has already
 * passed, the machine is reported as overdue instead of showing a past date.
 */
export function calculateFailurePrediction(
  history: any[],
  now: Date = new Date()
): FailurePrediction {
  const breakdownDates = (history || [])
    .filter((item) => !isPlanned(item))
    .map((item) => eventDate(item))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (breakdownDates.length < 2) {
    return {
      averageDaysBetweenRepairs: 0,
      predictedNextFailureDate: 'Not enough data',
      confidence: 'Low',
      recommendedAction: 'Log at least 2 breakdowns to predict the next one',
      isOverdue: false,
      breakdownCount: breakdownDates.length,
    };
  }

  const gaps: number[] = [];
  for (let i = 1; i < breakdownDates.length; i++) {
    gaps.push(
      (breakdownDates[i].getTime() - breakdownDates[i - 1].getTime()) / MS_PER_DAY
    );
  }

  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const variance = gaps.reduce((sum, gap) => sum + (gap - average) ** 2, 0) / gaps.length;
  const irregular = average > 0 && Math.sqrt(variance) / average > 1;

  const last = breakdownDates[breakdownDates.length - 1];
  const predicted = new Date(last);
  predicted.setDate(predicted.getDate() + Math.round(average));
  const isOverdue = predicted.getTime() < now.getTime();

  const levels = ['Low', 'Medium', 'High'];
  let level = breakdownDates.length >= 6 ? 2 : breakdownDates.length >= 3 ? 1 : 0;
  if (irregular) level = Math.max(level - 1, 0);

  let recommendedAction = 'Monitor normally';
  if (average <= 30) recommendedAction = 'Schedule preventive maintenance soon';
  else if (average <= 60) recommendedAction = 'Review maintenance plan';
  if (isOverdue) {
    recommendedAction = 'A breakdown is statistically overdue. Inspect this machine soon.';
  }

  const expected = predicted.toLocaleDateString('en-US');

  return {
    averageDaysBetweenRepairs: Number(average.toFixed(0)),
    predictedNextFailureDate: isOverdue ? `Overdue (expected ${expected})` : expected,
    confidence: levels[level],
    recommendedAction,
    isOverdue,
    breakdownCount: breakdownDates.length,
  };
}
