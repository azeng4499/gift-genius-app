import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";

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
      // Asking Clerk to email a one-time code starts a fresh signIn
      // attempt under the reset-password strategy. The next step uses
      // attemptFirstFactor to consume the code together with the new
      // password — Clerk validates both atomically.
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
        // E.g. status === "needs_new_password" if the password didn't
        // pass Clerk's policy. Surface a friendly message and let the
        // user retry.
        setError("Reset incomplete. Try a stronger password or request a new code.");
      }
    } catch (err: unknown) {
      setError(extractClerkErrorMessage(err, "Password reset failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        {pendingReset ? (
          <>
            <Text className="text-xl font-noto-serif-bold">
              Set a new password
            </Text>
            <Text className="text-sm text-zinc-600">
              We sent a code to {emailAddress.trim()}. Enter it with your new
              password to sign back in.
            </Text>

            <LabeledFeedField label="Verification code">
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="123456"
                accessibilityLabel="Verification code"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>

            <LabeledFeedField
              label="New password"
              hint="At least 8 characters with a mix of letters and numbers."
            >
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="Choose a new password"
                accessibilityLabel="New password"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>

            {error ? (
              <Text className="text-sm text-red-600">{error}</Text>
            ) : null}

            <Pressable
              onPress={onResetPassword}
              disabled={submitting || !isLoaded}
              className="rounded-md bg-black px-4 py-3"
              style={{ opacity: submitting || !isLoaded ? 0.6 : 1 }}
            >
              <Text className="text-center text-white">
                {submitting ? "Updating…" : "Reset password"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setPendingReset(false);
                setCode("");
                setNewPassword("");
                setError(null);
              }}
              disabled={submitting}
              className="pt-1"
            >
              <Text className="text-center text-sm text-zinc-600 underline">
                Use a different email
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text className="text-xl font-noto-serif-bold">
              Reset your password
            </Text>
            <Text className="text-sm text-zinc-600">
              Enter the email on your account. We&apos;ll send you a code to
              set a new password.
            </Text>

            <LabeledFeedField label="Email">
              <TextInput
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                accessibilityLabel="Email"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>

            {error ? (
              <Text className="text-sm text-red-600">{error}</Text>
            ) : null}

            <Pressable
              onPress={onRequestCode}
              disabled={submitting || !isLoaded}
              className="rounded-md bg-black px-4 py-3"
              style={{ opacity: submitting || !isLoaded ? 0.6 : 1 }}
            >
              <Text className="text-center text-white">
                {submitting ? "Sending code…" : "Send reset code"}
              </Text>
            </Pressable>

            <View className="flex-row items-center justify-center gap-1 pt-2">
              <Text className="text-sm text-zinc-600">Remembered it?</Text>
              <Link
                href="/(auth)/sign-in"
                className="text-sm text-zinc-900 underline"
              >
                Back to sign in
              </Link>
            </View>
          </>
        )}
      </View>
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
