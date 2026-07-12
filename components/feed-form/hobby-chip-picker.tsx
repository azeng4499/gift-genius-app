import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import { getApiClient } from "@/lib/api";
import type { HobbyDto } from "@/lib/api/client";
import { ensureHobbyCatalog } from "@/lib/api/hobbies";

type HobbyChipPickerProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** When true, confirm before removing a selected interest (feed settings). */
  confirmOnRemove?: boolean;
};

/** Searchable multi-select of hobbies rendered as toggleable chips. */
export function HobbyChipPicker({
  selectedIds,
  onChange,
  confirmOnRemove = false,
}: HobbyChipPickerProps) {
  const api = useMemo(() => getApiClient(), []);
  const [catalog, setCatalog] = useState<HobbyDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const hobbies = await ensureHobbyCatalog(api);
        if (active) setCatalog(hobbies);
      } catch (e) {
        if (active) {
          setLoadError(
            e instanceof Error ? e.message : "Could not load interests."
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [api]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedHobbies = useMemo(() => {
    if (!catalog) return [];
    const byId = new Map(catalog.map((h) => [h.id, h]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((h): h is HobbyDto => h != null);
  }, [catalog, selectedIds]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((h) => h.name.toLowerCase().includes(q));
  }, [catalog, query]);

  function applyRemove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function confirmAndRemove(hobby: HobbyDto) {
    if (!confirmOnRemove) {
      applyRemove(hobby.id);
      return;
    }

    Alert.alert(
      `Remove ${hobby.name}?`,
      "You won't see gift ideas for this interest until you add it back in settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => applyRemove(hobby.id),
        },
      ]
    );
  }

  function toggle(hobby: HobbyDto) {
    if (selected.has(hobby.id)) {
      confirmAndRemove(hobby);
    } else {
      onChange([...selectedIds, hobby.id]);
    }
  }

  if (loadError) {
    return <Text className="text-sm text-red-600">{loadError}</Text>;
  }

  if (!catalog) {
    return (
      <View className="flex-row items-center gap-2 py-2">
        <ActivityIndicator />
        <Text className="text-sm text-zinc-500">Loading interests…</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search interests…"
        placeholderTextColor="#a1a1aa"
        accessibilityLabel="Search interests"
        className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-sf-display-regular text-[15px] text-zinc-900"
      />
      {selectedHobbies.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {selectedHobbies.map((hobby) => (
            <View
              key={hobby.id}
              className="flex-row items-center gap-1 rounded-full border border-[#1f7a5c] bg-[#1f7a5c] py-1.5 pl-3.5 pr-1.5"
            >
              <Text className="font-sf-display-medium text-sm text-white">
                {hobby.name}
              </Text>
              <Pressable
                onPress={() => confirmAndRemove(hobby)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${hobby.name}`}
                hitSlop={8}
                className="rounded-full p-0.5 active:opacity-70"
              >
                <X size={14} color="white" strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ScrollView
        className="max-h-56 rounded-2xl border border-zinc-200 bg-zinc-50"
        contentContainerClassName="flex-row flex-wrap gap-2 p-3"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {filtered.length === 0 ? (
          <Text className="p-1 text-sm text-zinc-500">No matches.</Text>
        ) : (
          filtered.map((hobby) => {
            const isSelected = selected.has(hobby.id);
            return (
              <Pressable
                key={hobby.id}
                onPress={() => toggle(hobby)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={hobby.name}
                className={`rounded-full border px-3.5 py-1.5 ${
                  isSelected
                    ? "border-[#1f7a5c] bg-[#1f7a5c]"
                    : "border-zinc-300 bg-white"
                }`}
              >
                <Text
                  className={`font-sf-display-medium text-sm ${
                    isSelected ? "text-white" : "text-zinc-700"
                  }`}
                >
                  {hobby.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Text className="text-[13px] text-zinc-500">
        {selectedIds.length > 0
          ? `${selectedIds.length} selected`
          : "Tap to select a few interests."}
      </Text>
    </View>
  );
}
