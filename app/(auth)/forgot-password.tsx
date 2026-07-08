import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Gift } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui/primary-button";
import { TextField } from "@/components/ui/text-field";

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pendingReset, setPendingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onRequestCode = async () => {
    if (!isLoaded) return;
    const trimmedEmail = emailAddress.trim();
    if (!trimmedEmail) {
      setError("Enter the email on your account.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: trimmedEmail,
      });
      setPendingReset(true);
    } catch (err: unknown) {
      setError(extractClerkErrorMessage(err, "Could not send the reset code."));
    } finally {
      setSubmitting(false);
    }
  };

  const onResetPassword = async () => {
    if (!isLoaded) return;
    const trimmedCode = code.trim();
    if (!trimmedCode || !newPassword) {
      setError("Code and a new password are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: trimmedCode,
        password: newPassword,
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Reset incomplete. Try a stronger password or request a new code.");
      }
    } catch (err: unknown) {
      setError(extractClerkErrorMessage(err, "Password reset failed."));
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

          {pendingReset ? (
            <>
              <Text className="font-noto-serif-bold text-[32px] leading-[38px] text-zinc-900">
                Set a new password
              </Text>
              <Text className="mt-2 text-[15px] leading-relaxed text-zinc-500">
                We sent a code to {emailAddress.trim()}. Enter it with your new
                password to sign back in.
              </Text>

              <View className="mt-8 gap-4">
                <TextField
                  label="Verification code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  placeholder="123456"
                />
                <TextField
                  label="New password"
                  hint="At least 8 characters."
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Choose a new password"
                />
              </View>

              {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}

              <View className="mt-6 gap-3">
                <PrimaryButton
                  label="Reset password"
                  onPress={onResetPassword}
                  loading={submitting}
                  disabled={!isLoaded}
                />
                <Pressable
                  onPress={() => {
                    setPendingReset(false);
                    setCode("");
                    setNewPassword("");
                    setError(null);
                  }}
                  disabled={submitting}
                  className="items-center py-1"
                >
                  <Text className="text-sm text-zinc-500">Use a different email</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text className="font-noto-serif-bold text-[32px] leading-[38px] text-zinc-900">
                Reset your password
              </Text>
              <Text className="mt-2 text-[15px] leading-relaxed text-zinc-500">
                Enter the email on your account and we’ll send a code to set a new
                password.
              </Text>

              <View className="mt-8">
                <TextField
                  label="Email"
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                />
              </View>

              {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}

              <View className="mt-6">
                <PrimaryButton
                  label="Send reset code"
                  onPress={onRequestCode}
                  loading={submitting}
                  disabled={!isLoaded}
                />
              </View>

              <View className="mt-auto flex-row items-center justify-center gap-1 pt-8">
                <Text className="text-sm text-zinc-500">Remembered it?</Text>
                <Link href="/(auth)/sign-in" className="text-sm font-sf-display-semibold text-zinc-900">
                  Back to sign in
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
