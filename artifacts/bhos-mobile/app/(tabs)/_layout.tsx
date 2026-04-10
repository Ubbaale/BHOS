import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, StyleSheet, View, Text, useColorScheme, AppState, ActivityIndicator } from "react-native";
import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  getCurrentLocation,
  checkDeviceSecurity,
  showDeviceSecurityAlert,
  showGeofenceBlockedAlert,
  verifyLocation,
  getSecuritySettings,
} from "@/utils/security";
import {
  registerDevice,
  checkDeviceStatus,
  type DeviceStatus,
} from "@/utils/deviceEnrollment";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="patients">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Patients</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="medications">
        <Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <Label>Meds</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="incidents">
        <Icon sf={{ default: "exclamationmark.triangle", selected: "exclamationmark.triangle.fill" }} />
        <Label>Incidents</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }} />
        <Label>More</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "🏠 Home",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Text style={{ fontSize: 22 }}>🏠</Text>
            ),
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: "👥 Patients",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2" tintColor={color} size={24} />
            ) : (
              <Text style={{ fontSize: 22 }}>👥</Text>
            ),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: "💊 Meds",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="heart" tintColor={color} size={24} />
            ) : (
              <Text style={{ fontSize: 22 }}>💊</Text>
            ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: "⚠️ Incidents",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="exclamationmark.triangle" tintColor={color} size={24} />
            ) : (
              <Text style={{ fontSize: 22 }}>⚠️</Text>
            ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "⚙️ More",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="ellipsis.circle" tintColor={color} size={24} />
            ) : (
              <Text style={{ fontSize: 22 }}>⚙️</Text>
            ),
        }}
      />
    </Tabs>
  );
}

function DeviceEnrollmentGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { getToken } = useAuth();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | "loading">("loading");
  const [message, setMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const checkAndRegister = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const status = await checkDeviceStatus(token);

      if (!status.enrolled || status.status === "not_registered") {
        const regResult = await registerDevice(token);
        setDeviceStatus(regResult.status);
        setMessage(regResult.message);
      } else {
        setDeviceStatus(status.status);
        setMessage(status.message);
      }
    } catch (e: any) {
      console.error("Device enrollment check error:", e);
      setDeviceStatus("error" as any);
      setMessage("Unable to verify device. Please check your connection and try again.");
    }
  }, [getToken]);

  useEffect(() => {
    checkAndRegister();
  }, [checkAndRegister]);

  useEffect(() => {
    if (deviceStatus === "pending") {
      pollRef.current = setInterval(checkAndRegister, 15000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [deviceStatus, checkAndRegister]);

  if (deviceStatus === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.mutedForeground, fontSize: 16 }}>Verifying device...</Text>
      </View>
    );
  }

  if (deviceStatus === "pending") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
          <Feather name="clock" size={36} color="#d97706" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, marginBottom: 12, textAlign: "center" }}>Device Pending Approval</Text>
        <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
          Your device has been registered and is waiting for admin approval. You'll get full access once an administrator approves this device.
        </Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, width: "100%", borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>What happens next?</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 20 }}>
            • Your administrator will review this device{"\n"}
            • Once approved, the app will automatically unlock{"\n"}
            • This check runs every 15 seconds{"\n"}
            • Contact your admin if this takes too long
          </Text>
        </View>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 24 }} />
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 8 }}>Checking for approval...</Text>
      </View>
    );
  }

  if (deviceStatus === "revoked" || deviceStatus === "blocked") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#fee2e2", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
          <Feather name="shield-off" size={36} color="#dc2626" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, marginBottom: 12, textAlign: "center" }}>
          {deviceStatus === "blocked" ? "Device Blocked" : "Device Access Revoked"}
        </Text>
        <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22 }}>
          {deviceStatus === "blocked"
            ? "This device has been blocked by an administrator. It cannot be used to access BHOS."
            : "Access from this device has been revoked. Please contact your administrator to restore access."}
        </Text>
      </View>
    );
  }

  if ((deviceStatus as string) === "error") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
          <Feather name="wifi-off" size={36} color="#d97706" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, marginBottom: 12, textAlign: "center" }}>Connection Error</Text>
        <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22, marginBottom: 24 }}>{message}</Text>
        <View style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }} onPress={checkAndRegister}>Retry</Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

export default function TabLayout() {
  const { isSignedIn, getToken, signOut } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn) return;

    const runSecurityChecks = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const deviceSecurity = await checkDeviceSecurity();
        const settings = await getSecuritySettings(token);

        if (settings?.requireDevicePasscode && !deviceSecurity.hasPasscode) {
          showDeviceSecurityAlert();
        }

        const location = await getCurrentLocation();
        if (location && settings?.geofenceEnabled) {
          const result = await verifyLocation(token, location);
          if (!result.allowed) {
            showGeofenceBlockedAlert(result.message);
          }
        }
      } catch (e) {
        console.error("Security check error:", e);
      }
    };

    runSecurityChecks();
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn) return;

    const handleAppState = (nextState: string) => {
      if (nextState === "active") {
        const idle = Date.now() - lastActivityRef.current;
        if (idle > 15 * 60 * 1000) {
          signOut();
        }
        lastActivityRef.current = Date.now();
      } else {
        lastActivityRef.current = Date.now();
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [isSignedIn, signOut]);

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  const tabContent = isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />;

  return (
    <DeviceEnrollmentGate>
      {tabContent}
    </DeviceEnrollmentGate>
  );
}
