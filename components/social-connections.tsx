import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSSO } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { ActivityIndicator, Image, View } from "react-native";

// Clerk's OAuth strategies we support. Typed locally to avoid depending on
// @clerk/types directly; this narrow union is assignable to startSSOFlow's param.
type OAuthStrategy = "oauth_apple" | "oauth_google";

// Ensure the auth session can complete when the browser redirects back.
WebBrowser.maybeCompleteAuthSession();

const SOCIAL_CONNECTION_STRATEGIES: {
  type: OAuthStrategy;
  source: { uri: string };
  useTint: boolean;
}[] = [
  {
    type: "oauth_apple",
    source: { uri: "https://img.clerk.com/static/apple.png?width=160" },
    useTint: true,
  },
  {
    type: "oauth_google",
    source: { uri: "https://img.clerk.com/static/google.png?width=160" },
    useTint: false,
  },
];

// Visual tone for the buttons. "light" suits a dark background (white icons),
// "dark" suits a light background (black icons).
type Tone = "light" | "dark";

const TONES: Record<
  Tone,
  {
    border: string;
    tint: string;
    pressedTint: string;
    pressedBg: string;
    spinner: string;
  }
> = {
  light: {
    border: "border-white/30",
    tint: "white",
    pressedTint: "black",
    // Override the ghost variant's active background (accent) for this tone.
    pressedBg: "active:bg-white dark:active:bg-white",
    spinner: "white",
  },
  dark: {
    border: "border-black/20",
    tint: "black",
    pressedTint: "white",
    pressedBg: "active:bg-black dark:active:bg-black",
    spinner: "black",
  },
};

// Warms up the browser on Android for a snappier OAuth handoff (no-op on iOS).
function useWarmUpBrowser() {
  React.useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export function SocialConnections({ tone = "light" }: { tone?: Tone }) {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [pending, setPending] = React.useState<OAuthStrategy | null>(null);
  const [pressed, setPressed] = React.useState<OAuthStrategy | null>(null);
  const colors = TONES[tone];

  const onPress = React.useCallback(
    async (strategy: OAuthStrategy) => {
      if (pending) return;
      setPending(strategy);
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: AuthSession.makeRedirectUri(),
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/");
        }
      } catch (err) {
        console.error("SSO sign-in failed", err);
      } finally {
        setPending(null);
      }
    },
    [pending, startSSOFlow, router]
  );

  return (
    <View className="flex-row gap-3">
      {SOCIAL_CONNECTION_STRATEGIES.map((strategy) => (
        <Button
          key={strategy.type}
          variant="ghost"
          size="lg"
          className={cn(
            "flex-1 rounded-full border",
            colors.border,
            colors.pressedBg
          )}
          disabled={pending !== null}
          onPress={() => onPress(strategy.type)}
          onPressIn={() => setPressed(strategy.type)}
          onPressOut={() => setPressed(null)}
        >
          {pending === strategy.type ? (
            <ActivityIndicator color={colors.spinner} />
          ) : (
            <Image
              className="size-5"
              source={strategy.source}
              tintColor={
                strategy.useTint
                  ? pressed === strategy.type
                    ? colors.pressedTint
                    : colors.tint
                  : undefined
              }
            />
          )}
        </Button>
      ))}
    </View>
  );
}
