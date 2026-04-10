import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { addNotificationResponseListener } from "@/utils/notifications";
import { useRouter } from "expo-router";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function RootLayoutNav() {
  const router = useRouter();
  const responseListener = useRef<any>();

  useEffect(() => {
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "med_access_challenge" && data?.challengeId && data?.responseSecret) {
        router.push({
          pathname: "/approve-med-access",
          params: {
            challengeId: String(data.challengeId),
            responseSecret: String(data.responseSecret),
            patientName: data.patientName || "",
            medicationName: data.medicationName || "",
          },
        });
      }
    });

    return () => {
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="patients" options={{ headerShown: false }} />
      <Stack.Screen name="incidents" options={{ headerShown: false }} />
      <Stack.Screen name="medications" options={{ headerShown: false }} />
      <Stack.Screen name="daily-logs" options={{ headerShown: false }} />
      <Stack.Screen name="shifts" options={{ headerShown: false }} />
      <Stack.Screen name="homes" options={{ headerShown: false }} />
      <Stack.Screen name="clock" options={{ headerShown: false }} />
      <Stack.Screen name="billing" options={{ headerShown: false }} />
      <Stack.Screen name="medication-safety" options={{ headerShown: false }} />
      <Stack.Screen name="scanner" options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="approve-med-access" options={{ headerShown: true, title: "Approve Access", presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={publishableKey}
          tokenCache={tokenCache}
          proxyUrl={proxyUrl}
        >
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
