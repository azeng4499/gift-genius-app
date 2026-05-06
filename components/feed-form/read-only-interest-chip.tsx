import { Hash } from "lucide-react-native";
import { Text, View } from "react-native";

export function ReadOnlyInterestChip({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-0.5 rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1">
      <Hash size={12} color="#3f3f46" strokeWidth={1.5} />
      <Text className="text-sm text-zinc-700">{label}</Text>
    </View>
  );
}
