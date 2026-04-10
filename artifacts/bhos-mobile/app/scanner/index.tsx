import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

export default function BarcodeScannerScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { getToken } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const handleBarCodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    const code = result.data;

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const resp = await fetch(`${baseUrl}/api/medications/barcode-lookup/${encodeURIComponent(code)}`, { headers });
      if (!resp.ok) {
        Alert.alert("Error", `Server error (${resp.status}). Please try again.`, [
          { text: "Retry", onPress: () => { setScanned(false); setLoading(false); } },
          { text: "Cancel", onPress: () => router.back() },
        ]);
        setLoading(false);
        return;
      }
      const data = await resp.json();

      if (data.found && data.medications.length > 0) {
        const med = data.medications[0];
        Alert.alert(
          "Medication Found",
          `${med.name} ${med.dosage}\nPatient: ${med.patientName}\nNDC: ${med.ndcCode || "N/A"}\nRx#: ${med.rxNumber || "N/A"}`,
          [
            {
              text: "Use This Medication",
              onPress: () => {
                router.replace({
                  pathname: "/medications/administer",
                  params: { scannedMedId: String(med.id), barcodeScanVerified: "true" },
                });
              },
            },
            {
              text: "Scan Again",
              onPress: () => { setScanned(false); setLoading(false); },
            },
          ]
        );
      } else {
        Alert.alert(
          "Not Found",
          `No medication found for barcode: ${code}.\n\nMake sure the medication's NDC code, Rx number, or lot number is entered in the system.`,
          [
            { text: "Scan Again", onPress: () => { setScanned(false); setLoading(false); } },
            { text: "Cancel", onPress: () => router.back(), style: "cancel" },
          ]
        );
      }
    } catch {
      Alert.alert("Error", "Could not look up barcode. Check your connection.", [
        { text: "Retry", onPress: () => { setScanned(false); setLoading(false); } },
        { text: "Cancel", onPress: () => router.back() },
      ]);
    }

    setLoading(false);
  }, [scanned, baseUrl, router]);

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionCard}>
          <Feather name="camera-off" size={48} color={colors.textSecondary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera Permission Needed</Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            BHOS needs camera access to scan medication barcodes for safety verification.
          </Text>
          <Pressable
            style={[styles.permissionButton, { backgroundColor: colors.tint }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </Pressable>
          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "code128", "code39", "code93",
            "ean13", "ean8", "upc_a", "upc_e",
            "datamatrix", "qr", "pdf417",
            "itf14", "codabar",
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <View style={styles.instructionCard}>
            <Feather name="maximize" size={20} color="#fff" />
            <Text style={styles.instructionText}>
              {loading ? "Looking up medication..." : "Point camera at medication barcode"}
            </Text>
          </View>
          <Text style={styles.supportedText}>
            Supports: NDC, UPC, EAN, QR, Code128, DataMatrix
          </Text>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayMiddle: {
    flexDirection: "row",
    height: SCAN_AREA_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#0a7ea4",
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    paddingTop: 24,
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(10,126,164,0.9)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  instructionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  supportedText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 12,
  },
  closeButton: {
    marginTop: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionCard: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  permissionText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelLink: {
    marginTop: 8,
  },
  cancelText: {
    fontSize: 15,
  },
});
