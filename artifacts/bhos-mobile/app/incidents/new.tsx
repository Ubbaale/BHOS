import { Feather } from "@expo/vector-icons";
import { useCreateIncident, useListHomes, useListPatients, useListStaff } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const CATEGORIES = ["behavioral", "medical", "environmental", "medication", "elopement", "fall", "other"] as const;

export default function NewIncidentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: homes } = useListHomes();
  const { data: patients } = useListPatients();
  const { data: staff } = useListStaff();
  const createIncident = useCreateIncident();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("medium");
  const [category, setCategory] = useState<string>("behavioral");
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  const handleSubmit = () => {
    if (!title.trim() || !description.trim() || !selectedHomeId || !selectedStaffId) {
      Alert.alert("Missing Fields", "Please fill in title, description, select a home, and select who is reporting.");
      return;
    }

    createIncident.mutate(
      {
        data: {
          title,
          description,
          severity: severity as any,
          category: category as any,
          homeId: selectedHomeId,
          patientId: selectedPatientId,
          reportedBy: selectedStaffId,
          occurredAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Incident reported successfully.");
          router.back();
        },
        onError: () => {
          Alert.alert("Error", "Failed to report incident.");
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
        <Text style={[styles.label, { color: colors.foreground }]}>Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Brief incident title..."
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Description</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Describe what happened..."
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Severity</Text>
        <View style={styles.chipRow}>
          {SEVERITIES.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.chip,
                {
                  backgroundColor: severity === s ? colors.primary : colors.card,
                  borderColor: severity === s ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSeverity(s)}
            >
              <Text
                style={{
                  color: severity === s ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.chip,
                {
                  backgroundColor: category === c ? colors.primary : colors.card,
                  borderColor: category === c ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setCategory(c)}
            >
              <Text
                style={{
                  color: category === c ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Home</Text>
        <View style={styles.chipRow}>
          {(homes ?? []).map((h) => (
            <Pressable
              key={h.id}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedHomeId === h.id ? colors.primary : colors.card,
                  borderColor: selectedHomeId === h.id ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedHomeId(h.id)}
            >
              <Text
                style={{
                  color: selectedHomeId === h.id ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                }}
              >
                {h.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Reported By</Text>
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

        <Text style={[styles.label, { color: colors.foreground }]}>Patient (optional)</Text>
        <View style={styles.chipRow}>
          {(patients ?? [])
            .filter((p) => !selectedHomeId || p.homeId === selectedHomeId)
            .map((p) => (
              <Pressable
                key={p.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selectedPatientId === p.id ? colors.primary : colors.card,
                    borderColor: selectedPatientId === p.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedPatientId(selectedPatientId === p.id ? null : p.id)}
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

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: colors.destructive, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={createIncident.isPending}
        >
          <Feather name="alert-triangle" size={20} color="#fff" />
          <Text style={styles.submitText}>
            {createIncident.isPending ? "Submitting..." : "Report Incident"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 100 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 10, gap: 8, marginTop: 24 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
