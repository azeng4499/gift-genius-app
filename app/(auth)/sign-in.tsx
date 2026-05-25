import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";

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
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        <Text className="text-xl font-noto-serif-bold">Welcome back</Text>
        <Text className="text-sm text-zinc-600">
          Sign in to keep swiping on gifts.
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

        <LabeledFeedField label="Password">
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="Your password"
            accessibilityLabel="Password"
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </LabeledFeedField>

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !isLoaded}
          className="rounded-md bg-black px-4 py-3"
          style={{ opacity: submitting || !isLoaded ? 0.6 : 1 }}
        >
          <Text className="text-center text-white">
            {submitting ? "Signing in..." : "Sign in"}
          </Text>
        </Pressable>

        <View className="flex-row items-center justify-center gap-1 pt-2">
          <Text className="text-sm text-zinc-600">No account?</Text>
          <Link
            href="/(auth)/sign-up"
            className="text-sm text-zinc-900 underline"
          >
            Create one
          </Link>
        </View>
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
