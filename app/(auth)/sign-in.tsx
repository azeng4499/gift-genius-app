import { useSignIn } from "@clerk/clerk-expo";
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

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
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
      const attempt = await signIn.create({
        identifier: trimmedEmail,
        password,
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Additional verification is required to sign in.");
      }
    } catch (err: unknown) {
      setError(extractClerkErrorMessage(err, "Sign in failed."));
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

          <Text className="font-noto-serif-bold text-[32px] leading-[38px] text-zinc-900">
            Welcome back
          </Text>
          <Text className="mt-2 text-[15px] leading-relaxed text-zinc-500">
            Sign in to keep finding gifts they’ll love.
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
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="Your password"
            />
          </View>

          <View className="mt-3 flex-row justify-end">
            <Link href="/(auth)/forgot-password" className="text-sm text-zinc-500">
              Forgot password?
            </Link>
          </View>

          {error ? (
            <Text className="mt-4 text-sm text-red-600">{error}</Text>
          ) : null}

          <View className="mt-6">
            <PrimaryButton
              label="Sign in"
              onPress={onSubmit}
              loading={submitting}
              disabled={!isLoaded}
            />
          </View>

          <View className="mt-auto flex-row items-center justify-center gap-1 pt-8">
            <Text className="text-sm text-zinc-500">New here?</Text>
            <Link href="/(auth)/sign-up" className="text-sm font-sf-display-semibold text-zinc-900">
              Create an account
            </Link>
          </View>
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
