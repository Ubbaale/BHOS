import { Feather } from "@expo/vector-icons";
import { useListShifts } from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function statusColor(status: string, colors: ReturnType<typeof useColors>) {
  if (status === "completed") return colors.success;
  if (status === "in_progress") return colors.primary;
  if (status === "scheduled") return colors.warning;
  if (status === "cancelled" || status === "no_show") return colors.destructive;
  return colors.mutedForeground;
}

export default function ShiftsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: shifts, isLoading, refetch } = useListShifts();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={shifts ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16, paddingTop: 8 }}
          refreshing={false}
          onRefresh={refetch}
          scrollEnabled={(shifts?.length ?? 0) > 0}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="clock" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No shifts scheduled</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sColor = statusColor(item.status, colors);
            return (
              <View style={[styles.shiftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.shiftHeader}>
                  <Text style={[styles.staffName, { color: colors.foreground }]}>{item.staffName ?? "Staff"}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sColor + "15" }]}>
                    <Text style={[styles.statusText, { color: sColor }]}>
                      {item.status?.replace("_", " ")}
                    </Text>
                  </View>
                </View>
                <View style={styles.shiftTimes}>
                  <View style={styles.timeBlock}>
                    <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Start</Text>
                    <Text style={[styles.timeValue, { color: colors.foreground }]}>
                      {new Date(item.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
                  <View style={styles.timeBlock}>
                    <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>End</Text>
                    <Text style={[styles.timeValue, { color: colors.foreground }]}>
                      {new Date(item.endTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  shiftCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  shiftHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  staffName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  shiftTimes: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeBlock: { flex: 1 },
  timeLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  timeValue: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 12 },
});
