import { ThemedText } from "@/components/themed-text";
import { Hash } from "lucide-react-native";
import { View } from "react-native";
const ProductCardChip = ({ label }: { label: string }) => {
  return (
    <View className="flex-row items-center gap-0.5 px-2.5 py-1 rounded-full border border-zinc-300 bg-zinc-50">
      <Hash size={12} color="#3f3f46" strokeWidth={1.5} />
      <ThemedText className="text-sm text-zinc-700">{label}</ThemedText>
    </View>
  );
};

export default ProductCardChip;
