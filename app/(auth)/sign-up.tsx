import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Gift } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SsoButton } from "@/components/auth/sso-button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { TextField } from "@/components/ui/text-field";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!isLoaded) return;
    const trimmedEmail = emailAddress.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: trimmedEmail, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      setError(extractClerkErrorMessage(err, "Sign up failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Enter the code from your email.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: trimmedCode,
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Verification incomplete. Try resending the code.");
      }
    } catch (err: unknown) {
      setError(extractClerkErrorMessage(err, "Verification failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-6 pt-8 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-10 h-12 w-12 items-center justify-center rounded-2xl bg-[#1f7a5c]">
            <Gift size={24} color="white" strokeWidth={2} />
          </View>

          {pendingVerification ? (
            <>
              <Text className="font-noto-serif-bold text-[32px] leading-[38px] text-zinc-900">
                Check your email
              </Text>
              <Text className="mt-2 text-[15px] leading-relaxed text-zinc-500">
                We sent a 6-digit code to {emailAddress.trim()}. Enter it below to
                finish setting up.
              </Text>

              <View className="mt-8">
                <TextField
                  label="Verification code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  placeholder="123456"
                />
              </View>

              {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}

              <View className="mt-6">
                <PrimaryButton
                  label="Verify and continue"
                  onPress={onVerify}
                  loading={submitting}
                  disabled={!isLoaded}
                />
              </View>
            </>
          ) : (
            <>
              <Text className="font-noto-serif-bold text-[32px] leading-[38px] text-zinc-900">
                Create your account
              </Text>
              <Text className="mt-2 text-[15px] leading-relaxed text-zinc-500">
                Find thoughtful gifts for everyone on your list.
              </Text>

              <View className="mt-8 gap-3">
                <SsoButton strategy="oauth_apple" label="Continue with Apple" onError={setError} />
                <SsoButton strategy="oauth_google" label="Continue with Google" onError={setError} />
              </View>

              <View className="my-6 flex-row items-center gap-3">
                <View className="h-px flex-1 bg-zinc-200" />
                <Text className="text-xs uppercase tracking-widest text-zinc-400">or</Text>
                <View className="h-px flex-1 bg-zinc-200" />
              </View>

              <View className="gap-4">
                <TextField
                  label="Email"
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                />
                <TextField
                  label="Password"
                  hint="At least 8 characters."
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Choose a password"
                />
              </View>

              {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}

              <View className="mt-6">
                <PrimaryButton
                  label="Create account"
                  onPress={onSubmit}
                  loading={submitting}
                  disabled={!isLoaded}
                />
              </View>

              <View className="mt-auto flex-row items-center justify-center gap-1 pt-8">
                <Text className="text-sm text-zinc-500">Already have an account?</Text>
                <Link href="/(auth)/sign-in" className="text-sm font-sf-display-semibold text-zinc-900">
                  Sign in
                </Link>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function extractClerkErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "errors" in err) {
    const errors = (err as { errors?: { longMessage?: string; message?: string }[] }).errors;
    const first = errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
