import { Feather } from "@expo/vector-icons";
import {
  useCreateMedicationAdministration,
  useListMedications,
  useListPatients,
  useListStaff,
  useCheckDrugInteractions,
  useCreateVitalSigns,
} from "@workspace/api-client-react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useState, useMemo, useCallback } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const FIVE_RIGHTS = [
  { key: "patient", label: "Right Patient", icon: "user" as const },
  { key: "drug", label: "Right Drug", icon: "package" as const },
  { key: "dose", label: "Right Dose", icon: "hash" as const },
  { key: "route", label: "Right Route", icon: "navigation" as const },
  { key: "time", label: "Right Time", icon: "clock" as const },
];

export default function AdministerMedicationScreen() {
  const colors = useColors();
  const router = useRouter();

  const { data: patients } = useListPatients();
  const { data: medications } = useListMedications();
  const { data: staff } = useListStaff();
  const createAdmin = useCreateMedicationAdministration();
  const createVitals = useCreateVitalSigns();

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedMedId, setSelectedMedId] = useState<number | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [witnessStaffId, setWitnessStaffId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [prnReason, setPrnReason] = useState("");
  const [interactionAcknowledged, setInteractionAcknowledged] = useState(false);
  const [allergyAcknowledged, setAllergyAcknowledged] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [rightsChecked, setRightsChecked] = useState<Record<string, boolean>>({});
  const [systolicBp, setSystolicBp] = useState("");
  const [diastolicBp, setDiastolicBp] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [showVitals, setShowVitals] = useState(false);
  const [barcodeScanVerified, setBarcodeScanVerified] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const searchParams = useLocalSearchParams<{ scannedMedId?: string; barcodeScanVerified?: string }>();

  useFocusEffect(
    useCallback(() => {
      if (searchParams.scannedMedId && searchParams.barcodeScanVerified === "true") {
        const medId = parseInt(searchParams.scannedMedId, 10);
        if (!isNaN(medId)) {
          setSelectedMedId(medId);
          setBarcodeScanVerified(true);
          const med = medications?.find(m => m.id === medId);
          setScannedBarcode(med?.ndcCode || med?.rxNumber || `MED-${medId}`);
          if (med) {
            setSelectedPatientId(med.patientId);
          }
        }
      }
    }, [searchParams.scannedMedId, searchParams.barcodeScanVerified, medications])
  );

  const { data: interactions } = useCheckDrugInteractions(
    { patientId: selectedPatientId! },
    { query: { enabled: !!selectedPatientId } }
  );

  const patientMeds = (medications ?? []).filter((m) => !selectedPatientId || m.patientId === selectedPatientId);
  const selectedMed = medications?.find(m => m.id === selectedMedId);
  const selectedPatient = patients?.find(p => p.id === selectedPatientId);
  const isPrn = selectedMed?.medicationType === "prn";
  const isControlled = selectedMed?.controlledSubstance;
  const allRightsChecked = FIVE_RIGHTS.every(r => rightsChecked[r.key]);

  const allergyWarning = useMemo(() => {
    if (!selectedPatient || !selectedMed) return null;
    const allergies = (selectedPatient as any).allergies as string | undefined;
    if (!allergies || allergies === "None known") return null;
    const allergyList = allergies.split(",").map((a: string) => a.trim().toLowerCase());
    const medName = selectedMed.name.toLowerCase();
    const match = allergyList.find((a: string) => medName.includes(a) || a.includes(medName));
    if (match) return `Patient has documented allergy to "${match}". Verify with physician before administering.`;
    return null;
  }, [selectedPatient, selectedMed]);

  const relevantInteractions = useMemo(() => {
    if (!interactions || !selectedMed) return [];
    return interactions.filter(i =>
      i.drugA.toLowerCase() === selectedMed.name.toLowerCase() ||
      i.drugB.toLowerCase() === selectedMed.name.toLowerCase()
    );
  }, [interactions, selectedMed]);

  const canSubmit = selectedPatientId && selectedMedId && selectedStaffId && allRightsChecked &&
    (!isPrn || prnReason.trim()) &&
    (!isControlled || witnessStaffId) &&
    (!allergyWarning || allergyAcknowledged) &&
    (relevantInteractions.length === 0 || interactionAcknowledged);

  const submitWithToken = useCallback(async (pinToken?: string) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (pinToken) headers["x-pin-verification-token"] = pinToken;

      const res = await fetch(`${baseUrl}/api/medication-administrations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          medicationId: selectedMedId!,
          patientId: selectedPatientId!,
          staffId: selectedStaffId!,
          administeredAt: new Date().toISOString(),
          status: "given",
          notes: notes || undefined,
          prnReason: isPrn ? prnReason : undefined,
          witnessStaffId: isControlled ? witnessStaffId! : undefined,
          fiveRightsVerified: true,
          barcodeScanVerified,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Administration failed" }));
        Alert.alert("Error", err.error || "Failed to record administration.");
        return;
      }

      const data = await res.json();

      if (showVitals && (systolicBp || heartRate)) {
        createVitals.mutate({
          data: {
            patientId: selectedPatientId!,
            staffId: selectedStaffId!,
            administrationId: data.id,
            systolicBp: systolicBp ? parseInt(systolicBp) : undefined,
            diastolicBp: diastolicBp ? parseInt(diastolicBp) : undefined,
            heartRate: heartRate ? parseInt(heartRate) : undefined,
          },
        });
      }
      const msg = isPrn
        ? "Medication administered. You will receive a follow-up reminder in 60 minutes to assess effectiveness."
        : "Medication administered successfully.";
      Alert.alert("Success", msg);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to record administration.");
    }
  }, [selectedMedId, selectedPatientId, selectedStaffId, notes, isPrn, prnReason, isControlled, witnessStaffId, showVitals, systolicBp, diastolicBp, heartRate, createVitals, router, barcodeScanVerified]);


  const handlePinVerify = useCallback(async () => {
    if (!pinInput || pinInput.length < 4) {
      setPinError("Enter your 4-6 digit PIN");
      return;
    }
    setPinVerifying(true);
    setPinError("");
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      const res = await fetch(`${baseUrl}/api/staff/med-pin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || "PIN verification failed");
        setPinInput("");
        setPinVerifying(false);
        return;
      }
      setShowPinModal(false);
      setPinInput("");
      submitWithToken(data.pinVerificationToken);
    } catch {
      setPinError("Network error. Please try again.");
    }
    setPinVerifying(false);
  }, [pinInput, submitWithToken]);

  const handleSubmit = () => {
    if (!canSubmit) {
      Alert.alert("Incomplete", "Complete all required fields and the 5 Rights checklist.");
      return;
    }
    setPinInput("");
    setPinError("");
    setShowPinModal(true);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 60 }}
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
              onPress={() => {
                setSelectedPatientId(p.id);
                setSelectedMedId(null);
                setInteractionAcknowledged(false);
                setAllergyAcknowledged(false);
                setRightsChecked({});
              }}
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

        {selectedPatient && (
          <View style={[styles.patientCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.patientPhotoRow}>
              {(selectedPatient as any).photoUrl ? (
                <Image
                  source={{ uri: (selectedPatient as any).photoUrl }}
                  style={styles.patientPhoto}
                />
              ) : (
                <View style={[styles.patientPhotoPlaceholder, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="user" size={28} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.patientCardName, { color: colors.foreground }]}>
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </Text>
                <Text style={[styles.patientCardDetail, { color: colors.mutedForeground }]}>
                  DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                </Text>
                {(selectedPatient as any).allergies && (selectedPatient as any).allergies !== "None known" && (
                  <View style={styles.allergyBanner}>
                    <Feather name="alert-circle" size={12} color="#DC2626" />
                    <Text style={styles.allergyBannerText}>
                      Allergies: {(selectedPatient as any).allergies}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.label, { color: colors.foreground }]}>Medication</Text>
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: barcodeScanVerified ? "#DCFCE7" : colors.card,
              borderWidth: 1,
              borderColor: barcodeScanVerified ? "#86EFAC" : colors.primary,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
            onPress={() => {
              router.push("/scanner");
            }}
          >
            <Feather
              name={barcodeScanVerified ? "check-circle" : "camera"}
              size={16}
              color={barcodeScanVerified ? "#166534" : colors.primary}
            />
            <Text style={{
              color: barcodeScanVerified ? "#166534" : colors.primary,
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
            }}>
              {barcodeScanVerified ? "Verified" : "Scan Barcode"}
            </Text>
          </Pressable>
        </View>
        {barcodeScanVerified && scannedBarcode && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#DCFCE7",
            borderRadius: 6,
            padding: 8,
            marginBottom: 8,
          }}>
            <Feather name="check" size={14} color="#166534" />
            <Text style={{ color: "#166534", fontSize: 12, fontFamily: "Inter_500Medium" }}>
              Barcode verified: {scannedBarcode}
            </Text>
          </View>
        )}
        <View style={styles.chipRow}>
          {patientMeds.map((m) => (
            <Pressable
              key={m.id}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedMedId === m.id ? colors.primary : colors.card,
                  borderColor: selectedMedId === m.id ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                setSelectedMedId(m.id);
                setInteractionAcknowledged(false);
                setAllergyAcknowledged(false);
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {m.controlledSubstance && (
                  <Feather name="shield" size={12} color={selectedMedId === m.id ? colors.primaryForeground : "#7C3AED"} />
                )}
                <Text
                  style={{
                    color: selectedMedId === m.id ? colors.primaryForeground : colors.foreground,
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                  }}
                >
                  {m.name} ({m.dosage})
                </Text>
                {m.medicationType === "prn" && (
                  <View style={styles.prnMiniTag}>
                    <Text style={styles.prnMiniText}>PRN</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
          {patientMeds.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {selectedPatientId ? "No medications for this patient" : "Select a patient first"}
            </Text>
          )}
        </View>

        {allergyWarning && (
          <View style={[styles.warningCard, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
            <View style={styles.warningHeader}>
              <Feather name="alert-triangle" size={18} color="#DC2626" />
              <Text style={styles.warningTitle}>Allergy Warning</Text>
            </View>
            <Text style={styles.warningText}>{allergyWarning}</Text>
            <Pressable
              style={[styles.ackButton, { backgroundColor: allergyAcknowledged ? "#DCFCE7" : "#FEE2E2", borderColor: allergyAcknowledged ? "#86EFAC" : "#FCA5A5" }]}
              onPress={() => setAllergyAcknowledged(!allergyAcknowledged)}
            >
              <Feather name={allergyAcknowledged ? "check-square" : "square"} size={16} color={allergyAcknowledged ? "#166534" : "#DC2626"} />
              <Text style={{ color: allergyAcknowledged ? "#166534" : "#DC2626", fontFamily: "Inter_500Medium", fontSize: 13 }}>
                I acknowledge this allergy risk
              </Text>
            </Pressable>
          </View>
        )}

        {relevantInteractions.length > 0 && (
          <View style={[styles.warningCard, { backgroundColor: "#FFF7ED", borderColor: "#FDBA74" }]}>
            <View style={styles.warningHeader}>
              <Feather name="zap" size={18} color="#C2410C" />
              <Text style={[styles.warningTitle, { color: "#C2410C" }]}>Drug Interactions</Text>
            </View>
            {relevantInteractions.map((inter, i) => (
              <View key={i} style={styles.interactionItem}>
                <View style={[styles.severityBadge, {
                  backgroundColor: inter.severity === "severe" ? "#FEE2E2" : inter.severity === "moderate" ? "#FEF3C7" : "#F0FDF4"
                }]}>
                  <Text style={[styles.severityText, {
                    color: inter.severity === "severe" ? "#DC2626" : inter.severity === "moderate" ? "#92400E" : "#166534"
                  }]}>{inter.severity}</Text>
                </View>
                <Text style={styles.interactionText}>
                  {inter.drugA} + {inter.drugB}: {inter.description}
                </Text>
              </View>
            ))}
            <Pressable
              style={[styles.ackButton, { backgroundColor: interactionAcknowledged ? "#DCFCE7" : "#FFF7ED", borderColor: interactionAcknowledged ? "#86EFAC" : "#FDBA74" }]}
              onPress={() => setInteractionAcknowledged(!interactionAcknowledged)}
            >
              <Feather name={interactionAcknowledged ? "check-square" : "square"} size={16} color={interactionAcknowledged ? "#166534" : "#C2410C"} />
              <Text style={{ color: interactionAcknowledged ? "#166534" : "#C2410C", fontFamily: "Inter_500Medium", fontSize: 13 }}>
                I acknowledge these interactions
              </Text>
            </Pressable>
          </View>
        )}

        {selectedMed && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>5 Rights Verification</Text>
            <View style={[styles.rightsCard, { backgroundColor: allRightsChecked ? "#F0FDF4" : colors.card, borderColor: allRightsChecked ? "#86EFAC" : colors.border }]}>
              {FIVE_RIGHTS.map((right) => (
                <Pressable
                  key={right.key}
                  style={styles.rightRow}
                  onPress={() => setRightsChecked(prev => ({ ...prev, [right.key]: !prev[right.key] }))}
                >
                  <Feather
                    name={rightsChecked[right.key] ? "check-circle" : "circle"}
                    size={22}
                    color={rightsChecked[right.key] ? "#16A34A" : colors.mutedForeground}
                  />
                  <Feather name={right.icon} size={16} color={rightsChecked[right.key] ? "#16A34A" : colors.mutedForeground} />
                  <Text style={[styles.rightLabel, { color: rightsChecked[right.key] ? "#166534" : colors.foreground }]}>
                    {right.label}
                  </Text>
                </Pressable>
              ))}
              {allRightsChecked && (
                <View style={styles.rightsVerified}>
                  <Feather name="shield" size={16} color="#16A34A" />
                  <Text style={styles.rightsVerifiedText}>All 5 Rights Verified</Text>
                </View>
              )}
            </View>
          </>
        )}

        {isControlled && (
          <View style={[styles.infoCard, { backgroundColor: "#F3E8FF", borderColor: "#DDD6FE" }]}>
            <Feather name="shield" size={16} color="#7C3AED" />
            <Text style={[styles.infoText, { color: "#7C3AED" }]}>
              Controlled substance ({selectedMed?.deaSchedule}) — witness required
            </Text>
          </View>
        )}

        {isPrn && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>PRN Reason *</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.card, borderColor: prnReason.trim() ? colors.border : "#FECACA", color: colors.foreground, minHeight: 60 }]}
              placeholder="Why is this PRN medication being given?"
              placeholderTextColor={colors.mutedForeground}
              value={prnReason}
              onChangeText={setPrnReason}
              multiline
              textAlignVertical="top"
            />
            <View style={[styles.infoCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
              <Feather name="clock" size={16} color="#1D4ED8" />
              <Text style={[styles.infoText, { color: "#1D4ED8" }]}>
                A 60-minute follow-up timer will start to assess effectiveness (1-10 scale)
              </Text>
            </View>
          </>
        )}

        <Text style={[styles.label, { color: colors.foreground }]}>Administered By</Text>
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

        {isControlled && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Witness (required)</Text>
            <View style={styles.chipRow}>
              {(staff ?? []).filter(s => s.id !== selectedStaffId).map((s) => (
                <Pressable
                  key={s.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: witnessStaffId === s.id ? "#7C3AED" : colors.card,
                      borderColor: witnessStaffId === s.id ? "#7C3AED" : colors.border,
                    },
                  ]}
                  onPress={() => setWitnessStaffId(s.id)}
                >
                  <Text
                    style={{
                      color: witnessStaffId === s.id ? "#fff" : colors.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                    }}
                  >
                    {s.firstName} {s.lastName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Pressable
          style={[styles.vitalsToggle, { backgroundColor: showVitals ? "#EFF6FF" : colors.card, borderColor: showVitals ? "#93C5FD" : colors.border }]}
          onPress={() => setShowVitals(!showVitals)}
        >
          <Feather name="activity" size={18} color={showVitals ? "#1D4ED8" : colors.mutedForeground} />
          <Text style={{ color: showVitals ? "#1D4ED8" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }}>
            Record Vital Signs at Med Pass
          </Text>
          <Feather name={showVitals ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </Pressable>

        {showVitals && (
          <View style={[styles.vitalsGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.vitalsRow}>
              <View style={styles.vitalInput}>
                <Text style={[styles.vitalLabel, { color: colors.mutedForeground }]}>Systolic BP</Text>
                <TextInput
                  style={[styles.vitalField, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="120"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  value={systolicBp}
                  onChangeText={setSystolicBp}
                />
              </View>
              <View style={styles.vitalInput}>
                <Text style={[styles.vitalLabel, { color: colors.mutedForeground }]}>Diastolic BP</Text>
                <TextInput
                  style={[styles.vitalField, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="80"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  value={diastolicBp}
                  onChangeText={setDiastolicBp}
                />
              </View>
              <View style={styles.vitalInput}>
                <Text style={[styles.vitalLabel, { color: colors.mutedForeground }]}>Heart Rate</Text>
                <TextInput
                  style={[styles.vitalField, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="72"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  value={heartRate}
                  onChangeText={setHeartRate}
                />
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.label, { color: colors.foreground }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Any notes about this administration..."
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
            {
              backgroundColor: canSubmit ? colors.success : "#94A3B8",
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={createAdmin.isPending || !canSubmit}
        >
          <Feather name="check-circle" size={20} color="#fff" />
          <Text style={styles.submitText}>
            {createAdmin.isPending ? "Recording..." : "Record Administration"}
          </Text>
        </Pressable>

        {!allRightsChecked && selectedMed && (
          <Text style={styles.rightsReminder}>Complete the 5 Rights checklist above to enable submission</Text>
        )}
      </View>

      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={pinStyles.overlay}>
          <View style={[pinStyles.modal, { backgroundColor: colors.card }]}>
            <View style={pinStyles.header}>
              <Feather name="shield" size={24} color="#2563EB" />
              <Text style={[pinStyles.title, { color: colors.foreground }]}>Identity Verification</Text>
            </View>
            <Text style={[pinStyles.subtitle, { color: colors.mutedForeground }]}>
              Enter your personal med-pass PIN to confirm your identity.
            </Text>

            <TextInput
              style={[pinStyles.pinInput, { backgroundColor: colors.background, borderColor: pinError ? "#DC2626" : colors.border, color: colors.foreground }]}
              placeholder="Enter PIN"
              placeholderTextColor={colors.mutedForeground}
              value={pinInput}
              onChangeText={(t) => { setPinInput(t.replace(/\D/g, "")); setPinError(""); }}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              autoFocus
            />

            {pinError ? (
              <View style={pinStyles.errorRow}>
                <Feather name="alert-triangle" size={14} color="#DC2626" />
                <Text style={pinStyles.errorText}>{pinError}</Text>
              </View>
            ) : null}

            <Pressable
              style={[pinStyles.verifyBtn, { opacity: pinVerifying || pinInput.length < 4 ? 0.5 : 1 }]}
              onPress={handlePinVerify}
              disabled={pinVerifying || pinInput.length < 4}
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={pinStyles.verifyText}>{pinVerifying ? "Verifying..." : "Verify & Administer"}</Text>
            </Pressable>

            <Pressable style={pinStyles.cancelBtn} onPress={() => setShowPinModal(false)}>
              <Text style={[pinStyles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 20, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 80 },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 10, gap: 8, marginTop: 24 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  patientCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  patientPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  patientPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  patientPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  patientCardName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  patientCardDetail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  allergyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  allergyBannerText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  warningCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#DC2626" },
  warningText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#7F1D1D", marginBottom: 8 },
  interactionItem: { marginBottom: 10 },
  severityBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  severityText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  interactionText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#44403C" },
  ackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  rightsCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rightLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rightsVerified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#86EFAC",
    marginTop: 4,
  },
  rightsVerifiedText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#16A34A" },
  rightsReminder: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", color: "#DC2626", marginTop: 8 },
  prnMiniTag: {
    backgroundColor: "#FEF3C7",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  prnMiniText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#92400E" },
  vitalsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
  },
  vitalsGrid: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  vitalsRow: { flexDirection: "row", gap: 8 },
  vitalInput: { flex: 1 },
  vitalLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 4 },
  vitalField: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});

const pinStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  pinInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: 8,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#FEE2E2",
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#DC2626",
    flex: 1,
  },
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  verifyText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
