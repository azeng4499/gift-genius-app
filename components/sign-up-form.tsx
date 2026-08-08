import { AuthInput } from "@/components/ui/auth-input";
import { CtaButton } from "@/components/ui/cta-button";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { TermsNotice } from "@/components/ui/terms-notice";
import { SocialConnections } from "@/components/social-connections";
import { getClerkErrorMessage } from "@/lib/clerk-errors";
import { useSignUp } from "@clerk/clerk-expo";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { AlertCircleIcon } from "lucide-react-native";
import * as React from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

function ErrorRow({ message }: { message: string }) {
  return (
    <View className="flex-row items-center gap-2 w-full mb-2">
      <AlertCircleIcon color="#ef4444" size={16} />
      <Text className="text-red-500 text-sm" fontStyle="sf-display-medium">
        {message}
      </Text>
    </View>
  );
}

export function SignUpForm() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const emailInputRef = React.useRef<TextInput>(null);
  const passwordInputRef = React.useRef<TextInput>(null);
  const confirmInputRef = React.useRef<TextInput>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Email verification step (Clerk requires a code before the account is live).
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");

  async function onSubmit() {
    if (!isLoaded || submitting) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signUp.create({
        emailAddress: trimmedEmail,
        password,
        firstName: trimmedName,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign up failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerify() {
    if (!isLoaded || submitting) return;
    if (!code.trim()) {
      setError("Enter the code we sent to your email.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("That code didn't work. Please try again.");
      }
    } catch (err) {
      setError(getClerkErrorMessage(err, "Invalid or expired code."));
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingVerification) {
    return (
      <Pressable
        className="px-6 pt-2"
        onPress={Keyboard.dismiss}
        accessible={false}
      >
        <View>
          <Text
            className="text-left text-xl text-slate-700"
            fontStyle="noto-serif-bold"
          >
            Check your email
          </Text>
          <Text className="text-left pb-6 pt-1 px-1" fontStyle="sf-display-light">
            Enter the code we sent to {email.trim()}.
          </Text>
        </View>

        <View>
          {error ? <ErrorRow message={error} /> : null}
          <AuthInput
            InputComponent={BottomSheetTextInput}
            className={error ? "border-red-500" : undefined}
            placeholder="Verification code"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            value={code}
            onChangeText={setCode}
            returnKeyType="go"
            onSubmitEditing={onVerify}
          />
          <CtaButton
            label="Verify"
            loading={submitting}
            onPress={onVerify}
            className="mt-6"
          />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable className="px-6 pt-2" onPress={Keyboard.dismiss} accessible={false}>
      <View>
        <Text
          className="text-left text-xl text-slate-700"
          fontStyle="noto-serif-bold"
        >
          Welcome to GiftGenius!
        </Text>
        <Text className="text-left pb-6 pt-1 px-1" fontStyle="sf-display-light">
          Let's get searching for gifts they’ll love.
        </Text>
      </View>

      <View>
        {error ? <ErrorRow message={error} /> : null}

        <View className="gap-3">
          <AuthInput
            InputComponent={BottomSheetTextInput}
            className={error ? "border-red-500" : undefined}
            placeholder="Name"
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailInputRef.current?.focus()}
          />
          <AuthInput
            ref={emailInputRef}
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
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmInputRef.current?.focus()}
          />
          <AuthInput
            ref={confirmInputRef}
            InputComponent={BottomSheetTextInput}
            className={error ? "border-red-500" : undefined}
            placeholder="Re-enter Password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>

        <View className="items-center gap-4">
          <CtaButton
            label="Sign Up"
            loading={submitting}
            onPress={onSubmit}
            className="mt-10"
          />
          <View className="flex-row items-center w-full">
            <Separator className="flex-1 bg-black/20" />
            <Text className="px-4 text-sm text-black">or</Text>
            <Separator className="flex-1 bg-black/20" />
          </View>
          <SocialConnections tone="dark" />
          <TermsNotice className="mt-4 text-black" />
        </View>
      </View>
    </Pressable>
  );
}
