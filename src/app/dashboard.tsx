import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import {
  Banner,
  Button,
  Card,
  EmptyText,
  HBarList,
  Icon,
  IconButton,
  Pill,
  ProgressBar,
  Screen,
  SectionTitle,
  StatCard,
} from '../ui/kit';
import {
  causeColor,
  colors,
  money,
  recommendationTone,
  scoreTone,
  statusTone,
  toneStyles,
  WORK_TYPE_LABELS,
  workTypeColor,
} from '../ui/theme';
import {
  calculateAssetMetrics,
  calculateHealthIndex,
  computeAssetStats,
  downtimeByCause,
  downtimeByType,
  isInProgress,
  normalizeWorkType,
  recordDowntimeHours,
  WORK_TYPES,
} from '../utils/decisionEngine';
import { formatHours, useNow } from '../utils/time';

export default function Dashboard() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const now = useNow(30000);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  async function fetchDashboardData() {
    const { data: equipmentData, error: equipmentError } = await supabase
      .from('Equipment')
      .select('*');
    const { data: historyData, error: historyError } = await supabase
      .from('MaintenanceHistory')
      .select('*');

    const problem = equipmentError || historyError;
    setLoadError(problem ? problem.message : null);
    if (problem) return; // keep showing the last good data instead of zeros

    setEquipment(equipmentData || []);
    setHistory(historyData || []);
  }

  async function refresh() {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  function openMachine(id: string | number) {
    router.push({
      pathname: '/equipment/[id]',
      params: { id: id.toString() },
    });
  }

  /* ---------------------------------------------------------- calculations */

  const machines = equipment.map((machine) => {
    const machineHistory = history.filter(
      (item) => String(item.equipment_id) === String(machine.ID)
    );

    const stats = computeAssetStats(machineHistory, now);

    const purchaseCost = Number(machine.PurchaseCost || 0);
    const replacementCost = Number(machine.ReplacementCost || 0);
    const expectedLifeYears = Number(machine.ExpectedLifeYears || 0);

    const metrics = calculateAssetMetrics({
      purchaseCost,
      purchaseDate: machine.PurchaseDate,
      expectedLifeYears,
      replacementCost,
      salvageValue: Number(machine.SalvageValue || 0),
      downtimeCostPerHour: Number(machine.EstimatedDowntimeCostPerHour || 0),
      criticality: machine.Criticality || 'Medium',
      stats,
    });

    // Same formula as the equipment detail screen, so scores always match.
    const health = calculateHealthIndex({
      repairRatio: metrics.repairRatio,
      totalDowntimeHours: stats.downtimeHours12m,
      repairsLast12Months: stats.correctiveCount12m,
      currentAge: metrics.currentAge,
      expectedLifeYears,
      criticality: machine.Criticality,
    });

    const hasCostBasis = replacementCost > 0 || purchaseCost > 0;

    return {
      ...machine,
      stats,
      metrics,
      healthIndex: health.healthIndex,
      healthStatus: health.status,
      recommendation: hasCostBasis ? metrics.recommendation : 'Not enough data',
      working: machineHistory.some(isInProgress),
    };
  });

  const spend12m = machines.reduce((sum, m) => sum + m.stats.totalCost12m, 0);
  const downtime12m = machines.reduce((sum, m) => sum + m.stats.totalDowntimeHours12m, 0);
  const riskCount = machines.filter((m) => m.healthIndex < 80).length;

  const priorityMachines = [...machines]
    .sort((a, b) => a.healthIndex - b.healthIndex)
    .slice(0, 5);

  const topMachines = [...machines]
    .filter((m) => m.stats.totalCost12m > 0)
    .sort((a, b) => b.stats.totalCost12m - a.stats.totalCost12m)
    .slice(0, 5);

  const activeJobs = history
    .filter(isInProgress)
    .map((job) => ({
      job,
      machine: equipment.find((m) => String(m.ID) === String(job.equipment_id)),
    }))
    .filter((entry) => entry.machine);

  const byType = downtimeByType(history, 365, now);
  const reasonRows = WORK_TYPES.map((type) => ({
    label: WORK_TYPE_LABELS[type],
    value: byType[type],
    color: workTypeColor(type),
    display: formatHours(byType[type]),
  }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const causeRows = downtimeByCause(history, 365, now).map((row) => ({
    label: row.cause,
    value: row.hours,
    color: causeColor(row.cause),
    display: `${formatHours(row.hours)} \u00b7 ${Math.round(row.cumulativePct)}%`,
  }));

  /* ---------------------------------------------------------------- screen */

  return (
    <Screen
      title="Dashboard"
      subtitle="Equipment health and repair spend"
      right={
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon="team"
            label="Team"
            onPress={() => router.push('/team')}
            style={{ marginRight: 8 }}
          />
          <IconButton icon="logout" label="Log out" onPress={logOut} />
        </View>
      }
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {loadError ? (
        <View style={{ marginBottom: 12 }}>
          <Banner
            tone="bad"
            icon="warning"
            title="Can't load your data"
            text={`${loadError}. Check your internet connection, then pull down to try again.`}
          />
        </View>
      ) : null}

      {activeJobs.length > 0 ? (
        <>
          <SectionTitle>Work in Progress</SectionTitle>
          {activeJobs.map(({ job, machine }) => {
            const type = normalizeWorkType(job.work_type);
            return (
              <Card
                key={job.id}
                onPress={() => openMachine(machine.ID)}
                style={{ borderLeftWidth: 5, borderLeftColor: workTypeColor(type) }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                      {machine.Name}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 2 }}>
                      {WORK_TYPE_LABELS[type]} · down {formatHours(recordDowntimeHours(job, now))}
                    </Text>
                    {job.technician_email ? (
                      <Text style={{ color: colors.faint, fontSize: 12, marginTop: 2 }}>
                        {job.technician_email}
                      </Text>
                    ) : null}
                  </View>
                  <Pill text="In progress" tone="warn" icon="wrench" />
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 }}>
        <StatCard icon="machines" tone="info" label="Total Assets" value={String(equipment.length)} />
        <StatCard icon="money" tone="warn" label="Spend (12 mo)" value={money(spend12m)} />
        <StatCard icon="clock" tone="neutral" label="Downtime (12 mo)" value={formatHours(downtime12m)} />
        <StatCard
          icon="warning"
          tone={riskCount > 0 ? 'bad' : 'good'}
          label="Need Review"
          value={String(riskCount)}
        />
      </View>

      <Button
        title="Scan Machine QR"
        icon="scan"
        variant="accent"
        onPress={() => router.push('/scan')}
      />
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <Button
          title="Add Equipment"
          icon="plus"
          variant="secondary"
          style={{ flex: 1.3, marginRight: 8 }}
          onPress={() => router.push('/equipment/add')}
        />
        <Button
          title="QR Labels"
          icon="qr"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push('/labels')}
        />
      </View>

      <SectionTitle>Downtime by Reason</SectionTitle>
      <Card>
        {reasonRows.length === 0 ? (
          <EmptyText>No downtime recorded yet. Open a machine and tap Start Work.</EmptyText>
        ) : (
          <HBarList rows={reasonRows} />
        )}
        <Text style={{ color: colors.faint, fontSize: 12 }}>All machines, last 12 months.</Text>
      </Card>

      <SectionTitle>Top Breakdown Causes</SectionTitle>
      <Card>
        {causeRows.length === 0 ? (
          <EmptyText>No breakdowns recorded yet. Causes show up here once you log one on Finish Work.</EmptyText>
        ) : (
          <HBarList rows={causeRows} />
        )}
        <Text style={{ color: colors.faint, fontSize: 12 }}>
          Unplanned breakdowns only, last 12 months. % is the running share of total breakdown downtime -
          the top rows are where fixing the root cause saves the most hours.
        </Text>
      </Card>

      <SectionTitle>Priority Machines</SectionTitle>

      {priorityMachines.length === 0 ? (
        <EmptyText>No equipment yet. Tap Add Equipment to start.</EmptyText>
      ) : (
        priorityMachines.map((machine, index) => {
          const tone = scoreTone(machine.healthIndex);
          return (
            <Card key={machine.ID} onPress={() => openMachine(machine.ID)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                    {index + 1}. {machine.Name}
                  </Text>
                  {machine.Location ? (
                    <Text style={{ color: colors.muted, marginTop: 2 }}>{machine.Location}</Text>
                  ) : null}
                </View>
                <Pill text={machine.healthStatus} tone={statusTone(machine.healthStatus)} />
              </View>

              {machine.working ? (
                <View style={{ marginTop: 10 }}>
                  <Pill text="Work in progress" tone="warn" icon="wrench" />
                </View>
              ) : null}

              <View style={{ marginTop: 14 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ color: colors.muted }}>Health</Text>
                  <Text style={{ fontWeight: '800', color: toneStyles[tone].fg }}>
                    {machine.healthIndex} / 100
                  </Text>
                </View>
                <ProgressBar value={machine.healthIndex} tone={tone} />
              </View>

              <Banner
                tone={recommendationTone(machine.recommendation)}
                icon="bulb"
                title={machine.recommendation}
              />

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  columnGap: 12,
                  rowGap: 4,
                  marginTop: 12,
                }}
              >
                <Text style={{ color: colors.muted }}>
                  Breakdown repairs (24 mo){' '}
                  <Text style={{ fontWeight: '800', color: colors.text }}>
                    {money(machine.stats.repairCost24m)}
                  </Text>
                </Text>
                <Text style={{ color: colors.muted }}>
                  Repair ratio{' '}
                  <Text style={{ fontWeight: '800', color: colors.text }}>
                    {machine.metrics.repairRatio}%
                  </Text>
                </Text>
              </View>
            </Card>
          );
        })
      )}

      <SectionTitle>Highest Cost Machines</SectionTitle>

      {topMachines.length === 0 ? (
        <EmptyText>No maintenance spend in the last 12 months.</EmptyText>
      ) : (
        topMachines.map((machine, index) => (
          <Card key={machine.ID} onPress={() => openMachine(machine.ID)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: toneStyles.warn.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ fontWeight: '800', color: toneStyles.warn.fg }}>{index + 1}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                  {machine.Name}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>
                  {money(machine.stats.totalCost12m)} in the last 12 months
                </Text>
              </View>

              <Icon name="chevron" size={16} color={colors.faint} />
            </View>
          </Card>
        ))
      )}

      <SectionTitle>Equipment List</SectionTitle>

      {equipment.length === 0 ? (
        <EmptyText>Nothing here yet.</EmptyText>
      ) : (
        equipment.map((item) => (
          <Card key={item.ID} onPress={() => openMachine(item.ID)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                  {item.Name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Icon name="pin" size={13} color={colors.muted} />
                  <Text style={{ color: colors.muted, marginLeft: 4 }}>
                    {item.Location || 'No location'}
                  </Text>
                </View>
              </View>
              {item.Status ? <Pill text={String(item.Status)} tone="neutral" /> : null}
              <View style={{ marginLeft: 10 }}>
                <Icon name="chevron" size={16} color={colors.faint} />
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
