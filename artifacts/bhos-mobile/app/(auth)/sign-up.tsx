import { useAuth, useSignUp } from "@clerk/expo";
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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [inviteToken, setInviteToken] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [validating, setValidating] = React.useState(false);
  const [inviteData, setInviteData] = React.useState<{
    staffName: string;
    email: string;
    role: string;
  } | null>(null);
  const [inviteError, setInviteError] = React.useState("");
  const [step, setStep] = React.useState<"token" | "create" | "verify">("token");

  const handleValidateToken = async () => {
    if (!inviteToken.trim()) {
      setInviteError("Please enter your enrollment code");
      return;
    }
    setValidating(true);
    setInviteError("");
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      const res = await fetch(`${baseUrl}/api/staff/invitation/validate?token=${inviteToken.trim()}`);
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Invalid enrollment code");
        setValidating(false);
        return;
      }
      setInviteData(data);
      setStep("create");
    } catch {
      setInviteError("Network error. Please try again.");
    }
    setValidating(false);
  };

  const handleCreateAccount = async () => {
    if (!inviteData) return;
    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    const { error } = await signUp.password({
      emailAddress: inviteData.email,
      password,
    });
    if (error) {
      Alert.alert("Error", error.message || "Failed to create account.");
      return;
    }
    if (!error) {
      await signUp.verifications.sendEmailCode();
      setStep("verify");
    }
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      try {
        const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
        await fetch(`${baseUrl}/api/staff/invitation/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: inviteToken.trim(),
            clerkUserId: signUp.createdUserId,
          }),
        });
      } catch {}

      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          router.push(url as Href);
        },
      });
    }
  };

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  if (step === "verify") {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>Enter the code sent to {inviteData?.email}</Text>
              <TextInput
                style={styles.input}
                value={code}
                placeholder="Verification code"
                placeholderTextColor="#94a3b8"
                onChangeText={setCode}
                keyboardType="numeric"
              />
              {errors?.fields?.code && (
                <Text style={styles.error}>{errors.fields.code.message}</Text>
              )}
              <Pressable
                style={({ pressed }) => [styles.button, fetchStatus === "fetching" && styles.buttonDisabled, pressed && styles.buttonPressed]}
                onPress={handleVerify}
                disabled={fetchStatus === "fetching"}
              >
                <Text style={styles.buttonText}>Verify & Activate</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={() => signUp.verifications.sendEmailCode()}
              >
                <Text style={styles.secondaryText}>Resend code</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (step === "create" && inviteData) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.logoBox}>
              <Image source={require("../../assets/images/logo.png")} style={styles.logoImage} resizeMode="contain" />
              <Text style={styles.logo}>BHOS</Text>
              <Text style={styles.logoSubtitle}>Behavioral Home Operating System</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Set Up Your Account</Text>

              <View style={styles.welcomeBox}>
                <Text style={styles.welcomeText}>Welcome, {inviteData.staffName}!</Text>
                <Text style={styles.welcomeDetail}>Role: {inviteData.role}</Text>
                <Text style={styles.welcomeDetail}>Email: {inviteData.email}</Text>
              </View>

              <Text style={styles.label}>Create Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                placeholder="At least 8 characters"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                onChangeText={setPassword}
                autoComplete="new-password"
              />
              {errors?.fields?.password && (
                <Text style={styles.error}>{errors.fields.password.message}</Text>
              )}

              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                onChangeText={setConfirmPassword}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  (!password || !confirmPassword || fetchStatus === "fetching") && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCreateAccount}
                disabled={!password || !confirmPassword || fetchStatus === "fetching"}
              >
                <Text style={styles.buttonText}>
                  {fetchStatus === "fetching" ? "Creating..." : "Create Account"}
                </Text>
              </Pressable>

              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={() => { setStep("token"); setInviteData(null); }}>
                <Text style={styles.secondaryText}>Use a different code</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBox}>
            <Image source={require("../../assets/images/logo.png")} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.logo}>BHOS</Text>
            <Text style={styles.logoSubtitle}>Behavioral Home Operating System</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Staff Enrollment</Text>
            <Text style={styles.subtitle}>
              Enter the enrollment code provided by your manager to set up your account.
            </Text>

            <Text style={styles.label}>Enrollment Code</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={inviteToken}
              placeholder="Paste your enrollment code"
              placeholderTextColor="#94a3b8"
              onChangeText={(t) => { setInviteToken(t); setInviteError(""); }}
              autoCorrect={false}
            />
            {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!inviteToken.trim() || validating) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleValidateToken}
              disabled={!inviteToken.trim() || validating}
            >
              <Text style={styles.buttonText}>
                {validating ? "Validating..." : "Continue"}
              </Text>
            </Pressable>

            <View style={styles.linkRow}>
              <Text style={styles.linkLabel}>Already enrolled? </Text>
              <Link href="/(auth)/sign-in">
                <Text style={styles.link}>Sign in</Text>
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
  logoSubtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#f1f5f9", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#0f172a", borderWidth: 1, borderColor: "#e2e8f0" },
  error: { color: "#ef4444", fontSize: 13, marginTop: 4 },
  button: { backgroundColor: "#0a7ea4", borderRadius: 10, paddingVertical: 14, marginTop: 20, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  secondaryText: { color: "#0a7ea4", fontSize: 14, fontWeight: "600" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  linkLabel: { color: "#64748b", fontSize: 14 },
  link: { color: "#0a7ea4", fontSize: 14, fontWeight: "600" },
  welcomeBox: { backgroundColor: "#f0f9ff", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#bae6fd" },
  welcomeText: { fontSize: 16, fontWeight: "700", color: "#0a7ea4", marginBottom: 4 },
  welcomeDetail: { fontSize: 13, color: "#64748b" },
});
