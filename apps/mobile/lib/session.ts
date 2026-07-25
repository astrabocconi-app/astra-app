import * as SecureStore from "expo-secure-store";

// Session token storage. Persisted in the OS keychain via SecureStore, mirrored
// in memory so the API client's synchronous getToken() can read it.

const KEY = "astra_session_token";
const TYPE_KEY = "astra_account_type";
const CARD_KEY = "astra_card_token";
let cachedToken: string | null = null;
let cachedType: AccountType | null = null;

export type AccountType = "student" | "partner";

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
  cachedType = null;
  await SecureStore.deleteItemAsync(KEY);
  await SecureStore.deleteItemAsync(TYPE_KEY);
}

// Account type — persisted so cold-boot can route partner vs student without a
// network round-trip (keeps students able to open the app offline).
export async function loadAccountType(): Promise<AccountType | null> {
  cachedType = (await SecureStore.getItemAsync(TYPE_KEY)) as AccountType | null;
  return cachedType;
}

export function getAccountType(): AccountType | null {
  return cachedType;
}

export async function setAccountType(type: AccountType): Promise<void> {
  cachedType = type;
  await SecureStore.setItemAsync(TYPE_KEY, type);
}

// Loyalty-card QR token — cached so the card still renders with no connection
// (the token is refreshed from the server whenever the app is online).
export async function saveCardToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(CARD_KEY, token);
}

export async function loadCardToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CARD_KEY);
}
