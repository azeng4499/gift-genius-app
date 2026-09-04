import { memo, useEffect, useMemo, useState } from "react";
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

/** Searchable multi-select of hobbies rendered as toggleable chips.
 *
 * Memoized so an unrelated parent re-render (e.g. typing in a sibling name
 * field) doesn't re-render the full ~200-chip catalog on every keystroke. */
export const HobbyChipPicker = memo(function HobbyChipPicker({
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
            e instanceof Error ? e.message : "Could not load interests.",
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

  // Matches for the dropdown — already-selected interests live inside the combo
  // box, so exclude them here to avoid showing each one twice.
  const dropdownHobbies = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (h) =>
        !selected.has(h.id) && (!q || h.name.toLowerCase().includes(q)),
    );
  }, [catalog, query, selected]);

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
      ],
    );
  }

  function addHobby(hobby: HobbyDto) {
    if (selected.has(hobby.id)) return;
    onChange([...selectedIds, hobby.id]);
    // Clear the query so the user can immediately search for the next one.
    setQuery("");
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
      {/* Combo box: selected interests render as chips alongside the search
          field, so typing and the current selection share one control. Extra
          bottom padding reserves room for the overlaid "N selected" label. */}
      <View
        className={`relative min-h-14 justify-center rounded-xl border border-slate-300 bg-white px-4 ${
          selectedIds.length > 0 ? "py-2.5 pb-6" : ""
        }`}
      >
        <View className="flex-row flex-wrap items-center gap-2">
          {selectedHobbies.map((hobby) => (
            <View
              key={hobby.id}
              className="flex-row items-center gap-1 rounded-full border-2 border-[#1f7a5c] bg-primary/70 py-1.5 pl-3.5 pr-1.5"
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
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={selectedHobbies.length > 0 ? "Add more…" : undefined}
            placeholderTextColor="#94a3b8"
            accessibilityLabel="Search interests"
            className="min-w-[120px] flex-1 p-0 font-sf-rounded-light text-[16px] text-slate-900"
          />
        </View>
        {/* Centered overlay placeholder for the empty state, matching the name
            field (the native placeholder's font-box metrics sit off-center). */}
        {selectedHobbies.length === 0 && query.length === 0 ? (
          <View
            pointerEvents="none"
            className="absolute inset-y-0 left-4 justify-center"
          >
            <Text className="font-sf-rounded-light text-[16px] text-slate-400">
              Search interests…
            </Text>
          </View>
        ) : null}
        {selectedIds.length > 0 ? (
          <Text className="absolute bottom-1.5 right-3 text-[11px] text-slate-400">
            {selectedIds.length} selected
          </Text>
        ) : null}
      </View>

      <ScrollView
        className="max-h-56 rounded-xl border border-slate-300 bg-slate-50"
        contentContainerClassName="flex-row flex-wrap gap-2 p-3"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {dropdownHobbies.length === 0 ? (
          <Text className="p-1 text-sm text-slate-500">
            {query.trim() ? "No matches." : "All interests added."}
          </Text>
        ) : (
          dropdownHobbies.map((hobby) => (
            <Pressable
              key={hobby.id}
              onPress={() => addHobby(hobby)}
              accessibilityRole="button"
              accessibilityLabel={hobby.name}
              className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5"
            >
              <Text className="font-sf-display-medium text-sm text-slate-700">
                {hobby.name}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
});
