import * as SecureStore from "expo-secure-store";

// Session token storage. Persisted in the OS keychain via SecureStore, mirrored
// in memory so the API client's synchronous getToken() can read it.

const KEY = "astra_session_token";
let cachedToken: string | null = null;

/** Load the persisted token into memory. Call once at app boot. */
export async function loadToken(): Promise<string | null> {
  cachedToken = await SecureStore.getItemAsync(KEY);
  return cachedToken;
}

/** Synchronous read of the in-memory token (used by the API client). */
export function getToken(): string | null {
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(KEY);
}
