import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { SignInForm } from "@/components/sign-in-form";
import { SignUpForm } from "@/components/sign-up-form";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { Text as RNRText } from "@/components/ui/text";
import { SocialConnections } from "@/components/social-connections";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { SheetBackground } from "@/components/ui/sheet-background";
import { CtaButton } from "@/components/ui/cta-button";
import { TermsNotice } from "@/components/ui/terms-notice";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const BACKGROUND_VIDEO = require("../../assets/videos/login-bg.mp4");

export function AuthScreen() {
  const player = useVideoPlayer(BACKGROUND_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // Bumped when the sheet closes so the form remounts with cleared inputs/errors.
  const [formKey, setFormKey] = useState(0);

  const handleClose = useCallback(() => setFormKey((k) => k + 1), []);

  const openSignIn = useCallback(() => {
    setMode("signin");
    sheetRef.current?.expand();
  }, []);
  const openSignUp = useCallback(() => {
    setMode("signup");
    sheetRef.current?.expand();
  }, []);
  const closeSheet = useCallback(() => sheetRef.current?.close(), []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />

      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.85)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="h-full flex justify-end pb-8">
            <View className="flex justify-center items-center gap-4 px-6">
              <CtaButton label="Sign in with Password" onPress={openSignIn} />
              <View className="flex-row items-center">
                <Separator className="flex-1" />
                <Text className="px-4 text-sm text-white">or</Text>
                <Separator className="flex-1" />
              </View>
              <SocialConnections />
              <TermsNotice
                className="mt-2 text-white/80"
                linkClassName="text-white"
              />
              <View className="flex justify-center items-center w-full gap-3 flex-row pt-10">
                <RNRText
                  variant="small"
                  className="text-white"
                  fontStyle="sf-display-semibold"
                >
                  Don't have an account?
                </RNRText>
                <Pressable onPress={openSignUp}>
                  <RNRText
                    variant="small"
                    className="text-white underline"
                    fontStyle="sf-display-regular"
                  >
                    Create one
                  </RNRText>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        enableDynamicSizing={mode === "signin"}
        snapPoints={mode === "signup" ? ["100%"] : undefined}
        enablePanDownToClose
        overDragResistanceFactor={0}
        keyboardBehavior="fillParent"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        topInset={insets.top}
        onClose={handleClose}
        backdropComponent={renderBackdrop}
        backgroundComponent={SheetBackground}
        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
      >
        <BottomSheetView style={{ paddingBottom: insets.bottom + 16 }}>
          <Pressable
            onPress={closeSheet}
            hitSlop={12}
            className="self-end p-1"
            accessibilityRole="button"
            accessibilityLabel="Close"
          ></Pressable>
          {mode === "signin" ? (
            <SignInForm key={formKey} />
          ) : (
            <SignUpForm key={formKey} />
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
