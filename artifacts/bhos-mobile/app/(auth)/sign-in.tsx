import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");

  const handleSubmit = async () => {
    const { error } = await signIn.password({
      emailAddress,
      password,
    });
    if (error) {
      console.error(JSON.stringify(error, null, 2));
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            console.log(session?.currentTask);
            return;
          }
          const url = decorateUrl("/");
          router.push(url as Href);
        },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoBox}>
            <Image source={require("../../assets/images/logo.png")} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.logo}>BHOS</Text>
            <Text style={styles.subtitle}>Behavioral Home Operating System</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Sign In</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={emailAddress}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              onChangeText={setEmailAddress}
              keyboardType="email-address"
              autoComplete="email"
            />
            {errors?.fields?.identifier && (
              <Text style={styles.error}>{errors.fields.identifier.message}</Text>
            )}

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              onChangeText={setPassword}
              autoComplete="password"
            />
            {errors?.fields?.password && (
              <Text style={styles.error}>{errors.fields.password.message}</Text>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!emailAddress || !password || fetchStatus === "fetching") && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSubmit}
              disabled={!emailAddress || !password || fetchStatus === "fetching"}
            >
              <Text style={styles.buttonText}>
                {fetchStatus === "fetching" ? "Signing in..." : "Sign In"}
              </Text>
            </Pressable>

            <View style={styles.linkRow}>
              <Text style={styles.linkLabel}>Have an enrollment code? </Text>
              <Link href="/(auth)/sign-up">
                <Text style={styles.link}>Set up account</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  logoBox: { alignItems: "center", marginBottom: 32 },
  logoImage: { width: 64, height: 64, marginBottom: 8 },
  logo: { fontSize: 36, fontWeight: "800", color: "#0a7ea4", letterSpacing: 2 },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 20, textAlign: "center" },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#f1f5f9", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#0f172a", borderWidth: 1, borderColor: "#e2e8f0" },
  error: { color: "#ef4444", fontSize: 13, marginTop: 4 },
  button: { backgroundColor: "#0a7ea4", borderRadius: 10, paddingVertical: 14, marginTop: 20, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  linkLabel: { color: "#64748b", fontSize: 14 },
  link: { color: "#0a7ea4", fontSize: 14, fontWeight: "600" },
});
