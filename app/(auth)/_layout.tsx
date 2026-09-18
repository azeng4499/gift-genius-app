import { Stack } from "expo-router";

// Land on sign-in when the auth group is entered (e.g. after the gate redirects
// an unauthenticated user), rather than whichever screen resolves first.
export const unstable_settings = {
  initialRouteName: "sign-in",
};

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
