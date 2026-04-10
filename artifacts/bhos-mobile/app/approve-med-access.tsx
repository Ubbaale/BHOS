import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

export default function ApproveMedAccessScreen() {
  const params = useLocalSearchParams<{
    challengeId: string;
    responseSecret: string;
    patientName?: string;
    medicationName?: string;
  }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const [status, setStatus] = useState<"pending" | "approved" | "denied" | "error">("pending");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Vibration.vibrate([0, 200, 100, 200]);
  }, []);

  const handleRespond = async (action: "approve" | "deny") => {
    setLoading(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/med-access/challenge/${params.challengeId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action, responseSecret: params.responseSecret }),
      });

      if (!res.ok) {
        const data = await res.json();
        setStatus("error");
        setLoading(false);
        return;
      }

      setStatus(action === "approve" ? "approved" : "denied");
      Vibration.vibrate(action === "approve" ? 100 : [0, 100, 50, 100]);

      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        }
      }, 2000);
    } catch {
      setStatus("error");
    }
    setLoading(false);
  };

  if (status === "approved") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: "#ecfdf5" }]}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: "#10b981" }]}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={[styles.resultTitle, { color: "#065f46" }]}>Approved</Text>
          <Text style={styles.resultSubtitle}>Medication access has been granted on the workstation.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "denied") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: "#fef2f2" }]}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: "#ef4444" }]}>
            <Ionicons name="close" size={48} color="#fff" />
          </View>
          <Text style={[styles.resultTitle, { color: "#991b1b" }]}>Denied</Text>
          <Text style={styles.resultSubtitle}>Medication access has been denied.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "error") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: "#fefce8" }]}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: "#f59e0b" }]}>
            <Ionicons name="alert" size={48} color="#fff" />
          </View>
          <Text style={[styles.resultTitle, { color: "#92400e" }]}>Error</Text>
          <Text style={styles.resultSubtitle}>This request may have expired or already been handled.</Text>
          <Pressable style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : null}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.shieldIcon}>
            <Ionicons name="shield-checkmark" size={40} color="#0a7ea4" />
          </View>
          <Text style={styles.title}>Medication Access Request</Text>
          <Text style={styles.subtitle}>
            A workstation is requesting approval to access medications.
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Request Details</Text>
          {params.patientName && (
            <View style={styles.detailRow}>
              <Ionicons name="person" size={18} color="#64748b" />
              <Text style={styles.detailLabel}>Patient:</Text>
              <Text style={styles.detailValue}>{params.patientName}</Text>
            </View>
          )}
          {params.medicationName && (
            <View style={styles.detailRow}>
              <Ionicons name="medical" size={18} color="#64748b" />
              <Text style={styles.detailLabel}>Medication:</Text>
              <Text style={styles.detailValue}>{params.medicationName}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="time" size={18} color="#64748b" />
            <Text style={styles.detailLabel}>Requested:</Text>
            <Text style={styles.detailValue}>Just now</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="hourglass" size={18} color="#f59e0b" />
            <Text style={styles.detailLabel}>Expires in:</Text>
            <Text style={[styles.detailValue, { color: "#f59e0b" }]}>2 minutes</Text>
          </View>
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="information-circle" size={18} color="#0a7ea4" />
          <Text style={styles.warningText}>
            Only approve if you are present at the facility and initiated this request.
          </Text>
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.approveButton, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
            onPress={() => handleRespond("approve")}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.approveText}>Approve</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.denyButton, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
            onPress={() => handleRespond("deny")}
            disabled={loading}
          >
            <Ionicons name="close-circle" size={24} color="#ef4444" />
            <Text style={styles.denyText}>Deny</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 24 },
  shieldIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#e0f2fe", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8, lineHeight: 20 },
  detailsCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 16 },
  detailsTitle: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  detailLabel: { fontSize: 14, color: "#64748b", width: 90 },
  detailValue: { fontSize: 14, fontWeight: "600", color: "#0f172a", flex: 1 },
  warningBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: "#e0f2fe", borderRadius: 10, marginBottom: 24 },
  warningText: { fontSize: 13, color: "#0369a1", flex: 1, lineHeight: 18 },
  buttons: { gap: 12 },
  approveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#10b981", borderRadius: 14, paddingVertical: 16 },
  approveText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  denyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, borderWidth: 2, borderColor: "#fecaca" },
  denyText: { fontSize: 18, fontWeight: "700", color: "#ef4444" },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.5 },
  resultContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  resultIcon: { width: 88, height: 88, borderRadius: 44, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  resultTitle: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  resultSubtitle: { fontSize: 16, color: "#64748b", textAlign: "center", lineHeight: 22 },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: "#f59e0b", borderRadius: 10 },
  backButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
