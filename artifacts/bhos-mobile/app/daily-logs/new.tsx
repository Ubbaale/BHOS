import { Feather } from "@expo/vector-icons";
import { useCreateDailyLog, useListPatients, useListStaff } from "@workspace/api-client-react";
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

const MOODS = ["poor", "fair", "good", "excellent", "agitated"] as const;
const APPETITES = ["poor", "fair", "good", "refused"] as const;
const SLEEPS = ["poor", "fair", "good", "none"] as const;

export default function NewDailyLogScreen() {
  const colors = useColors();
  const router = useRouter();

  const { data: patients } = useListPatients();
  const { data: staff } = useListStaff();
  const createLog = useCreateDailyLog();

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [mood, setMood] = useState("good");
  const [appetite, setAppetite] = useState("good");
  const [sleep, setSleep] = useState("good");
  const [activities, setActivities] = useState("");
  const [behaviors, setBehaviors] = useState("");
  const [notes, setNotes] = useState("");

  const selectedPatient = (patients ?? []).find((p) => p.id === selectedPatientId);

  const handleSubmit = () => {
    if (!selectedPatientId || !selectedStaffId) {
      Alert.alert("Missing Fields", "Please select a patient and staff member.");
      return;
    }

    createLog.mutate(
      {
        data: {
          patientId: selectedPatientId,
          staffId: selectedStaffId,
          homeId: selectedPatient?.homeId ?? 0,
          date: new Date().toISOString(),
          mood: mood as any,
          appetite: appetite as any,
          sleep: sleep as any,
          activities: activities || null,
          behaviors: behaviors || null,
          notes: notes || null,
        },
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Daily log created successfully.");
          router.back();
        },
        onError: () => {
          Alert.alert("Error", "Failed to create daily log.");
        },
      }
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={[styles.label, { color: colors.foreground }]}>Patient</Text>
        <View style={styles.chipRow}>
          {(patients ?? []).map((p) => (
            <Pressable
              key={p.id}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedPatientId === p.id ? colors.primary : colors.card,
                  borderColor: selectedPatientId === p.id ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedPatientId(p.id)}
            >
              <Text
                style={{
                  color: selectedPatientId === p.id ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                }}
              >
                {p.firstName} {p.lastName}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Staff</Text>
        <View style={styles.chipRow}>
          {(staff ?? []).map((s) => (
            <Pressable
              key={s.id}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedStaffId === s.id ? colors.primary : colors.card,
                  borderColor: selectedStaffId === s.id ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedStaffId(s.id)}
            >
              <Text
                style={{
                  color: selectedStaffId === s.id ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                }}
              >
                {s.firstName} {s.lastName}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Mood</Text>
        <View style={styles.chipRow}>
          {MOODS.map((m) => (
            <Pressable
              key={m}
              style={[
                styles.chip,
                {
                  backgroundColor: mood === m ? colors.primary : colors.card,
                  borderColor: mood === m ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setMood(m)}
            >
              <Text
                style={{
                  color: mood === m ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  textTransform: "capitalize",
                }}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Appetite</Text>
        <View style={styles.chipRow}>
          {APPETITES.map((a) => (
            <Pressable
              key={a}
              style={[
                styles.chip,
                {
                  backgroundColor: appetite === a ? colors.primary : colors.card,
                  borderColor: appetite === a ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setAppetite(a)}
            >
              <Text
                style={{
                  color: appetite === a ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  textTransform: "capitalize",
                }}
              >
                {a}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Sleep</Text>
        <View style={styles.chipRow}>
          {SLEEPS.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.chip,
                {
                  backgroundColor: sleep === s ? colors.primary : colors.card,
                  borderColor: sleep === s ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSleep(s)}
            >
              <Text
                style={{
                  color: sleep === s ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  textTransform: "capitalize",
                }}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Activities</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Activities participated in..."
          placeholderTextColor={colors.mutedForeground}
          value={activities}
          onChangeText={setActivities}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Behaviors</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Notable behaviors observed..."
          placeholderTextColor={colors.mutedForeground}
          value={behaviors}
          onChangeText={setBehaviors}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Notes</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Additional notes..."
          placeholderTextColor={colors.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={createLog.isPending}
        >
          <Feather name="check" size={20} color={colors.primaryForeground} />
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
            {createLog.isPending ? "Saving..." : "Save Daily Log"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 80 },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 10, gap: 8, marginTop: 24 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
