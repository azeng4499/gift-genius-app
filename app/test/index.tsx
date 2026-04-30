import { Link } from "expo-router";
import { Pressable, SafeAreaView, Text, View } from "react-native";

function NavButton({ href, label }: { href: "/test/health" | "/test/bootstrap" | "/test/feed"; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable className="rounded-md border border-zinc-300 px-4 py-3">
        <Text className="text-base text-zinc-800">{label}</Text>
      </Pressable>
    </Link>
  );
}

export default function TestMenuScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        <Text className="text-xl font-noto-serif-bold">Integration Task Screens</Text>
        <Text className="text-sm text-zinc-600">
          Run each task in isolation to validate API integration steps.
        </Text>

        <NavButton href="/test/health" label="Task 1: Health Check" />
        <NavButton href="/test/bootstrap" label="Task 2: User + Feed Bootstrap" />
        <NavButton href="/test/feed" label="Task 3: Feed Loop Actions" />
      </View>
    </SafeAreaView>
  );
}
