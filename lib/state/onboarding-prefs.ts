import * as SecureStore from "expo-secure-store";

const FEED_CONTROLS_TIP_KEY = "gg_feed_controls_tip_seen";

export async function hasSeenFeedControlsTip(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(FEED_CONTROLS_TIP_KEY);
  return value === "1";
}

export async function markFeedControlsTipSeen(): Promise<void> {
  await SecureStore.setItemAsync(FEED_CONTROLS_TIP_KEY, "1");
}
