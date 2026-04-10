import { Feather } from "@expo/vector-icons";
import {
  useGetMedicationSafetyDashboard,
  useGetPendingPrnFollowups,
  useListMedicationSideEffects,
  useListMedicationRefusals,
  useListMedicationAuditLog,
  useListMedications,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function MetricCard({ label, value, icon, color, colors }: any) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function MedicationSafetyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: dashboard, isLoading, refetch: refetchDash } = useGetMedicationSafetyDashboard();
  const { data: pendingFollowups, refetch: refetchFollowups } = useGetPendingPrnFollowups();
  const { data: sideEffects } = useListMedicationSideEffects();
  const { data: refusals } = useListMedicationRefusals();
  const { data: auditLog } = useListMedicationAuditLog();
  const { data: medications } = useListMedications();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDash(), refetchFollowups()]);
    setRefreshing(false);
  };

  const expiringMeds = (medications ?? []).filter((m: any) => {
    if (!m.expirationDate || !m.active) return false;
    const exp = new Date(m.expirationDate);
    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 30;
  });

  const lowStockMeds = (medications ?? []).filter((m: any) =>
    m.active && m.quantityOnHand != null && m.refillThreshold != null && m.quantityOnHand <= m.refillThreshold
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: Platform.OS === "web" ? 10 : 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard label="Compliance" value={`${dashboard?.overallComplianceRate ?? 0}%`} icon="shield" color="#16a34a" colors={colors} />
            <MetricCard label="Overdue" value={dashboard?.overdueMedications ?? 0} icon="clock" color="#dc2626" colors={colors} />
            <MetricCard label="Administered" value={dashboard?.todayAdministrations ?? 0} icon="check-circle" color="#2563eb" colors={colors} />
            <MetricCard label="Errors" value={dashboard?.openMedicationErrors ?? 0} icon="alert-triangle" color="#d97706" colors={colors} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>QUICK ACTIONS</Text>
            <View style={styles.actionsGrid}>
              <Pressable
                style={[styles.actionCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                onPress={() => router.push("/medication-safety/side-effects")}
              >
                <Feather name="zap" size={20} color="#2563eb" />
                <Text style={[styles.actionLabel, { color: "#1e40af" }]}>Report{"\n"}Side Effect</Text>
              </Pressable>
              <Pressable
                style={[styles.actionCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                onPress={() => router.push("/medication-safety/refusals")}
              >
                <Feather name="x-circle" size={20} color="#dc2626" />
                <Text style={[styles.actionLabel, { color: "#991b1b" }]}>Record{"\n"}Refusal</Text>
              </Pressable>
              <Pressable
                style={[styles.actionCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}
                onPress={() => router.push("/medication-safety/prn-followups")}
              >
                <Feather name="clock" size={20} color="#16a34a" />
                <Text style={[styles.actionLabel, { color: "#166534" }]}>PRN{"\n"}Follow-ups</Text>
                {(pendingFollowups ?? []).length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{(pendingFollowups ?? []).length}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionCard, { backgroundColor: "#FFF7ED", borderColor: "#FDBA74" }]}
                onPress={() => router.push("/medication-safety/audit-log")}
              >
                <Feather name="file-text" size={20} color="#d97706" />
                <Text style={[styles.actionLabel, { color: "#92400e" }]}>Audit{"\n"}Trail</Text>
              </Pressable>
            </View>
          </View>

          {expiringMeds.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>EXPIRATION ALERTS</Text>
              {expiringMeds.map((med: any) => {
                const daysLeft = Math.ceil((new Date(med.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const isExpired = daysLeft <= 0;
                return (
                  <View key={med.id} style={[styles.alertCard, {
                    backgroundColor: isExpired ? "#FEE2E2" : "#FFF7ED",
                    borderColor: isExpired ? "#FECACA" : "#FDBA74",
                  }]}>
                    <Feather name="alert-triangle" size={16} color={isExpired ? "#dc2626" : "#d97706"} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.alertName, { color: isExpired ? "#991b1b" : "#92400e" }]}>{med.name} ({med.dosage})</Text>
                      <Text style={[styles.alertDetail, { color: isExpired ? "#dc2626" : "#d97706" }]}>
                        {isExpired ? `EXPIRED ${Math.abs(daysLeft)} days ago` : `Expires in ${daysLeft} days`}
                        {med.lotNumber ? ` · Lot: ${med.lotNumber}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {lowStockMeds.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>LOW STOCK ALERTS</Text>
              {lowStockMeds.map((med: any) => (
                <View key={med.id} style={[styles.alertCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                  <Feather name="package" size={16} color="#2563eb" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.alertName, { color: "#1e40af" }]}>{med.name} ({med.dosage})</Text>
                    <Text style={[styles.alertDetail, { color: "#2563eb" }]}>
                      {med.quantityOnHand} remaining (threshold: {med.refillThreshold})
                      {med.pharmacyName ? ` · ${med.pharmacyName}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {(pendingFollowups ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PENDING PRN FOLLOW-UPS</Text>
              {(pendingFollowups ?? []).slice(0, 3).map((f: any) => (
                <Pressable
                  key={f.id}
                  style={[styles.followupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push("/medication-safety/prn-followups")}
                >
                  <View style={styles.followupHeader}>
                    <Text style={[styles.followupMed, { color: colors.foreground }]}>{f.medicationName}</Text>
                    <View style={[styles.timerBadge, {
                      backgroundColor: (f.minutesRemaining ?? 0) <= 0 ? "#FEE2E2" : "#EFF6FF"
                    }]}>
                      <Feather name="clock" size={12} color={(f.minutesRemaining ?? 0) <= 0 ? "#dc2626" : "#2563eb"} />
                      <Text style={[styles.timerText, {
                        color: (f.minutesRemaining ?? 0) <= 0 ? "#dc2626" : "#2563eb"
                      }]}>
                        {(f.minutesRemaining ?? 0) <= 0 ? "OVERDUE" : `${f.minutesRemaining}m`}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.followupPatient, { color: colors.mutedForeground }]}>
                    Patient: {f.patientName} · Reason: {f.prnReason || "N/A"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {(sideEffects ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT SIDE EFFECTS</Text>
              {(sideEffects ?? []).slice(0, 3).map((se: any) => (
                <View key={se.id} style={[styles.seCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.seHeader}>
                    <Text style={[styles.seName, { color: colors.foreground }]}>{se.sideEffect}</Text>
                    <View style={[styles.severityTag, {
                      backgroundColor: se.severity === "severe" ? "#FEE2E2" : se.severity === "moderate" ? "#FEF3C7" : "#F0FDF4"
                    }]}>
                      <Text style={[styles.severityText, {
                        color: se.severity === "severe" ? "#dc2626" : se.severity === "moderate" ? "#d97706" : "#16a34a"
                      }]}>{se.severity}</Text>
                    </View>
                  </View>
                  <Text style={[styles.seDetail, { color: colors.mutedForeground }]}>
                    {se.medicationName} · {se.patientName}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {(auditLog ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT AUDIT TRAIL</Text>
              {(auditLog ?? []).slice(0, 5).map((entry: any) => (
                <View key={entry.id} style={[styles.auditRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.auditDot, {
                    backgroundColor: entry.action === "create" ? "#16a34a" : entry.action === "auto_decrement" ? "#d97706" : "#64748b"
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.auditAction, { color: colors.foreground }]}>{(entry.action || "").replace(/_/g, " ")}</Text>
                    <Text style={[styles.auditDetails, { color: colors.mutedForeground }]} numberOfLines={2}>{entry.details}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginTop: 8 },
  metricCard: { flex: 1, minWidth: "45%", padding: 14, borderRadius: 12, borderWidth: 1 },
  metricIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  metricValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 10, paddingLeft: 4 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionCard: { flex: 1, minWidth: "45%", padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 8 },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  badge: { position: "absolute", top: 6, right: 6, backgroundColor: "#dc2626", borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center" },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  alertCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  alertName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  alertDetail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  followupCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  followupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  followupMed: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timerText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  followupPatient: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  seCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  seHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  severityTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  seDetail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  auditRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  auditDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  auditAction: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  auditDetails: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
