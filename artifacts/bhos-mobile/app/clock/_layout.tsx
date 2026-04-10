import { Stack } from "expo-router";

export default function ClockLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Clock In/Out" }} />
    </Stack>
  );
}
