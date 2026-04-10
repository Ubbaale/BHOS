import { Feather } from "@expo/vector-icons";
import { useListHomes, useListStaff, useGetActiveTimePunch, useCreateTimePunch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { useColors } from "@/hooks/useColors";

export default function ClockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: staff } = useListStaff();
  const { data: homes } = useListHomes();
  const { data: activePunchData, refetch: refetchActive } = useGetActiveTimePunch(
    { staffId: selectedStaffId! },
    { query: { enabled: !!selectedStaffId } }
  );
  const createPunch = useCreateTimePunch();

  const activePunch = activePunchData?.activePunch;

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    setLocationStatus("requesting");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }
      setLocationStatus("getting");
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocationStatus("ready");
    } catch {
      setLocationStatus("error");
    }
  };

  const handlePunch = async (type: "clock_in" | "clock_out") => {
    if (!selectedStaffId || !selectedHomeId) {
      Alert.alert("Missing Info", "Please select a staff member and home.");
      return;
    }
    setSubmitting(true);
    setLastResult(null);

    let freshLat = location?.latitude ?? null;
    let freshLng = location?.longitude ?? null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        freshLat = loc.coords.latitude;
        freshLng = loc.coords.longitude;
        setLocation({ latitude: freshLat, longitude: freshLng });
        setLocationStatus("ready");
      }
    } catch {}

    try {
      const result = await createPunch.mutateAsync({
        data: {
          staffId: selectedStaffId,
          homeId: selectedHomeId,
          type,
          latitude: freshLat,
          longitude: freshLng,
        },
      });
      setLastResult(result);
      refetchActive();
      queryClient.invalidateQueries({ queryKey: ["/time-punches"] });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to record time punch.");
    }
    setSubmitting(false);
  };

  const activeStaff = staff?.filter((s) => s.status === "active") || [];
  const activeHomes = homes?.filter((h) => h.status === "active") || [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: Platform.OS === "web" ? 16 : 0 }}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>GPS Status</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.gpsRow}>
            <Feather
              name={locationStatus === "ready" ? "check-circle" : locationStatus === "denied" ? "x-circle" : "loader"}
              size={20}
              color={locationStatus === "ready" ? colors.success : locationStatus === "denied" ? colors.destructive : colors.warning}
            />
            <Text style={[styles.gpsText, { color: colors.foreground }]}>
              {locationStatus === "ready"
                ? `Location acquired (${location?.latitude.toFixed(5)}, ${location?.longitude.toFixed(5)})`
                : locationStatus === "denied"
                ? "Location permission denied"
                : locationStatus === "error"
                ? "Failed to get location"
                : "Acquiring GPS..."}
            </Text>
          </View>
          {locationStatus !== "ready" && locationStatus !== "requesting" && locationStatus !== "getting" && (
            <Pressable
              style={[styles.refreshBtn, { borderColor: colors.border }]}
              onPress={requestLocation}
            >
              <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Retry GPS</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Select Staff</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {activeStaff.map((s) => (
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
                  style={[
                    styles.chipText,
                    { color: selectedStaffId === s.id ? "#fff" : colors.foreground },
                  ]}
                >
                  {s.firstName} {s.lastName}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Select Home</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {activeHomes.map((h) => (
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
                  style={[
                    styles.chipText,
                    { color: selectedHomeId === h.id ? "#fff" : colors.foreground },
                  ]}
                >
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {activePunch && (
        <View style={styles.section}>
          <View style={[styles.activeCard, { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" }]}>
            <Feather name="clock" size={18} color="#16a34a" />
            <Text style={{ color: "#16a34a", fontFamily: "Inter_500Medium", fontSize: 14, flex: 1, marginLeft: 8 }}>
              Currently clocked in since {new Date(activePunch.punchTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.punchButtons}>
        {!activePunch ? (
          <Pressable
            style={({ pressed }) => [
              styles.punchBtn,
              { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => handlePunch("clock_in")}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="log-in" size={28} color="#fff" />
                <Text style={styles.punchBtnText}>Clock In</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.punchBtn,
              { backgroundColor: colors.destructive, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => handlePunch("clock_out")}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="log-out" size={28} color="#fff" />
                <Text style={styles.punchBtnText}>Clock Out</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {lastResult && (
        <View style={styles.section}>
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: lastResult.timePunch?.isWithinGeofence ? "#dcfce7" : "#fef2f2",
                borderColor: lastResult.timePunch?.isWithinGeofence ? "#bbf7d0" : "#fecaca",
              },
            ]}
          >
            <Feather
              name={lastResult.timePunch?.isWithinGeofence ? "check-circle" : "alert-circle"}
              size={20}
              color={lastResult.timePunch?.isWithinGeofence ? "#16a34a" : "#dc2626"}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#1f2937" }}>
                {lastResult.timePunch?.isWithinGeofence ? "Verified" : "Off-Site Punch"}
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                Distance: {Number(lastResult.timePunch?.distanceFromHome || 0).toFixed(0)}m from home
              </Text>
              {lastResult.alerts?.length > 0 && (
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                  {lastResult.alerts.length} fraud alert{lastResult.alerts.length > 1 ? "s" : ""} generated
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  gpsText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  refreshBtn: { marginTop: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  chipRow: { flexDirection: "row", gap: 8, paddingRight: 20 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  activeCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14 },
  punchButtons: { paddingHorizontal: 20, marginTop: 30, alignItems: "center" },
  punchBtn: {
    width: "100%",
    height: 80,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  punchBtnText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  resultCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14 },
});
