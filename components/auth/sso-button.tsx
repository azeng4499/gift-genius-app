import { useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

// Must run at module top so the in-app browser session can complete when
// the OAuth provider redirects back via the deep link.
WebBrowser.maybeCompleteAuthSession();

type Strategy = "oauth_google" | "oauth_apple";

type SsoButtonProps = {
  strategy: Strategy;
  label: string;
  onError?: (message: string) => void;
};

export function SsoButton({ strategy, label, onError }: SsoButtonProps) {
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    setBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        // Linking.createURL resolves to `exp://...` in Expo Go and
        // `giftgeniusapp://oauth-callback` in a standalone binary, so the
        // same code works across dev and production.
        redirectUrl: Linking.createURL("oauth-callback"),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // AuthGate (root layout) routes us to "/" once isSignedIn flips.
      }
      // If createdSessionId is null the user dismissed the browser sheet;
      // treat that as a silent cancel, not an error.
    } catch (err: unknown) {
      const message = extractSsoErrorMessage(err);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="rounded-md border border-zinc-300 px-4 py-3"
      style={{ opacity: busy ? 0.6 : 1 }}
    >
      {busy ? (
        <ActivityIndicator color="#18181b" />
      ) : (
        <Text className="text-center text-zinc-900">{label}</Text>
      )}
    </Pressable>
  );
}

function extractSsoErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "errors" in err) {
    const errors = (err as { errors?: { longMessage?: string; message?: string }[] }).errors;
    const first = errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (err instanceof Error) return err.message;
  return "Sign-in failed.";
}
