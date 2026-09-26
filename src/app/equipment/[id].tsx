import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import {
  Banner,
  Button,
  Card,
  EmptyText,
  IconButton,
  KeyValue,
  Legend,
  Pill,
  ProgressBar,
  Screen,
  SectionTitle,
  StackedBarChart,
  StatCard,
} from '../../ui/kit';
import {
  colors,
  criticalityTone,
  money,
  recommendationTone,
  scoreTone,
  statusTone,
  toneStyles,
  WORK_TYPE_LABELS,
  workTypeColor,
} from '../../ui/theme';
import {
  calculateAssetMetrics,
  calculateFailurePrediction,
  calculateHealthIndex,
  calculateWorkStats,
  computeAssetStats,
  downtimeByMonth,
  eventDate,
  isInProgress,
  isPlanned,
  normalizeWorkType,
  parseDate,
  recordDowntimeHours,
  repairItemCost,
  WORK_TYPES,
} from '../../utils/decisionEngine';
import { formatDateTime, formatElapsed, formatHours, useNow } from '../../utils/time';

export default function EquipmentDetail() {
  const { id } = useLocalSearchParams();

  const [equipment, setEquipment] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchEquipment();
      fetchMaintenanceHistory();
    }, [id])
  );

  async function fetchEquipment() {
    const { data, error } = await supabase
      .from('Equipment')
      .select('*')
      .eq('ID', id)
      .single();

    if (!error) setEquipment(data);
  }

  async function fetchMaintenanceHistory() {
    const { data, error } = await supabase
      .from('MaintenanceHistory')
      .select('*')
      .eq('equipment_id', id)
      .order('created_at', { ascending: false });

    if (error || !data) return;
    setHistory(data);
  }

  const activeJob = history.find(isInProgress) ?? null;
  const now = useNow(activeJob ? 1000 : 60000);

  function riskLevel(score: number) {
    if (score >= 80) return 'Low';
    if (score >= 60) return 'Medium';
    return 'High';
  }

  function confirmDeleteRecord(recordId: number) {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this maintenance record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRecord(recordId),
        },
      ]
    );
  }

  async function deleteRecord(recordId: number) {
    const { error } = await supabase
      .from('MaintenanceHistory')
      .delete()
      .eq('id', recordId);

    if (error) {
      Alert.alert('Delete Failed', error.message);
      return;
    }

    fetchMaintenanceHistory();
  }

  function confirmDeleteEquipment() {
    Alert.alert(
      'Delete Equipment',
      'This will permanently delete this equipment and its maintenance records. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Equipment',
          style: 'destructive',
          onPress: deleteEquipment,
        },
      ]
    );
  }

  async function deleteEquipment() {
    const { error: historyError } = await supabase
      .from('MaintenanceHistory')
      .delete()
      .eq('equipment_id', id);

    if (historyError) {
      Alert.alert('Delete Failed', historyError.message);
      return;
    }

    const { error } = await supabase.from('Equipment').delete().eq('ID', id);

    if (error) {
      Alert.alert('Delete Failed', error.message);
      return;
    }

    router.replace('/dashboard');
  }

  /* ---------------------------------------------------------- calculations */

  const purchaseCost = Number(equipment?.PurchaseCost || 0);
  const replacementCost = Number(equipment?.ReplacementCost || 0);
  const salvageValue = Number(equipment?.SalvageValue || 0);
  const downtimeCostPerHour = Number(equipment?.EstimatedDowntimeCostPerHour || 0);
  const expectedLifeYears = Number(equipment?.ExpectedLifeYears || 0);

  const stats = computeAssetStats(history, now);
  const workStats = calculateWorkStats(history, now);

  const metrics = calculateAssetMetrics({
    purchaseCost,
    purchaseDate: equipment?.PurchaseDate,
    expectedLifeYears,
    replacementCost,
    salvageValue,
    downtimeCostPerHour,
    criticality: equipment?.Criticality || 'Medium',
    stats,
  });

  // Only show age / value figures once a valid purchase date and expected life exist.
  const assetMetrics =
    parseDate(equipment?.PurchaseDate) && expectedLifeYears > 0 ? metrics : null;

  const failurePrediction = calculateFailurePrediction(history, now);

  // Same formula as the dashboard, so scores always match.
  const {
    healthIndex,
    status: healthStatus,
    costScore,
    downtimeScore,
    repairFrequencyScore,
    ageScore,
  } = calculateHealthIndex({
    repairRatio: metrics.repairRatio,
    totalDowntimeHours: stats.downtimeHours12m,
    repairsLast12Months: stats.correctiveCount12m,
    currentAge: metrics.currentAge,
    expectedLifeYears,
    criticality: equipment?.Criticality,
  });

  const displayRecommendation =
    purchaseCost > 0 || replacementCost > 0
      ? metrics.recommendation
      : 'Not enough data';

  const day = 24 * 60 * 60 * 1000;
  let spend30 = 0;
  let spend90 = 0;
  history.forEach((item) => {
    const date = eventDate(item);
    if (!date) return;
    const cost = repairItemCost(item);
    if (now.getTime() - date.getTime() <= 30 * day) spend30 += cost;
    if (now.getTime() - date.getTime() <= 90 * day) spend90 += cost;
  });

  const monthly = downtimeByMonth(history, 6, now);
  const hasDowntimeData = monthly.some((m) => WORK_TYPES.some((t) => m.hours[t] > 0));

  const healthTone = scoreTone(healthIndex);
  const recTone = recommendationTone(displayRecommendation);

  const subScores = [
    { label: 'Repair cost', score: costScore },
    { label: 'Downtime', score: downtimeScore },
    { label: 'Breakdown frequency', score: repairFrequencyScore },
    { label: 'Age', score: ageScore },
  ];

  const sortedHistory = [...history].sort(
    (a, b) => (eventDate(b)?.getTime() ?? 0) - (eventDate(a)?.getTime() ?? 0)
  );

  const activeType = activeJob ? normalizeWorkType(activeJob.work_type) : null;

  /* ---------------------------------------------------------------- screen */

  return (
    <Screen
      title={equipment ? equipment.Name : 'Loading...'}
      subtitle={equipment?.Location || undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
      right={
        equipment ? (
          <IconButton
            icon="qr"
            label="QR label"
            onPress={() =>
              router.push({ pathname: '/labels', params: { equipmentId: String(id) } })
            }
          />
        ) : undefined
      }
    >
      {equipment ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {equipment.Status ? (
            <View style={{ marginRight: 8, marginBottom: 8 }}>
              <Pill text={`Status: ${equipment.Status}`} tone="neutral" />
            </View>
          ) : null}
          <View style={{ marginRight: 8, marginBottom: 8 }}>
            <Pill
              text={`Criticality: ${equipment.Criticality || 'Not set'}`}
              tone={criticalityTone(equipment.Criticality)}
            />
          </View>
        </View>
      ) : null}

      {activeJob && activeType ? (
        <Card style={{ borderColor: colors.accent, borderWidth: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pill text="WORK IN PROGRESS" tone="warn" icon="wrench" />
            <Pill text={WORK_TYPE_LABELS[activeType]} tone="neutral" />
          </View>

          <Text
            style={{
              fontSize: 40,
              fontWeight: '800',
              color: workTypeColor(activeType),
              marginTop: 12,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatElapsed(now.getTime() - new Date(activeJob.started_at || activeJob.created_at).getTime())}
          </Text>
          <Text style={{ color: colors.muted }}>
            {activeJob.description || 'No description yet'}
          </Text>

          <View style={{ marginTop: 10 }}>
            <KeyValue label="Started" value={formatDateTime(activeJob.started_at || activeJob.created_at)} />
            <KeyValue label="Downtime so far" value={formatHours(recordDowntimeHours(activeJob, now))} bold />
            {activeJob.technician_email ? (
              <KeyValue label="Technician" value={activeJob.technician_email} />
            ) : null}
          </View>

          <Button
            title="Finish work"
            icon="check"
            variant="accent"
            style={{ marginTop: 10 }}
            onPress={() =>
              router.push({
                pathname: '/equipment/finish-work',
                params: { recordId: String(activeJob.id) },
              })
            }
          />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          <Button
            title="Start Work"
            icon="wrench"
            variant="accent"
            style={{ flex: 1.2, marginRight: 8 }}
            onPress={() =>
              router.push({
                pathname: '/equipment/start-work',
                params: { equipmentId: String(id) },
              })
            }
          />
          <Button
            title="Log Past Job"
            icon="plus"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() =>
              router.push({
                pathname: '/equipment/add-maintenance',
                params: { equipmentId: String(id) },
              })
            }
          />
        </View>
      )}

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        <Button
          title="Edit"
          icon="edit"
          variant="secondary"
          style={{ flex: 1, marginRight: 8 }}
          onPress={() =>
            router.push({
              pathname: '/equipment/edit',
              params: { equipmentId: String(id) },
            })
          }
        />
        <Button
          title="Delete"
          icon="trash"
          variant="danger"
          style={{ flex: 1 }}
          onPress={confirmDeleteEquipment}
        />
      </View>

      <SectionTitle>Asset Health</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 44, fontWeight: '800', color: toneStyles[healthTone].fg }}>
            {healthIndex}
            <Text style={{ fontSize: 18, color: colors.muted }}> / 100</Text>
          </Text>
          <Pill text={healthStatus} tone={statusTone(healthStatus)} />
        </View>
        <View style={{ marginTop: 6 }}>
          <ProgressBar value={healthIndex} tone={healthTone} />
        </View>

        <View style={{ marginTop: 8 }}>
          {subScores.map((item) => (
            <View key={item.label} style={{ marginTop: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: colors.muted }}>{item.label}</Text>
                <Text style={{ fontWeight: '700', color: toneStyles[scoreTone(item.score)].fg }}>
                  {item.score} / 100 · {riskLevel(item.score)} risk
                </Text>
              </View>
              <ProgressBar value={item.score} tone={scoreTone(item.score)} />
            </View>
          ))}
        </View>
        <Text style={{ color: colors.faint, fontSize: 12, marginTop: 12 }}>
          Based on breakdowns only. Planned work such as PM and cleaning does not lower the score.
        </Text>
      </Card>

      <SectionTitle>Repair vs Replace</SectionTitle>
      <Card>
        <KeyValue label="Replacement cost" value={money(replacementCost)} />
        <KeyValue label="Salvage value" value={money(salvageValue)} />
        <KeyValue label="Breakdown repairs (24 mo)" value={money(stats.repairCost24m)} />
        <KeyValue label="Repair ratio" value={`${metrics.repairRatio}%`} bold />
        <KeyValue
          label="New machine, per year"
          value={metrics.annualizedReplacementCost > 0 ? money(metrics.annualizedReplacementCost) : '-'}
        />
        <KeyValue
          label="Repairs + downtime (12 mo)"
          value={money(stats.repairCost12m + metrics.downtimeCost12m)}
        />
        <KeyValue
          label="Yearly cost ratio"
          value={metrics.annualizedReplacementCost > 0 ? `${metrics.annualCostRatio}%` : '-'}
          bold
        />
        <Banner
          tone={recTone}
          icon="bulb"
          title={displayRecommendation}
          text={displayRecommendation === 'Not enough data' ? undefined : metrics.reasons.join('\n\n')}
        />
      </Card>

      <SectionTitle>Last 12 Months</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <StatCard icon="money" tone="warn" label="Maintenance Cost" value={money(stats.totalCost12m)} />
        <StatCard
          icon="clock"
          tone="neutral"
          label="Downtime"
          value={formatHours(stats.totalDowntimeHours12m)}
        />
      </View>

      <SectionTitle>Downtime by Reason</SectionTitle>
      <Card>
        {hasDowntimeData ? (
          <>
            <StackedBarChart
              bars={monthly.map((m) => ({
                label: m.label,
                segments: WORK_TYPES.map((t) => ({ color: workTypeColor(t), value: m.hours[t] })),
              }))}
            />
            <Legend items={WORK_TYPES.map((t) => ({ label: WORK_TYPE_LABELS[t], color: workTypeColor(t) }))} />
          </>
        ) : (
          <EmptyText>No downtime recorded yet. Use Start Work to time a job.</EmptyText>
        )}

        <View style={{ marginTop: 8 }}>
          <KeyValue
            label="Unplanned share"
            value={workStats.unplannedSharePct === null ? '-' : `${Math.round(workStats.unplannedSharePct)}%`}
          />
          <KeyValue
            label="Avg repair time"
            value={workStats.mttrHours === null ? '-' : formatHours(workStats.mttrHours)}
          />
          <KeyValue
            label="Avg wait before work starts"
            value={workStats.avgResponseHours === null ? '-' : formatHours(workStats.avgResponseHours)}
          />
        </View>
      </Card>

      <SectionTitle>Maintenance Trend</SectionTitle>
      <Card>
        <KeyValue label="Last 30 days spend" value={money(spend30)} />
        <KeyValue label="Last 90 days spend" value={money(spend90)} />
        <KeyValue label="Breakdowns (12 mo)" value={String(stats.correctiveCount12m)} />
        <KeyValue label="Planned jobs (12 mo)" value={String(stats.plannedCount12m)} />
      </Card>

      <SectionTitle>Asset Intelligence</SectionTitle>
      <Card>
        <KeyValue label="Purchase cost" value={money(purchaseCost)} />
        <KeyValue label="Purchase date" value={equipment?.PurchaseDate || 'Not entered'} />
        <KeyValue
          label="Expected life"
          value={equipment?.ExpectedLifeYears ? `${equipment.ExpectedLifeYears} years` : 'Not entered'}
        />
        <KeyValue label="Current age" value={assetMetrics ? `${assetMetrics.currentAge} years` : '-'} />
        <KeyValue
          label="Remaining life"
          value={assetMetrics ? `${assetMetrics.remainingLife} years` : '-'}
        />
        <KeyValue
          label="Current value"
          value={assetMetrics ? money(assetMetrics.currentValue) : '-'}
        />
        <KeyValue label="Downtime cost per hour" value={money(downtimeCostPerHour)} />
      </Card>

      <SectionTitle>Failure Prediction</SectionTitle>
      <Card>
        <KeyValue
          label="Avg days between breakdowns"
          value={
            failurePrediction.averageDaysBetweenRepairs > 0
              ? String(failurePrediction.averageDaysBetweenRepairs)
              : 'Not enough data'
          }
        />
        <KeyValue label="Next breakdown" value={failurePrediction.predictedNextFailureDate} />
        <KeyValue label="Confidence" value={failurePrediction.confidence} />
        <Banner
          tone={failurePrediction.isOverdue ? 'bad' : 'info'}
          icon={failurePrediction.isOverdue ? 'warning' : 'trend'}
          title={failurePrediction.recommendedAction}
        />
      </Card>

      <SectionTitle>Repair History</SectionTitle>
      {sortedHistory.length === 0 ? (
        <EmptyText>No maintenance records yet.</EmptyText>
      ) : (
        sortedHistory.map((item) => {
          const type = normalizeWorkType(item.work_type);
          const planned = isPlanned(item);
          const inProgress = isInProgress(item);
          const hours = recordDowntimeHours(item, now);

          return (
            <Card
              key={item.id}
              style={{ borderLeftWidth: 5, borderLeftColor: workTypeColor(type) }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                    {item.description || WORK_TYPE_LABELS[type]}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>
                    {formatDateTime(item.started_at || item.created_at)}
                  </Text>
                  {item.technician_email ? (
                    <Text style={{ color: colors.faint, fontSize: 12, marginTop: 2 }}>
                      {item.technician_email}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                  {money(repairItemCost(item))}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                {inProgress ? (
                  <View style={{ marginRight: 6, marginBottom: 6 }}>
                    <Pill text="In progress" tone="warn" icon="wrench" />
                  </View>
                ) : null}
                <View style={{ marginRight: 6, marginBottom: 6 }}>
                  <Pill text={WORK_TYPE_LABELS[type]} tone="neutral" />
                </View>
                <View style={{ marginRight: 6, marginBottom: 6 }}>
                  <Pill text={planned ? 'Planned' : 'Unplanned'} tone={planned ? 'good' : 'bad'} />
                </View>
                <View style={{ marginRight: 6, marginBottom: 6 }}>
                  <Pill
                    text={`${formatHours(hours)} down`}
                    tone={hours > 0 && !planned ? 'warn' : 'neutral'}
                    icon="clock"
                  />
                </View>
                {item.cause ? (
                  <View style={{ marginRight: 6, marginBottom: 6 }}>
                    <Pill text={`Cause: ${item.cause}`} tone="info" />
                  </View>
                ) : null}
                {Number(item.labor_cost) > 0 ? (
                  <View style={{ marginRight: 6, marginBottom: 6 }}>
                    <Pill text={`Labor ${money(item.labor_cost)}`} tone="neutral" />
                  </View>
                ) : null}
                {Number(item.parts_cost) > 0 ? (
                  <View style={{ marginRight: 6, marginBottom: 6 }}>
                    <Pill text={`Parts ${money(item.parts_cost)}`} tone="neutral" />
                  </View>
                ) : null}
                {Number(item.contractor_cost) > 0 ? (
                  <View style={{ marginRight: 6, marginBottom: 6 }}>
                    <Pill text={`Contractor ${money(item.contractor_cost)}`} tone="neutral" />
                  </View>
                ) : null}
              </View>

              <Button
                title="Delete record"
                icon="trash"
                variant="danger"
                style={{ height: 40, marginTop: 6 }}
                onPress={() => confirmDeleteRecord(item.id)}
              />
            </Card>
          );
        })
      )}
    </Screen>
  );
}
