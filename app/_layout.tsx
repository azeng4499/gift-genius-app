import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { useFonts } from "expo-font";
import { ThemeProvider } from "expo-router/react-navigation";
import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { ToastProvider } from "@/components/ui/toast";
import { registerClerkTokenGetter } from "@/lib/api/token";
import { DEV_MODE } from "@/lib/dev-mode";
import { NAV_THEME } from "@/lib/theme";

import "../global.css";
import "../lib/nativewind-interop";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to .env.local."
  );
}

function BindToken() {
  const { getToken } = useAuth();
  useEffect(() => {
    registerClerkTokenGetter(async () => (await getToken()) ?? null);
  }, [getToken]);
  return null;
}

function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();

  // Wait for Clerk to resolve before rendering any route. This is the key to the
  // gate: until we know the answer, signed-in users mustn't flash the auth
  // screen and signed-out users mustn't mount the feed (which would start
  // bootstrapping and show its loading screen).
  if (!DEV_MODE && !isLoaded) return null;

  const signedIn = DEV_MODE || isSignedIn === true;

  // Stack.Protected removes the guarded-out screens from the navigation tree, so
  // an unauthenticated cold start can only ever land on the auth stack — the
  // feed never mounts until the user is signed in. No post-render redirect race.
  return (
    <Stack>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="feed/new" options={{ title: "Add Feed Person" }} />
        <Stack.Screen name="feed/settings" options={{ title: "Feed settings" }} />
        <Stack.Screen name="feed/start" options={{ title: "Start a feed" }} />
        <Stack.Screen name="feed/edit" options={{ title: "Edit feed" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    "SFPro-Display-Medium": require("../assets/fonts/SFPRODISPLAYMEDIUM.otf"),
    "SFPro-Display-Light": require("../assets/fonts/SFPRODISPLAYLIGHT.otf"),
    "SFPro-Display-Regular": require("../assets/fonts/SFPRODISPLAYREGULAR.otf"),
    "SFPro-Display-Semibold": require("../assets/fonts/SFPRODISPLAYSEMIBOLD.otf"),
    "SFPro-Display-Bold": require("../assets/fonts/SFPRODISPLAYBOLD.otf"),
    "SFPro-Display-Thin": require("../assets/fonts/SFPRODISPLAYTHIN.otf"),
    "SFPro-Display-UltraLight": require("../assets/fonts/SFPRODISPLAYULTRALIGHT.otf"),
    "SFPro-Rounded-Medium": require("../assets/fonts/SFPROROUNDEDMEDIUM.otf"),
    "SFPro-Rounded-Regular": require("../assets/fonts/SFPROROUNDEDREGULAR.otf"),
    "SFPro-Rounded-Semibold": require("../assets/fonts/SFPROROUNDEDSEMIBOLD.otf"),
    "SFPro-Rounded-Bold": require("../assets/fonts/SFPROROUNDEDBOLD.otf"),
    "SFPro-Rounded-Light": require("../assets/fonts/SFPROROUNDEDLIGHT.otf"),
    "SFPro-Rounded-Thin": require("../assets/fonts/SFPROROUNDEDTHIN.otf"),
    "SFPro-Rounded-UltraLight": require("../assets/fonts/SFPROROUNDEDULTRALIGHT.otf"),
    "NotoSerif-Medium": require("../assets/fonts/NOTOSERIFMEDIUM.ttf"),
    "NotoSerif-Bold": require("../assets/fonts/NOTOSERIFBOLD.ttf"),
    "NotoSerif-SemiBold": require("../assets/fonts/NOTOSERIFSEMIBOLD.ttf"),
  });

  const { colorScheme } = useColorScheme();

  if (!loaded) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <BindToken />
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
              <ToastProvider>
                <AuthGate />
              </ToastProvider>
              <PortalHost />
            </ThemeProvider>
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
