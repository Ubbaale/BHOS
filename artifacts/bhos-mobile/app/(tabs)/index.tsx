import { Feather } from "@expo/vector-icons";
import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
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

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ActivityItem({ item }: { item: { type: string; description: string; timestamp: string } }) {
  const colors = useColors();
  const iconMap: Record<string, { name: keyof typeof Feather.glyphMap; color: string }> = {
    incident: { name: "alert-triangle", color: colors.destructive },
    medication: { name: "heart", color: colors.success },
    daily_log: { name: "file-text", color: colors.primary },
    shift: { name: "clock", color: colors.warning },
  };
  const iconInfo = iconMap[item.type] || { name: "activity" as const, color: colors.mutedForeground };

  return (
    <View style={[styles.activityRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.activityIcon, { backgroundColor: iconInfo.color + "15" }]}>
        <Feather name={iconInfo.name} size={16} color={iconInfo.color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityText, { color: colors.foreground }]} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={[styles.activityTime, { color: colors.mutedForeground }]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: activityLoading, refetch: refetchActivity } = useGetRecentActivity();

  const isLoading = summaryLoading || activityLoading;

  const onRefresh = () => {
    refetchSummary();
    refetchActivity();
  };

  const quickActions = [
    { label: "Clock In", icon: "log-in" as const, color: "#0ea5e9", onPress: () => router.push("/clock") },
    { label: "Log Meds", icon: "heart" as const, color: colors.success, onPress: () => router.push("/medications/administer") },
    { label: "Report", icon: "alert-triangle" as const, color: colors.destructive, onPress: () => router.push("/incidents/new") },
    { label: "Daily Log", icon: "file-text" as const, color: colors.primary, onPress: () => router.push("/daily-logs/new") },
  ];

  if (isLoading && !summary) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0) }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + insets.top : 16 }]}>
        <Text style={[styles.greeting, { color: colors.foreground }]}>BHOS</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Staff Command Center</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Homes" value={summary?.totalHomes ?? 0} icon="home" color={colors.primary} />
        <StatCard label="Patients" value={summary?.totalPatients ?? 0} icon="users" color="#8b5cf6" />
        <StatCard label="Staff" value={summary?.totalStaff ?? 0} icon="user-check" color={colors.success} />
        <StatCard label="Incidents" value={summary?.activeIncidents ?? 0} icon="alert-triangle" color={colors.destructive} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {quickActions.map((action) => (
          <Pressable
            key={action.label}
            style={({ pressed }) => [
              styles.quickAction,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={action.onPress}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.color + "15" }]}>
              <Feather name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
      <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {activity && activity.length > 0 ? (
          activity.slice(0, 8).map((item, i) => <ActivityItem key={i} item={item} />)
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No recent activity</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  greeting: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  statIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  quickActions: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  quickAction: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  quickActionLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  activityCard: { marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  activityRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1 },
  activityIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 12 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  activityTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 20, textAlign: "center" },
});
