import { Feather } from "@expo/vector-icons";
import { useListHomes } from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export default function HomesScreen() {
  const colors = useColors();
  const { data: homes, isLoading, refetch } = useListHomes();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={homes ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16, paddingTop: 8 }}
          refreshing={false}
          onRefresh={refetch}
          scrollEnabled={(homes?.length ?? 0) > 0}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="home" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No homes found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.homeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.homeIcon, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="home" size={22} color={colors.primary} />
              </View>
              <View style={styles.homeInfo}>
                <Text style={[styles.homeName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.homeAddress, { color: colors.mutedForeground }]}>
                  {item.address}, {item.city}, {item.state}
                </Text>
                <View style={styles.homeStats}>
                  <Text style={[styles.homeStat, { color: colors.mutedForeground }]}>
                    <Feather name="users" size={12} color={colors.mutedForeground} /> {item.currentOccupancy}/{item.capacity}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: item.status === "active" ? colors.success : colors.warning }]} />
                  <Text style={[styles.homeStat, { color: colors.mutedForeground }]}>{item.status}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  homeCard: { flexDirection: "row", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  homeIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
  homeInfo: { flex: 1 },
  homeName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  homeAddress: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  homeStats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  homeStat: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 12 },
});
