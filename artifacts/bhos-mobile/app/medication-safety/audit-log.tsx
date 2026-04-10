import { Feather } from "@expo/vector-icons";
import { useListMedicationAuditLog } from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const ACTION_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; bg: string }> = {
  create: { icon: "plus-circle", color: "#16a34a", bg: "#F0FDF4" },
  administered: { icon: "check-circle", color: "#16a34a", bg: "#F0FDF4" },
  auto_decrement: { icon: "minus-circle", color: "#d97706", bg: "#FEF3C7" },
  prn_followup: { icon: "clock", color: "#2563eb", bg: "#EFF6FF" },
  refused: { icon: "x-circle", color: "#dc2626", bg: "#FEE2E2" },
  side_effect: { icon: "zap", color: "#dc2626", bg: "#FEE2E2" },
  count_decremented: { icon: "hash", color: "#d97706", bg: "#FEF3C7" },
};

export default function AuditLogScreen() {
  const colors = useColors();
  const { data: auditLog, isLoading, refetch } = useListMedicationAuditLog();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (isToday) return `Today ${time}`;
    if (isYesterday) return `Yesterday ${time}`;
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 60, paddingTop: Platform.OS === "web" ? 10 : 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>Audit Trail</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Complete medication administration history
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (auditLog ?? []).length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="file-text" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No audit entries yet</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {(auditLog ?? []).map((entry: any, index: number) => {
              const config = ACTION_CONFIG[entry.action] || { icon: "activity" as const, color: "#64748b", bg: "#F8FAFC" };
              return (
                <View key={entry.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: config.bg }]}>
                      <Feather name={config.icon} size={14} color={config.color} />
                    </View>
                    {index < (auditLog ?? []).length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                  <View style={[styles.timelineContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.timelineHeader}>
                      <Text style={[styles.actionLabel, { color: config.color }]}>
                        {(entry.action || "").replace(/_/g, " ")}
                      </Text>
                      <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
                        {entry.createdAt ? formatDate(entry.createdAt) : ""}
                      </Text>
                    </View>
                    <Text style={[styles.details, { color: colors.foreground }]} numberOfLines={3}>
                      {entry.details}
                    </Text>
                    {entry.previousValue && entry.newValue && (
                      <View style={styles.changeRow}>
                        <Text style={[styles.changeLabel, { color: colors.mutedForeground }]}>
                          {entry.previousValue} → {entry.newValue}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.entityInfo, { color: colors.mutedForeground }]}>
                      {entry.entityType} #{entry.entityId}
                      {entry.performedByName ? ` · ${entry.performedByName}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 20 },
  emptyState: { alignItems: "center", padding: 40, borderRadius: 16, borderWidth: 1 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
  timeline: { paddingLeft: 4 },
  timelineItem: { flexDirection: "row", marginBottom: 4 },
  timelineLeft: { width: 36, alignItems: "center" },
  timelineDot: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineContent: { flex: 1, marginLeft: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  timestamp: { fontSize: 11, fontFamily: "Inter_400Regular" },
  details: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  changeRow: { marginTop: 4 },
  changeLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  entityInfo: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
});
