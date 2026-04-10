import { Feather } from "@expo/vector-icons";
import { useGetPatient, useListMedications, useListDailyLogs } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function InfoRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function PatientDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: patient, isLoading } = useGetPatient(Number(id));
  const { data: medications } = useListMedications({ patientId: Number(id) });
  const { data: dailyLogs } = useListDailyLogs({ patientId: Number(id) });

  if (isLoading || !patient) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {patient.firstName[0]}{patient.lastName[0]}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>
          {patient.firstName} {patient.lastName}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: patient.status === "active" ? colors.success + "15" : colors.warning + "15" }]}>
          <Text style={[styles.statusText, { color: patient.status === "active" ? colors.success : colors.warning }]}>
            {patient.status}
          </Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
        <InfoRow icon="calendar" label="DOB" value={new Date(patient.dateOfBirth).toLocaleDateString()} />
        <InfoRow icon="user" label="Gender" value={patient.gender} />
        <InfoRow icon="home" label="Home" value={patient.homeName ?? "Unassigned"} />
        <InfoRow icon="log-in" label="Admitted" value={new Date(patient.admissionDate).toLocaleDateString()} />
        {patient.diagnosis && <InfoRow icon="clipboard" label="Diagnosis" value={patient.diagnosis} />}
        {patient.emergencyContact && <InfoRow icon="phone" label="Emergency" value={`${patient.emergencyContact} ${patient.emergencyPhone ?? ""}`} />}
      </View>

      {patient.notes && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
          <Text style={[styles.notesText, { color: colors.foreground }]}>{patient.notes}</Text>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Medications ({medications?.length ?? 0})
        </Text>
        {(medications ?? []).length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No medications assigned</Text>
        ) : (
          (medications ?? []).map((med) => (
            <View key={med.id} style={[styles.medRow, { borderBottomColor: colors.border }]}>
              <Feather name="heart" size={16} color={colors.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.medName, { color: colors.foreground }]}>{med.name}</Text>
                <Text style={[styles.medDetail, { color: colors.mutedForeground }]}>{med.dosage} · {med.frequency}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Recent Logs ({dailyLogs?.length ?? 0})
        </Text>
        {(dailyLogs ?? []).length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No daily logs recorded</Text>
        ) : (
          (dailyLogs ?? []).slice(0, 5).map((log) => (
            <View key={log.id} style={[styles.logRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.logDate, { color: colors.mutedForeground }]}>
                {new Date(log.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.logMood, { color: colors.foreground }]}>Mood: {log.mood}</Text>
              <Text style={[styles.logNotes, { color: colors.mutedForeground }]} numberOfLines={2}>
                {log.notes}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", paddingVertical: 24, borderBottomWidth: 1, marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarText: { fontSize: 24, fontFamily: "Inter_700Bold" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  statusText: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  section: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginLeft: 10, width: 90 },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  medRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  medName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  medDetail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  logRow: { paddingVertical: 10, borderBottomWidth: 1 },
  logDate: { fontSize: 12, fontFamily: "Inter_500Medium" },
  logMood: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  logNotes: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
