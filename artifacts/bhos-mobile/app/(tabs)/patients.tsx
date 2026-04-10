import { Feather } from "@expo/vector-icons";
import { useListPatients } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function statusColor(status: string, colors: ReturnType<typeof useColors>) {
  if (status === "active") return colors.success;
  if (status === "discharged") return colors.warning;
  return colors.mutedForeground;
}

export default function PatientsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: patients, isLoading, refetch } = useListPatients();

  const filtered = (patients ?? []).filter((p) => {
    const term = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(term) ||
      p.lastName.toLowerCase().includes(term) ||
      (p.homeName ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, marginTop: Platform.OS === "web" ? 67 + insets.top : 8 }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search patients..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0), paddingHorizontal: 16 }}
          refreshing={false}
          onRefresh={refetch}
          scrollEnabled={filtered.length > 0}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="users" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No patients found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.patientCard,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => router.push(`/patients/${item.id}`)}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {item.firstName[0]}{item.lastName[0]}
                </Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={[styles.patientName, { color: colors.foreground }]}>
                  {item.firstName} {item.lastName}
                </Text>
                <Text style={[styles.patientMeta, { color: colors.mutedForeground }]}>
                  {item.homeName ?? "Unassigned"}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status, colors) + "15" }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status, colors) }]}>
                  {item.status}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  patientCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  patientMeta: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 12 },
});
