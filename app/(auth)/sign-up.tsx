import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { SsoButton } from "@/components/auth/sso-button";
import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";

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
      await signUp.create({
        emailAddress: trimmedEmail,
        password,
      });
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
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
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        {pendingVerification ? (
          <>
            <Text className="text-xl font-noto-serif-bold">
              Verify your email
            </Text>
            <Text className="text-sm text-zinc-600">
              We sent a code to {emailAddress.trim()}. Enter it below to finish
              creating your account.
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

            {error ? (
              <Text className="text-sm text-red-600">{error}</Text>
            ) : null}

            <Pressable
              onPress={onVerify}
              disabled={submitting || !isLoaded}
              className="rounded-md bg-black px-4 py-3"
              style={{ opacity: submitting || !isLoaded ? 0.6 : 1 }}
            >
              <Text className="text-center text-white">
                {submitting ? "Verifying..." : "Verify and continue"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text className="text-xl font-noto-serif-bold">
              Create your account
            </Text>
            <Text className="text-sm text-zinc-600">
              Sign up to save gift ideas and personalize your feeds.
            </Text>

            <View className="gap-2 pt-1">
              <SsoButton
                strategy="oauth_apple"
                label="Continue with Apple"
                onError={setError}
              />
              <SsoButton
                strategy="oauth_google"
                label="Continue with Google"
                onError={setError}
              />
            </View>

            <View className="my-1 flex-row items-center gap-2">
              <View className="h-px flex-1 bg-zinc-200" />
              <Text className="text-xs uppercase tracking-wide text-zinc-400">
                or
              </Text>
              <View className="h-px flex-1 bg-zinc-200" />
            </View>

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

            <LabeledFeedField
              label="Password"
              hint="At least 8 characters with a mix of letters and numbers."
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="Choose a password"
                accessibilityLabel="Password"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>

            {error ? (
              <Text className="text-sm text-red-600">{error}</Text>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={submitting || !isLoaded}
              className="rounded-md bg-black px-4 py-3"
              style={{ opacity: submitting || !isLoaded ? 0.6 : 1 }}
            >
              <Text className="text-center text-white">
                {submitting ? "Creating account..." : "Sign up"}
              </Text>
            </Pressable>

            <View className="flex-row items-center justify-center gap-1 pt-2">
              <Text className="text-sm text-zinc-600">
                Already have an account?
              </Text>
              <Link
                href="/(auth)/sign-in"
                className="text-sm text-zinc-900 underline"
              >
                Sign in
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
