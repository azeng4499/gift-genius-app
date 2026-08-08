import { AuthInput } from "@/components/ui/auth-input";
import { CtaButton } from "@/components/ui/cta-button";
import { Text } from "@/components/ui/text";
import { TermsNotice } from "@/components/ui/terms-notice";
import { getSignInErrorMessage } from "@/lib/clerk-errors";
import { useSignIn } from "@clerk/clerk-expo";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { AlertCircleIcon } from "lucide-react-native";
import * as React from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const passwordInputRef = React.useRef<TextInput>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit() {
    if (!isLoaded || submitting) return;
    const identifier = email.trim();
    if (!identifier || !password || !EMAIL_REGEX.test(identifier)) {
      setError("Invalid email or password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier, password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Additional verification is required to sign in.");
      }
    } catch (err) {
      setError(getSignInErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Pressable className="px-6 pt-2" onPress={Keyboard.dismiss} accessible={false}>
      <View>
        <Text
          className="text-left text-xl text-slate-700"
          fontStyle="noto-serif-bold"
        >
          Welcome back!
        </Text>
        <Text className="text-left pb-6 pt-1 px-1" fontStyle="sf-display-light">
          Let's get searching for gifts they’ll love.
        </Text>
      </View>

      <View>
        {error ? (
          <View className="flex-row items-center gap-2 w-full mb-2">
            <AlertCircleIcon color="#ef4444" size={16} />
            <Text className="text-red-500 text-sm" fontStyle="sf-display-medium">
              {error}
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          <AuthInput
            InputComponent={BottomSheetTextInput}
            className={error ? "border-red-500" : undefined}
            placeholder="Email"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          <AuthInput
            ref={passwordInputRef}
            InputComponent={BottomSheetTextInput}
            className={error ? "border-red-500" : undefined}
            placeholder="Password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>

        <View className="w-full items-end mt-2 mb-10 px-1">
          <Text fontStyle="sf-display-thin" className="underline text-sm">
            Forgot Password?
          </Text>
        </View>

        <CtaButton label="Sign In" loading={submitting} onPress={onSubmit} />
        <TermsNotice className="mt-4 text-black" />
      </View>
    </Pressable>
  );
}
