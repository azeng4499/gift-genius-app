import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import "../global.css";
import "../lib/nativewind-interop";

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

  if (!loaded) return null;

  return (
    <GestureHandlerRootView className="flex-1">
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
