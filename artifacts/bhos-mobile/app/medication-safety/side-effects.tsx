import { Feather } from "@expo/vector-icons";
import {
  useCreateMedicationSideEffect,
  useListMedicationSideEffects,
  useListMedications,
  useListPatients,
  useListStaff,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const SEVERITY_OPTIONS = [
  { key: "mild", label: "Mild", color: "#16a34a", bg: "#F0FDF4" },
  { key: "moderate", label: "Moderate", color: "#d97706", bg: "#FEF3C7" },
  { key: "severe", label: "Severe", color: "#dc2626", bg: "#FEE2E2" },
];

const COMMON_SIDE_EFFECTS = [
  "Nausea", "Dizziness", "Headache", "Drowsiness", "Rash",
  "Constipation", "Dry mouth", "Fatigue", "Insomnia", "Loss of appetite",
];

export default function SideEffectsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: patients } = useListPatients();
  const { data: medications } = useListMedications();
  const { data: staff } = useListStaff();
  const { data: recentEffects, refetch } = useListMedicationSideEffects();
  const createSideEffect = useCreateMedicationSideEffect();

  const [patientId, setPatientId] = useState<number | null>(null);
  const [medicationId, setMedicationId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [sideEffect, setSideEffect] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(true);

  const patientMeds = (medications ?? []).filter(m => m.patientId === patientId && m.active);

  const canSubmit = patientId && medicationId && staffId && sideEffect.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    createSideEffect.mutate(
      {
        data: {
          patientId: patientId!,
          medicationId: medicationId!,
          staffId: staffId!,
          sideEffect: sideEffect.trim(),
          severity: severity as any,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          Alert.alert("Reported", "Side effect has been recorded and logged.");
          setSideEffect("");
          setNotes("");
          setSeverity("mild");
          refetch();
          setShowForm(false);
        },
        onError: () => Alert.alert("Error", "Failed to report side effect."),
      }
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Side Effect Report</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Document adverse reactions</Text>
          </View>
          <Pressable
            style={[styles.toggleBtn, { backgroundColor: showForm ? colors.primary : colors.card, borderColor: colors.border }]}
            onPress={() => setShowForm(!showForm)}
          >
            <Feather name={showForm ? "minus" : "plus"} size={16} color={showForm ? "#fff" : colors.foreground} />
          </Pressable>
        </View>

        {showForm && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Patient</Text>
            <View style={styles.chipRow}>
              {(patients ?? []).map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, { backgroundColor: patientId === p.id ? colors.primary : colors.card, borderColor: patientId === p.id ? colors.primary : colors.border }]}
                  onPress={() => { setPatientId(p.id); setMedicationId(null); }}
                >
                  <Text style={{ color: patientId === p.id ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {p.firstName} {p.lastName}
                  </Text>
                </Pressable>
              ))}
            </View>

            {patientId && (
              <>
                <Text style={[styles.label, { color: colors.foreground }]}>Medication</Text>
                <View style={styles.chipRow}>
                  {patientMeds.map(m => (
                    <Pressable
                      key={m.id}
                      style={[styles.chip, { backgroundColor: medicationId === m.id ? colors.primary : colors.card, borderColor: medicationId === m.id ? colors.primary : colors.border }]}
                      onPress={() => setMedicationId(m.id)}
                    >
                      <Text style={{ color: medicationId === m.id ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                        {m.name} ({m.dosage})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.label, { color: colors.foreground }]}>Side Effect</Text>
            <View style={styles.chipRow}>
              {COMMON_SIDE_EFFECTS.map(se => (
                <Pressable
                  key={se}
                  style={[styles.chip, { backgroundColor: sideEffect === se ? "#2563eb" : colors.card, borderColor: sideEffect === se ? "#2563eb" : colors.border }]}
                  onPress={() => setSideEffect(se)}
                >
                  <Text style={{ color: sideEffect === se ? "#fff" : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                    {se}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Or type a custom side effect..."
              placeholderTextColor={colors.mutedForeground}
              value={sideEffect}
              onChangeText={setSideEffect}
            />

            <Text style={[styles.label, { color: colors.foreground }]}>Severity</Text>
            <View style={styles.chipRow}>
              {SEVERITY_OPTIONS.map(s => (
                <Pressable
                  key={s.key}
                  style={[styles.severityChip, { backgroundColor: severity === s.key ? s.bg : colors.card, borderColor: severity === s.key ? s.color : colors.border }]}
                  onPress={() => setSeverity(s.key)}
                >
                  <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                  <Text style={{ color: severity === s.key ? s.color : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Reported By</Text>
            <View style={styles.chipRow}>
              {(staff ?? []).map(s => (
                <Pressable
                  key={s.id}
                  style={[styles.chip, { backgroundColor: staffId === s.id ? colors.primary : colors.card, borderColor: staffId === s.id ? colors.primary : colors.border }]}
                  onPress={() => setStaffId(s.id)}
                >
                  <Text style={{ color: staffId === s.id ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {s.firstName} {s.lastName}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Additional observations..."
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: canSubmit ? "#dc2626" : "#94A3B8", opacity: pressed ? 0.8 : 1 }]}
              onPress={handleSubmit}
              disabled={!canSubmit || createSideEffect.isPending}
            >
              <Feather name="alert-circle" size={18} color="#fff" />
              <Text style={styles.submitText}>{createSideEffect.isPending ? "Reporting..." : "Report Side Effect"}</Text>
            </Pressable>
          </>
        )}

        {(recentEffects ?? []).length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT REPORTS</Text>
            {(recentEffects ?? []).slice(0, 10).map((se: any) => (
              <View key={se.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.historyEffect, { color: colors.foreground }]}>{se.sideEffect}</Text>
                  <View style={[styles.severityTag, {
                    backgroundColor: se.severity === "severe" ? "#FEE2E2" : se.severity === "moderate" ? "#FEF3C7" : "#F0FDF4"
                  }]}>
                    <Text style={[styles.severityTagText, {
                      color: se.severity === "severe" ? "#dc2626" : se.severity === "moderate" ? "#d97706" : "#16a34a"
                    }]}>{se.severity}</Text>
                  </View>
                </View>
                <Text style={[styles.historyDetail, { color: colors.mutedForeground }]}>
                  {se.medicationName} · {se.patientName} · {se.staffName}
                </Text>
                {se.notes && <Text style={[styles.historyNotes, { color: colors.mutedForeground }]}>{se.notes}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  toggleBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  severityChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, flex: 1 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 8 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 80, marginTop: 4 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 10, gap: 8, marginTop: 20 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 10 },
  historyCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyEffect: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  severityTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  historyDetail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  historyNotes: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, fontStyle: "italic" },
});
