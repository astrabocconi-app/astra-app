import * as SecureStore from "expo-secure-store";
import { parseCardCache, type CardCache } from "./card-cache";

// Session token storage. Persisted in the OS keychain via SecureStore, mirrored
// in memory so the API client's synchronous getToken() can read it.

const KEY = "astra_session_token";
const TYPE_KEY = "astra_account_type";
const UID_KEY = "astra_user_id";
const CARD_KEY = "astra_card_token";
const SCAN_ONLY_KEY = "astra_partner_scan_only";
const PUSH_KEY = "astra_push_token";
let cachedToken: string | null = null;
let cachedType: AccountType | null = null;
let cachedScanOnly = false;
let cachedUid: string | null = null;

export type AccountType = "student" | "partner";

/**
 * Everything on the device that belongs to the signed-in person. Signing out,
 * deleting the account and a rejected session delete all of it, so the next
 * person on a shared phone starts clean. NOT in here: language and inverted
 * mode, which belong to the phone.
 */
const PERSONAL_KEYS = [
  KEY,
  TYPE_KEY,
  UID_KEY,
  SCAN_ONLY_KEY,
  CARD_KEY,
  PUSH_KEY,
  "astra_onboarding_skipped",
  "astra_year_prompt",
  // Grade calculators (see use-saved-state.ts): one key per plan type.
  "calc.type",
  "calc.bachelor",
  "calc.master",
  "calc.clmg",
  "masters.inputs",
  // Pre-server academic selection from old builds; never migrated again.
  "astra_profile_course",
  "astra_profile_year",
];

/** The session token is bound to this phone: it must not ride along in a device backup. */
const TOKEN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

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
  await SecureStore.setItemAsync(KEY, token, TOKEN_OPTIONS);
}

/** In-memory part of signing out; synchronous, so nothing sent after it carries the old token. */
export function forgetSessionInMemory(): void {
  cachedToken = null;
  cachedType = null;
  cachedScanOnly = false;
  cachedUid = null;
}

/**
 * Delete every per-user key. Each delete is independent: one keychain failure
 * must not leave the rest of the previous person's data behind.
 */
export async function wipePersonalData(): Promise<void> {
  forgetSessionInMemory();
  await Promise.allSettled(PERSONAL_KEYS.map((k) => SecureStore.deleteItemAsync(k)));
}

// Account type — persisted so cold-boot can route partner vs student without a
// network round-trip (keeps students able to open the app offline).
export async function loadAccountType(): Promise<AccountType | null> {
  const raw = await SecureStore.getItemAsync(TYPE_KEY);
  cachedType = raw === "student" || raw === "partner" ? raw : null;
  return cachedType;
}

export function getAccountType(): AccountType | null {
  return cachedType;
}

export async function setAccountType(type: AccountType): Promise<void> {
  cachedType = type;
  await SecureStore.setItemAsync(TYPE_KEY, type);
}

// Scan-only partner logins: staff who can award points but must not see the
// venue's takings. Persisted alongside the account type so a cold boot routes
// straight to the scanner. This is a UI convenience only — /api/partner/stats
// refuses these accounts server-side regardless of what the app believes.
export async function loadPartnerScanOnly(): Promise<boolean> {
  cachedScanOnly = (await SecureStore.getItemAsync(SCAN_ONLY_KEY)) === "true";
  return cachedScanOnly;
}

export function getPartnerScanOnly(): boolean {
  return cachedScanOnly;
}

export async function setPartnerScanOnly(scanOnly: boolean): Promise<void> {
  cachedScanOnly = scanOnly;
  await SecureStore.setItemAsync(SCAN_ONLY_KEY, scanOnly ? "true" : "false");
}

// Who is signed in, so on-device caches can be tied to them without a network call.
export async function loadUserId(): Promise<string | null> {
  cachedUid = await SecureStore.getItemAsync(UID_KEY);
  return cachedUid;
}

export function getUserId(): string | null {
  return cachedUid;
}

export async function setUserId(uid: string): Promise<void> {
  cachedUid = uid;
  await SecureStore.setItemAsync(UID_KEY, uid);
}

// Loyalty-card QR token — kept so the card renders at once on the next launch.
// It carries the account it belongs to and when it was saved: the server only
// honours a token for 15 minutes, and a stale or foreign one must never show.
export async function saveCardToken(uid: string, token: string): Promise<void> {
  const value: CardCache = { uid, token, savedAt: Date.now() };
  await SecureStore.setItemAsync(CARD_KEY, JSON.stringify(value));
}

export async function loadCardToken(): Promise<CardCache | null> {
  return parseCardCache(await SecureStore.getItemAsync(CARD_KEY));
}

// The Expo push token this phone registered, remembered so sign-out can detach it.
export async function savePushToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(PUSH_KEY, token);
}

export async function loadPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_KEY);
}
