import { Feather } from "@expo/vector-icons";
import { useGetIncident } from "@workspace/api-client-react";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

function severityColor(severity: string, colors: ReturnType<typeof useColors>) {
  if (severity === "critical") return "#dc2626";
  if (severity === "high") return colors.destructive;
  if (severity === "medium") return colors.warning;
  return colors.success;
}

export default function IncidentDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: incident, isLoading } = useGetIncident(Number(id));

  if (isLoading || !incident) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const sevColor = severityColor(incident.severity, colors);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.severityBadge, { backgroundColor: sevColor + "15" }]}>
          <Feather name="alert-triangle" size={16} color={sevColor} />
          <Text style={[styles.severityText, { color: sevColor }]}>{incident.severity}</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{incident.title}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {new Date(incident.occurredAt).toLocaleString()} · {incident.status}
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Description</Text>
        <Text style={[styles.bodyText, { color: colors.foreground }]}>{incident.description}</Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
        <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Status</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>{incident.status}</Text>
        </View>
        <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Occurred</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>
            {new Date(incident.occurredAt).toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Reported</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>
            {new Date(incident.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, borderBottomWidth: 1, alignItems: "flex-start" },
  severityBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  severityText: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  meta: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6 },
  section: { marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  bodyText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  detailLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
