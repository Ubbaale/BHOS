import { Feather } from "@expo/vector-icons";
import { useListClaims, useListPayments, useGetBillingSummary } from "@workspace/api-client-react";
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

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function SummaryCard({ label, value, icon, color, colors }: any) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.summaryIcon, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const config: Record<string, { bg: string; fg: string; label: string }> = {
    draft: { bg: colors.border, fg: colors.mutedForeground, label: "Draft" },
    ready: { bg: "#e0f2fe", fg: "#0284c7", label: "Ready" },
    submitted: { bg: "#dbeafe", fg: "#2563eb", label: "Submitted" },
    accepted: { bg: "#dcfce7", fg: "#16a34a", label: "Accepted" },
    paid: { bg: "#dcfce7", fg: "#16a34a", label: "Paid" },
    denied: { bg: "#fee2e2", fg: "#dc2626", label: "Denied" },
    appealed: { bg: "#fef3c7", fg: "#d97706", label: "Appealed" },
    void: { bg: colors.border, fg: colors.mutedForeground, label: "Void" },
  };
  const c = config[status] || config.draft;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

function ClaimCard({ claim, colors }: { claim: any; colors: any }) {
  const serviceStart = new Date(claim.serviceStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const serviceEnd = new Date(claim.serviceEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <View style={[styles.claimCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.claimHeader}>
        <View>
          <Text style={[styles.claimNumber, { color: colors.primary }]}>{claim.claimNumber || `CLM-${claim.id}`}</Text>
          <Text style={[styles.claimPatient, { color: colors.foreground }]}>{claim.patientName}</Text>
        </View>
        <StatusBadge status={claim.status} colors={colors} />
      </View>
      <View style={[styles.claimDivider, { backgroundColor: colors.border }]} />
      <View style={styles.claimDetails}>
        <View style={styles.claimDetail}>
          <Text style={[styles.claimDetailLabel, { color: colors.mutedForeground }]}>Payer</Text>
          <Text style={[styles.claimDetailValue, { color: colors.foreground }]} numberOfLines={1}>{claim.payerName}</Text>
        </View>
        <View style={styles.claimDetail}>
          <Text style={[styles.claimDetailLabel, { color: colors.mutedForeground }]}>Period</Text>
          <Text style={[styles.claimDetailValue, { color: colors.foreground }]}>{serviceStart} — {serviceEnd}</Text>
        </View>
      </View>
      <View style={styles.claimAmounts}>
        <View style={styles.claimAmount}>
          <Text style={[styles.claimAmountLabel, { color: colors.mutedForeground }]}>Charged</Text>
          <Text style={[styles.claimAmountValue, { color: colors.foreground }]}>{formatCurrency(claim.totalCharged)}</Text>
        </View>
        <View style={styles.claimAmount}>
          <Text style={[styles.claimAmountLabel, { color: colors.mutedForeground }]}>Paid</Text>
          <Text style={[styles.claimAmountValue, { color: colors.success || "#16a34a" }]}>{formatCurrency(claim.totalPaid)}</Text>
        </View>
        {claim.primaryDiagnosisCode && (
          <View style={styles.claimAmount}>
            <Text style={[styles.claimAmountLabel, { color: colors.mutedForeground }]}>Dx</Text>
            <Text style={[styles.claimAmountValue, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{claim.primaryDiagnosisCode}</Text>
          </View>
        )}
      </View>
      {claim.denialReason && (
        <View style={[styles.denialBox, { backgroundColor: "#fee2e2" }]}>
          <Feather name="alert-circle" size={14} color="#dc2626" />
          <Text style={[styles.denialText, { color: "#dc2626" }]} numberOfLines={2}>{claim.denialReason}</Text>
        </View>
      )}
    </View>
  );
}

export default function BillingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useGetBillingSummary();
  const { data: claims, isLoading: loadingClaims, refetch: refetchClaims } = useListClaims();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchClaims()]);
    setRefreshing(false);
  };

  const loading = loadingSummary || loadingClaims;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: Platform.OS === "web" ? 10 : 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Charged" value={formatCurrency(summary?.totalCharged)} icon="file-text" color="#2563eb" colors={colors} />
            <SummaryCard label="Collected" value={formatCurrency(summary?.totalPaid)} icon="dollar-sign" color="#16a34a" colors={colors} />
            <SummaryCard label="Outstanding" value={formatCurrency(Math.max(0, summary?.totalOutstanding || 0))} icon="clock" color="#d97706" colors={colors} />
            <SummaryCard label="Denied" value={formatCurrency(summary?.totalDenied)} icon="x-circle" color="#dc2626" colors={colors} />
          </View>

          {summary?.revenueByPayer && summary.revenueByPayer.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>REVENUE BY PAYER</Text>
              {summary.revenueByPayer.filter((p: any) => p.totalCharged > 0).map((payer: any) => (
                <View key={payer.payerName} style={[styles.payerRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.payerInfo}>
                    <Text style={[styles.payerName, { color: colors.foreground }]} numberOfLines={1}>{payer.payerName}</Text>
                    <Text style={[styles.payerClaims, { color: colors.mutedForeground }]}>{payer.claimCount} claims</Text>
                  </View>
                  <View style={styles.payerAmounts}>
                    <Text style={[styles.payerCharged, { color: colors.foreground }]}>{formatCurrency(payer.totalCharged)}</Text>
                    <Text style={[styles.payerPaid, { color: colors.success || "#16a34a" }]}>{formatCurrency(payer.totalPaid)} paid</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT CLAIMS</Text>
            {claims?.map((claim: any) => (
              <ClaimCard key={claim.id} claim={claim} colors={colors} />
            ))}
            {(!claims || claims.length === 0) && (
              <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No claims yet</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginTop: 8 },
  summaryCard: { flex: 1, minWidth: "45%", padding: 14, borderRadius: 12, borderWidth: 1 },
  summaryIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 10, paddingLeft: 4 },
  claimCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  claimHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  claimNumber: { fontSize: 12, fontFamily: "Inter_500Medium" },
  claimPatient: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  claimDivider: { height: 1, marginVertical: 10 },
  claimDetails: { flexDirection: "row", gap: 16 },
  claimDetail: { flex: 1 },
  claimDetailLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  claimDetailValue: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  claimAmounts: { flexDirection: "row", marginTop: 10, gap: 16 },
  claimAmount: {},
  claimAmountLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  claimAmountValue: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  denialBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, marginTop: 10 },
  denialText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  payerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  payerInfo: { flex: 1 },
  payerName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  payerClaims: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  payerAmounts: { alignItems: "flex-end" },
  payerCharged: { fontSize: 14, fontFamily: "Inter_700Bold" },
  payerPaid: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyState: { alignItems: "center", padding: 32, borderRadius: 12, borderWidth: 1 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
});
