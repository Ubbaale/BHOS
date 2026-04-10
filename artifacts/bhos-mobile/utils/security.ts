import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import { Alert, Platform } from "react-native";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (e) {
    console.error("Location error:", e);
    return null;
  }
}

export function getLocationHeaders(location: { latitude: number; longitude: number } | null) {
  if (!location) return {};
  return {
    "X-Client-Latitude": location.latitude.toString(),
    "X-Client-Longitude": location.longitude.toString(),
  };
}

export async function verifyLocation(
  token: string,
  location: { latitude: number; longitude: number }
): Promise<{ allowed: boolean; message: string; geofenceEnabled: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/security/verify-location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(location),
    });

    if (!res.ok) {
      return { allowed: false, message: "Failed to verify location", geofenceEnabled: true };
    }

    return await res.json();
  } catch {
    return { allowed: true, message: "Could not reach server for verification", geofenceEnabled: false };
  }
}

export async function getSecuritySettings(token: string) {
  try {
    const res = await fetch(`${API_BASE}/security/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function checkDeviceSecurity(): Promise<{
  hasPasscode: boolean;
  hasBiometric: boolean;
  biometricTypes: string[];
}> {
  try {
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
    const hasBiometric = securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ||
                         securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
    const hasPasscode = securityLevel !== LocalAuthentication.SecurityLevel.NONE;

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const biometricTypes: string[] = [];
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) biometricTypes.push("fingerprint");
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) biometricTypes.push("face");
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) biometricTypes.push("iris");

    return { hasPasscode, hasBiometric, biometricTypes };
  } catch {
    return { hasPasscode: false, hasBiometric: false, biometricTypes: [] };
  }
}

export async function authenticateWithBiometric(
  reason: string = "Verify your identity to continue"
): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return true;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });

    return result.success;
  } catch {
    return false;
  }
}

export function showLocationDeniedAlert() {
  Alert.alert(
    "Location Required",
    "This app requires location access to verify you are at an approved facility. Please enable location services in your device settings.",
    [{ text: "OK" }]
  );
}

export function showGeofenceBlockedAlert(message: string) {
  Alert.alert(
    "Access Restricted",
    message || "You must be at an approved facility to access patient data.",
    [{ text: "OK" }]
  );
}

export function showDeviceSecurityAlert() {
  Alert.alert(
    "Device Security Required",
    "This app requires a device passcode or biometric lock to be enabled for patient data protection. Please set up a screen lock in your device settings.",
    [{ text: "OK" }]
  );
}
