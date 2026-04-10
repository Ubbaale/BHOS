import { Feather } from "@expo/vector-icons";
import { useListDailyLogs } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function moodColor(mood: string, colors: ReturnType<typeof useColors>) {
  if (mood === "good" || mood === "excellent") return colors.success;
  if (mood === "fair") return colors.warning;
  return colors.destructive;
}

export default function DailyLogsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: logs, isLoading, refetch } = useListDailyLogs();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: 8, paddingHorizontal: 16 }}>
        <Pressable
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => router.push("/daily-logs/new")}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
          <Text style={[styles.newButtonText, { color: colors.primaryForeground }]}>New Daily Log</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={logs ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16, paddingTop: 8 }}
          refreshing={false}
          onRefresh={refetch}
          scrollEnabled={(logs?.length ?? 0) > 0}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="file-text" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No daily logs yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <Text style={[styles.logDate, { color: colors.foreground }]}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
                <View style={[styles.moodBadge, { backgroundColor: moodColor(item.mood, colors) + "15" }]}>
                  <Text style={[styles.moodText, { color: moodColor(item.mood, colors) }]}>{item.mood}</Text>
                </View>
              </View>
              <Text style={[styles.logNotes, { color: colors.mutedForeground }]} numberOfLines={3}>
                {item.notes}
              </Text>
              <View style={styles.logFooter}>
                <Text style={[styles.logMeta, { color: colors.mutedForeground }]}>
                  Sleep: {item.sleep ?? "N/A"} · Appetite: {item.appetite ?? "N/A"}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  newButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 10, gap: 8 },
  newButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  logCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  logDate: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  moodBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  moodText: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  logNotes: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  logFooter: { flexDirection: "row" },
  logMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 12 },
});
