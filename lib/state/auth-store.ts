import * as SecureStore from "expo-secure-store";

const JWT_KEY = "giftgenius_jwt";

export async function getStoredJwt(): Promise<string | null> {
  return SecureStore.getItemAsync(JWT_KEY);
}

export async function setStoredJwt(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(JWT_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(JWT_KEY);
  }
}

export async function clearStoredJwt(): Promise<void> {
  await SecureStore.deleteItemAsync(JWT_KEY);
}
