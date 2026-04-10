import { Feather } from "@expo/vector-icons";
import {
  useCreateMedicationRefusal,
  useListMedicationRefusals,
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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const REFUSAL_REASONS = [
  "Patient refused — no reason given",
  "Patient refused — side effects concern",
  "Patient refused — doesn't feel medication is needed",
  "Patient refused — religious/cultural reasons",
  "Patient refused — taste/difficulty swallowing",
  "Patient asleep — unable to wake",
  "Patient away from facility",
  "Patient vomiting — unable to take oral medication",
];

export default function RefusalsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: patients } = useListPatients();
  const { data: medications } = useListMedications();
  const { data: staff } = useListStaff();
  const { data: recentRefusals, refetch } = useListMedicationRefusals();
  const createRefusal = useCreateMedicationRefusal();

  const [patientId, setPatientId] = useState<number | null>(null);
  const [medicationId, setMedicationId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [physicianNotified, setPhysicianNotified] = useState(false);
  const [physicianName, setPhysicianName] = useState("");
  const [followUpAction, setFollowUpAction] = useState("");
  const [showForm, setShowForm] = useState(true);

  const patientMeds = (medications ?? []).filter(m => m.patientId === patientId && m.active);
  const selectedPatient = patients?.find(p => p.id === patientId);

  const canSubmit = patientId && medicationId && staffId && reason.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    createRefusal.mutate(
      {
        data: {
          patientId: patientId!,
          medicationId: medicationId!,
          staffId: staffId!,
          reason: reason.trim(),
          physicianNotified,
          physicianName: physicianNotified ? (physicianName || (selectedPatient as any)?.primaryPhysician || undefined) : undefined,
          followUpAction: followUpAction || undefined,
        },
      },
      {
        onSuccess: () => {
          Alert.alert(
            "Recorded",
            physicianNotified
              ? "Refusal recorded. Physician has been notified."
              : "Refusal recorded. Remember to notify the physician.",
          );
          setReason("");
          setFollowUpAction("");
          setPhysicianNotified(false);
          refetch();
          setShowForm(false);
        },
        onError: () => Alert.alert("Error", "Failed to record refusal."),
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
            <Text style={[styles.title, { color: colors.foreground }]}>Medication Refusal</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Document patient refusal and physician notification</Text>
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
                <Text style={[styles.label, { color: colors.foreground }]}>Medication Refused</Text>
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

            <Text style={[styles.label, { color: colors.foreground }]}>Reason for Refusal</Text>
            {REFUSAL_REASONS.map(r => (
              <Pressable
                key={r}
                style={[styles.reasonOption, {
                  backgroundColor: reason === r ? "#FEF2F2" : colors.card,
                  borderColor: reason === r ? "#FECACA" : colors.border,
                }]}
                onPress={() => setReason(r)}
              >
                <Feather
                  name={reason === r ? "check-circle" : "circle"}
                  size={18}
                  color={reason === r ? "#dc2626" : colors.mutedForeground}
                />
                <Text style={[styles.reasonText, { color: reason === r ? "#991b1b" : colors.foreground }]}>{r}</Text>
              </Pressable>
            ))}
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]}
              placeholder="Or type a custom reason..."
              placeholderTextColor={colors.mutedForeground}
              value={REFUSAL_REASONS.includes(reason) ? "" : reason}
              onChangeText={(t) => setReason(t)}
            />

            <View style={[styles.notifyRow, { backgroundColor: physicianNotified ? "#F0FDF4" : "#FEF2F2", borderColor: physicianNotified ? "#BBF7D0" : "#FECACA" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifyLabel, { color: physicianNotified ? "#166534" : "#991b1b" }]}>Physician Notified</Text>
                <Text style={[styles.notifyHint, { color: physicianNotified ? "#16a34a" : "#dc2626" }]}>
                  {physicianNotified ? "Physician has been informed" : "Required per facility protocol"}
                </Text>
              </View>
              <Switch
                value={physicianNotified}
                onValueChange={setPhysicianNotified}
                trackColor={{ false: "#FECACA", true: "#86EFAC" }}
                thumbColor={physicianNotified ? "#16a34a" : "#dc2626"}
              />
            </View>

            {physicianNotified && (
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                placeholder={`Physician name (${(selectedPatient as any)?.primaryPhysician || 'e.g., Dr. Smith'})`}
                placeholderTextColor={colors.mutedForeground}
                value={physicianName}
                onChangeText={setPhysicianName}
              />
            )}

            <Text style={[styles.label, { color: colors.foreground }]}>Recorded By</Text>
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

            <Text style={[styles.label, { color: colors.foreground }]}>Follow-up Action (optional)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g., Will re-attempt at next scheduled time..."
              placeholderTextColor={colors.mutedForeground}
              value={followUpAction}
              onChangeText={setFollowUpAction}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: canSubmit ? "#dc2626" : "#94A3B8", opacity: pressed ? 0.8 : 1 }]}
              onPress={handleSubmit}
              disabled={!canSubmit || createRefusal.isPending}
            >
              <Feather name="x-circle" size={18} color="#fff" />
              <Text style={styles.submitText}>{createRefusal.isPending ? "Recording..." : "Record Refusal"}</Text>
            </Pressable>
          </>
        )}

        {(recentRefusals ?? []).length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT REFUSALS</Text>
            {(recentRefusals ?? []).slice(0, 10).map((r: any) => (
              <View key={r.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.historyMed, { color: colors.foreground }]}>{r.medicationName}</Text>
                  <View style={[styles.notifyBadge, { backgroundColor: r.physicianNotified ? "#DCFCE7" : "#FEE2E2" }]}>
                    <Text style={{ color: r.physicianNotified ? "#16a34a" : "#dc2626", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                      {r.physicianNotified ? "MD Notified" : "MD Not Notified"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.historyPatient, { color: colors.mutedForeground }]}>
                  Patient: {r.patientName} · Staff: {r.staffName}
                </Text>
                <Text style={[styles.historyReason, { color: colors.foreground }]}>{r.reason}</Text>
                {r.followUpAction && (
                  <Text style={[styles.historyFollowup, { color: colors.mutedForeground }]}>Follow-up: {r.followUpAction}</Text>
                )}
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
  reasonOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  reasonText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 80 },
  notifyRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 16 },
  notifyLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  notifyHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 10, gap: 8, marginTop: 20 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 10 },
  historyCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyMed: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  historyPatient: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  historyReason: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 6 },
  historyFollowup: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, fontStyle: "italic" },
});
