import { Feather } from "@expo/vector-icons";
import { useListMedications, useListMedicationAdministrations, useGetEmar } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

type TabMode = "emar" | "all";

export default function MedicationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<TabMode>("emar");

  const { data: medications, isLoading: medsLoading, refetch: refetchMeds } = useListMedications();
  const { data: administrations, isLoading: adminLoading, refetch: refetchAdmin } = useListMedicationAdministrations();
  const { data: emarEntries, isLoading: emarLoading, refetch: refetchEmar } = useGetEmar();

  const isLoading = medsLoading || adminLoading || emarLoading;

  const onRefresh = () => {
    refetchMeds();
    refetchAdmin();
    refetchEmar();
  };

  const todayAdmins = (administrations ?? []).filter((a) => {
    const today = new Date().toDateString();
    return new Date(a.administeredAt).toDateString() === today;
  });

  const overdueEntries = (emarEntries ?? []).filter(e => e.status === "overdue");
  const pendingEntries = (emarEntries ?? []).filter(e => e.status === "pending");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: Platform.OS === "web" ? 67 + insets.top : 8, paddingHorizontal: 16 }}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="list" size={20} color={colors.primary} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{medications?.length ?? 0}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Active Meds</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={20} color={colors.success} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{todayAdmins.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Given Today</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: overdueEntries.length > 0 ? "#FEE2E2" : colors.card, borderColor: overdueEntries.length > 0 ? "#FECACA" : colors.border }]}>
            <Feather name="alert-triangle" size={20} color={overdueEntries.length > 0 ? "#DC2626" : colors.mutedForeground} />
            <Text style={[styles.summaryValue, { color: overdueEntries.length > 0 ? "#DC2626" : colors.foreground }]}>{overdueEntries.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Overdue</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.adminButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, flex: 1 },
            ]}
            onPress={() => router.push("/medications/administer")}
          >
            <Feather name="plus-circle" size={20} color={colors.primaryForeground} />
            <Text style={[styles.adminButtonText, { color: colors.primaryForeground }]}>Administer</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.scanButton,
              { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => router.push("/scanner")}
          >
            <Feather name="camera" size={20} color={colors.primary} />
            <Text style={[styles.scanButtonText, { color: colors.primary }]}>Scan</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setTab("emar")}
            style={[styles.tabBtn, tab === "emar" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, { color: tab === "emar" ? colors.primary : colors.mutedForeground }]}>eMAR Schedule</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("all")}
            style={[styles.tabBtn, tab === "all" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, { color: tab === "all" ? colors.primary : colors.mutedForeground }]}>All Medications</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tab === "emar" ? (
        <FlatList
          data={emarEntries ?? []}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16, paddingTop: 8 }}
          refreshing={false}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="check-circle" size={48} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No medications scheduled</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[
              styles.emarCard,
              {
                backgroundColor: item.status === "overdue" ? "#FEF2F2" : colors.card,
                borderColor: item.status === "overdue" ? "#FECACA" : item.status === "given" ? "#BBF7D0" : colors.border
              }
            ]}>
              <View style={styles.emarHeader}>
                <View style={styles.emarLeft}>
                  <View style={[
                    styles.medIcon,
                    { backgroundColor: item.controlledSubstance ? "#F3E8FF" : colors.primary + "15" }
                  ]}>
                    <Feather
                      name={item.controlledSubstance ? "shield" : "heart"}
                      size={18}
                      color={item.controlledSubstance ? "#7C3AED" : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.medName, { color: colors.foreground }]}>{item.medicationName}</Text>
                      {item.controlledSubstance && (
                        <View style={styles.controlledBadge}>
                          <Text style={styles.controlledText}>{item.deaSchedule || "C"}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.medDetail, { color: colors.mutedForeground }]}>
                      {item.dosage} · {item.route} · {item.patientName}
                    </Text>
                  </View>
                </View>
                <EmarStatusBadge status={item.status} />
              </View>
              <View style={styles.emarTimeRow}>
                <Feather name="clock" size={14} color={colors.mutedForeground} />
                <Text style={[styles.emarTime, { color: colors.mutedForeground }]}>
                  {formatTime(item.scheduledTime)} ({formatTime(item.windowStart)} – {formatTime(item.windowEnd)})
                </Text>
              </View>
              {item.administeredBy && (
                <View style={styles.emarTimeRow}>
                  <Feather name="user" size={14} color={colors.success} />
                  <Text style={[styles.emarTime, { color: colors.success }]}>
                    Given by {item.administeredBy}
                  </Text>
                  {(item as any).barcodeScanVerified && (
                    <View style={styles.barcodeVerifiedBadge}>
                      <Feather name="check-circle" size={10} color="#166534" />
                      <Text style={styles.barcodeVerifiedText}>Barcode</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={medications ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16, paddingTop: 8 }}
          refreshing={false}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="heart" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No medications found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.medCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[
                styles.medIcon,
                { backgroundColor: item.controlledSubstance ? "#F3E8FF" : colors.primary + "15" }
              ]}>
                <Feather
                  name={item.controlledSubstance ? "shield" : "heart"}
                  size={18}
                  color={item.controlledSubstance ? "#7C3AED" : colors.primary}
                />
              </View>
              <View style={styles.medInfo}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.medName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.controlledSubstance && (
                    <View style={styles.controlledBadge}>
                      <Text style={styles.controlledText}>{item.deaSchedule || "C"}</Text>
                    </View>
                  )}
                  {item.medicationType === "prn" && (
                    <View style={styles.prnBadge}>
                      <Text style={styles.prnText}>PRN</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.medDetail, { color: colors.mutedForeground }]}>
                  {item.dosage} · {item.frequency}
                </Text>
                {item.ndcCode && (
                  <View style={styles.ndcRow}>
                    <Feather name="bar-chart-2" size={10} color={colors.mutedForeground} style={{ transform: [{ rotate: "90deg" }] }} />
                    <Text style={[styles.ndcText, { color: colors.mutedForeground }]}>NDC: {item.ndcCode}</Text>
                  </View>
                )}
                {item.quantityOnHand != null && (
                  <Text style={[styles.medDetail, {
                    color: (item.refillThreshold && item.quantityOnHand <= item.refillThreshold) ? "#DC2626" : colors.mutedForeground
                  }]}>
                    Stock: {item.quantityOnHand} {item.refillThreshold && item.quantityOnHand <= item.refillThreshold ? "⚠️ Low" : ""}
                  </Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function EmarStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    given: { bg: "#DCFCE7", text: "#166534", label: "Given" },
    overdue: { bg: "#FEE2E2", text: "#DC2626", label: "Overdue" },
    pending: { bg: "#F1F5F9", text: "#64748B", label: "Pending" },
    missed: { bg: "#FEF3C7", text: "#92400E", label: "Missed" },
    refused: { bg: "#FFE4E6", text: "#9F1239", label: "Refused" },
    held: { bg: "#DBEAFE", text: "#1E40AF", label: "Held" },
  };
  const info = map[status] || { bg: "#F1F5F9", text: "#64748B", label: status };
  return (
    <View style={[styles.statusBadge, { backgroundColor: info.bg }]}>
      <Text style={[styles.statusText, { color: info.text }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  summaryValue: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 6 },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  adminButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  adminButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 6,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  scanButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabRow: { flexDirection: "row", gap: 0, marginBottom: 4 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  medCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  emarCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  emarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emarTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingLeft: 48,
  },
  emarTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  medIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 12 },
  medInfo: { flex: 1 },
  medName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  medDetail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 12 },
  controlledBadge: {
    backgroundColor: "#F3E8FF",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  controlledText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
  prnBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  prnText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#92400E" },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  ndcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  ndcText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  barcodeVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#DCFCE7",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  barcodeVerifiedText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#166534" },
});
