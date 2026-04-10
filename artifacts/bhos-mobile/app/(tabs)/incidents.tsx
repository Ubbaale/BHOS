import { Feather } from "@expo/vector-icons";
import { useListIncidents } from "@workspace/api-client-react";
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

function severityColor(severity: string, colors: ReturnType<typeof useColors>) {
  if (severity === "critical") return "#dc2626";
  if (severity === "high") return colors.destructive;
  if (severity === "medium") return colors.warning;
  return colors.success;
}

export default function IncidentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: incidents, isLoading, refetch } = useListIncidents();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: Platform.OS === "web" ? 67 + insets.top : 8, paddingHorizontal: 16 }}>
        <Pressable
          style={({ pressed }) => [
            styles.reportButton,
            { backgroundColor: colors.destructive, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => router.push("/incidents/new")}
        >
          <Feather name="alert-triangle" size={20} color="#fff" />
          <Text style={styles.reportButtonText}>Report Incident</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={incidents ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0), paddingHorizontal: 16, paddingTop: 8 }}
          refreshing={false}
          onRefresh={refetch}
          scrollEnabled={(incidents?.length ?? 0) > 0}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="shield" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No incidents reported</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.incidentCard,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => router.push(`/incidents/${item.id}`)}
            >
              <View style={styles.incidentHeader}>
                <View style={[styles.severityDot, { backgroundColor: severityColor(item.severity, colors) }]} />
                <Text style={[styles.incidentTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <Text style={[styles.incidentDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={styles.incidentFooter}>
                <View style={[styles.severityBadge, { backgroundColor: severityColor(item.severity, colors) + "15" }]}>
                  <Text style={[styles.severityText, { color: severityColor(item.severity, colors) }]}>
                    {item.severity}
                  </Text>
                </View>
                <Text style={[styles.incidentTime, { color: colors.mutedForeground }]}>
                  {new Date(item.occurredAt).toLocaleDateString()}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginBottom: 8,
  },
  reportButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  incidentCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  incidentHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  incidentTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1 },
  incidentDesc: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  incidentFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  severityText: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  incidentTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 12 },
});
