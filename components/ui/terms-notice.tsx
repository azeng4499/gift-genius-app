import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Linking, View } from "react-native";

const TERMS_URL = "https://giftgenius.app/terms";
const PRIVACY_URL = "https://giftgenius.app/privacy";

// Legal line shown under the auth actions. The bolded "Terms of Use" and
// "Privacy Policy" are tappable links. `className` sets the base text color so
// the same component works on both the dark auth screen and the light sheet;
// the links inherit that color and add an underline.
export function TermsNotice({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <View className="w-full items-center justify-center">
      <Text
        className={cn("text-center text-[10px]", className)}
        fontStyle="sf-display-regular"
      >
        By signing in, you agree to GiftGenius's{" "}
        <Text
          className={cn("text-[10px] underline", linkClassName)}
          fontStyle="sf-display-semibold"
          onPress={() => Linking.openURL(TERMS_URL)}
        >
          Terms of Use
        </Text>{" "}
        &{" "}
        <Text
          className={cn("text-[10px] underline", linkClassName)}
          fontStyle="sf-display-semibold"
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}
