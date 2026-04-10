import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";

import { useColors } from "@/hooks/useColors";

function MenuItem({
  icon,
  emoji,
  label,
  description,
  color,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  emoji?: string;
  label: string;
  description: string;
  color: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: color + "15" }]}>
        {emoji ? (
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        ) : (
          <Feather name={icon} size={20} color={color} />
        )}
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0), paddingTop: Platform.OS === "web" ? 67 + insets.top : 8 }}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MEDICATION SAFETY</Text>
        <MenuItem
          icon="camera"
          emoji="📷"
          label="Scan Barcode"
          description="Scan medication barcodes for verification"
          color="#0a7ea4"
          onPress={() => router.push("/scanner")}
        />
        <MenuItem
          icon="shield"
          emoji="🛡️"
          label="Safety Dashboard"
          description="Compliance, alerts, and audit trail"
          color="#16a34a"
          onPress={() => router.push("/medication-safety")}
        />
        <MenuItem
          icon="zap"
          emoji="⚡"
          label="Report Side Effect"
          description="Document adverse reactions"
          color="#dc2626"
          onPress={() => router.push("/medication-safety/side-effects")}
        />
        <MenuItem
          icon="x-circle"
          emoji="🚫"
          label="Record Refusal"
          description="Document medication refusals"
          color="#ef4444"
          onPress={() => router.push("/medication-safety/refusals")}
        />
        <MenuItem
          icon="clock"
          emoji="⏱️"
          label="PRN Follow-ups"
          description="Effectiveness assessments"
          color="#2563eb"
          onPress={() => router.push("/medication-safety/prn-followups")}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>OPERATIONS</Text>
        <MenuItem
          icon="clock"
          emoji="⏰"
          label="Shifts"
          description="View and manage shift schedule"
          color={colors.warning}
          onPress={() => router.push("/shifts")}
        />
        <MenuItem
          icon="file-text"
          emoji="📓"
          label="Daily Logs"
          description="Create and view daily patient logs"
          color={colors.primary}
          onPress={() => router.push("/daily-logs")}
        />
        <MenuItem
          icon="home"
          emoji="🏠"
          label="Homes"
          description="View group home details"
          color="#8b5cf6"
          onPress={() => router.push("/homes")}
        />
        <MenuItem
          icon="dollar-sign"
          emoji="💰"
          label="Billing"
          description="Claims, payments, and revenue"
          color="#059669"
          onPress={() => router.push("/billing")}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>QUICK ACTIONS</Text>
        <MenuItem
          icon="plus-circle"
          emoji="📝"
          label="New Daily Log"
          description="Write a daily log entry"
          color={colors.primary}
          onPress={() => router.push("/daily-logs/new")}
        />
        <MenuItem
          icon="alert-triangle"
          emoji="⚠️"
          label="Report Incident"
          description="File a new incident report"
          color={colors.destructive}
          onPress={() => router.push("/incidents/new")}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        {user && (
          <View style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="user" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                {user.fullName || user.primaryEmailAddress?.emailAddress || "User"}
              </Text>
              <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>
                {user.primaryEmailAddress?.emailAddress || ""}
              </Text>
            </View>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.menuItem,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => signOut()}
        >
          <View style={[styles.menuIcon, { backgroundColor: "#ef444415" }]}>
            <Feather name="log-out" size={20} color="#ef4444" />
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuLabel, { color: "#ef4444" }]}>Sign Out</Text>
            <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>Log out of your account</Text>
          </View>
        </Pressable>
      </View>

      <View style={[styles.appInfo, { borderTopColor: colors.border }]}>
        <Text style={[styles.appName, { color: colors.foreground }]}>BHOS Mobile</Text>
        <Text style={[styles.appVersion, { color: colors.mutedForeground }]}>v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  menuDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  appInfo: { alignItems: "center", paddingTop: 24, marginTop: 8, marginHorizontal: 16, borderTopWidth: 1 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  appVersion: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
});
