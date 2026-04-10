import { Feather } from "@expo/vector-icons";
import {
  useGetPendingPrnFollowups,
  useUpdatePrnFollowup,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
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

const EFFECTIVENESS_LABELS: Record<number, string> = {
  1: "No relief",
  2: "Minimal relief",
  3: "Slight improvement",
  4: "Some relief",
  5: "Moderate relief",
  6: "Noticeable improvement",
  7: "Good relief",
  8: "Significant improvement",
  9: "Excellent relief",
  10: "Complete resolution",
};

function FollowupCard({ item, colors, onComplete }: { item: any; colors: any; onComplete: (id: number) => void }) {
  const [score, setScore] = useState(5);
  const [effectiveness, setEffectiveness] = useState("");
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);
  const updateFollowup = useUpdatePrnFollowup();

  const minutesRemaining = item.minutesRemaining ?? 0;
  const isOverdue = minutesRemaining <= 0;

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = minutesRemaining - elapsed;

  const handleSubmit = () => {
    updateFollowup.mutate(
      {
        id: item.id,
        data: {
          prnEffectivenessScore: score,
          prnEffectiveness: effectiveness || EFFECTIVENESS_LABELS[score],
          prnFollowUpNotes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          Alert.alert("Recorded", `PRN effectiveness recorded: ${score}/10`);
          onComplete(item.id);
        },
        onError: () => Alert.alert("Error", "Failed to record follow-up."),
      }
    );
  };

  return (
    <View style={[styles.card, {
      backgroundColor: colors.card,
      borderColor: isOverdue ? "#FECACA" : colors.border,
      borderWidth: isOverdue ? 2 : 1,
    }]}>
      <Pressable style={styles.cardHeader} onPress={() => setExpanded(!expanded)}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.medName, { color: colors.foreground }]}>{item.medicationName}</Text>
          <Text style={[styles.patientName, { color: colors.mutedForeground }]}>
            Patient: {item.patientName} · Staff: {item.staffName}
          </Text>
          {item.prnReason && (
            <Text style={[styles.prnReason, { color: colors.mutedForeground }]}>
              Reason: {item.prnReason}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.timerBadge, {
            backgroundColor: currentMinutes <= 0 ? "#FEE2E2" : currentMinutes <= 10 ? "#FEF3C7" : "#EFF6FF"
          }]}>
            <Feather name="clock" size={14} color={currentMinutes <= 0 ? "#dc2626" : currentMinutes <= 10 ? "#d97706" : "#2563eb"} />
            <Text style={[styles.timerText, {
              color: currentMinutes <= 0 ? "#dc2626" : currentMinutes <= 10 ? "#d97706" : "#2563eb"
            }]}>
              {currentMinutes <= 0 ? "OVERDUE" : `${currentMinutes}m remaining`}
            </Text>
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>

      {expanded && (
        <View style={[styles.assessSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.assessTitle, { color: colors.foreground }]}>Effectiveness Assessment</Text>

          <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>
            Score: {score}/10 — {EFFECTIVENESS_LABELS[score]}
          </Text>
          <View style={styles.scoreRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <Pressable
                key={n}
                style={[styles.scoreDot, {
                  backgroundColor: n <= score
                    ? n <= 3 ? "#dc2626" : n <= 6 ? "#d97706" : "#16a34a"
                    : colors.border,
                }]}
                onPress={() => setScore(n)}
              >
                <Text style={[styles.scoreNum, { color: n <= score ? "#fff" : colors.mutedForeground }]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Effectiveness notes (e.g., pain reduced from 7 to 3)..."
            placeholderTextColor={colors.mutedForeground}
            value={effectiveness}
            onChangeText={setEffectiveness}
          />

          <TextInput
            style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Additional observations..."
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            style={({ pressed }) => [styles.submitBtn, { backgroundColor: "#16a34a", opacity: pressed ? 0.8 : 1 }]}
            onPress={handleSubmit}
            disabled={updateFollowup.isPending}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.submitText}>
              {updateFollowup.isPending ? "Recording..." : "Record Assessment"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function PrnFollowupsScreen() {
  const colors = useColors();
  const { data: followups, refetch } = useGetPendingPrnFollowups();
  const [completedIds, setCompletedIds] = useState<number[]>([]);

  const pending = (followups ?? []).filter((f: any) => !completedIds.includes(f.id));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>PRN Follow-ups</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Assess medication effectiveness after administration
        </Text>

        {pending.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={40} color="#16a34a" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All clear</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No pending PRN follow-ups at this time
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.countBanner, {
              backgroundColor: pending.some((f: any) => (f.minutesRemaining ?? 0) <= 0) ? "#FEF2F2" : "#EFF6FF",
              borderColor: pending.some((f: any) => (f.minutesRemaining ?? 0) <= 0) ? "#FECACA" : "#BFDBFE",
            }]}>
              <Text style={[styles.countText, {
                color: pending.some((f: any) => (f.minutesRemaining ?? 0) <= 0) ? "#991b1b" : "#1e40af"
              }]}>
                {pending.length} follow-up{pending.length !== 1 ? "s" : ""} pending
              </Text>
            </View>
            {pending.map((f: any) => (
              <FollowupCard
                key={f.id}
                item={f}
                colors={colors}
                onComplete={(id) => {
                  setCompletedIds(prev => [...prev, id]);
                  refetch();
                }}
              />
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 16 },
  countBanner: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  countText: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  card: { borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  cardHeader: { flexDirection: "row", padding: 16 },
  medName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  patientName: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  prnReason: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  timerText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  assessSection: { padding: 16, borderTopWidth: 1 },
  assessTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  scoreLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  scoreRow: { flexDirection: "row", gap: 4, marginBottom: 16 },
  scoreDot: { flex: 1, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  scoreNum: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 10 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 70, marginBottom: 12 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 10, gap: 8 },
  submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyState: { alignItems: "center", padding: 40, borderRadius: 16, borderWidth: 1, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" },
});
