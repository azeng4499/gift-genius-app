import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";

import { createGiftGeniusApiClient } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";

export default function HealthTestScreen() {
  const [result, setResult] = useState<string>("Tap run to test /health");
  const api = useMemo(
    () => createGiftGeniusApiClient({ baseUrl: getGiftGeniusApiBaseUrl() }),
    []
  );

  const runHealthCheck = async () => {
    setResult("Running...");
    try {
      const health = await api.getHealth();
      setResult(`OK: ${JSON.stringify(health)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResult(`FAILED: ${message}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        <Text className="text-base text-zinc-700">
          Endpoint: {getGiftGeniusApiBaseUrl()}/health
        </Text>
        <Pressable className="rounded-md bg-black px-4 py-3" onPress={runHealthCheck}>
          <Text className="text-center text-white">Run health check</Text>
        </Pressable>
        <Text className="text-sm text-zinc-700">{result}</Text>
      </View>
    </SafeAreaView>
  );
}
