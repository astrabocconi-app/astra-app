import { router } from "expo-router";
import { queryClient } from "./query-client";
import { useAuthStore } from "./auth-store";
import { useBootStore } from "./boot-store";
import { forgetSessionInMemory, wipePersonalData } from "./session";
import { unregisterPush } from "./push";
import { captureError } from "./sentry";

let inFlight: Promise<void> | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The one way out of a session: Profile "Sign out", account deletion, a
 * partner signing out and a 401 on our own token all end up here, so nothing
 * of the previous person can be left behind for the next one.
 *
 * Order matters:
 *  1. detach the push token while the session still authenticates the call
 *     (skipped when the server already rejected us, and capped at a few seconds);
 *  2. forget the session in memory at once, so nothing sent after this carries it;
 *  3. flip the auth store, which unmounts every guarded screen, then pop to the
 *     root and show the login, so no tab navigator survives underneath;
 *  4. only then wipe the disk and the query cache. Screens that save on unmount
 *     (the calculators) write while they close; wiping first would let them
 *     put the old person's grades straight back.
 *
 * Safe to call twice: concurrent callers share one run.
 */
export function signOutAndReset(opts: { serverKnowsUs?: boolean } = {}): Promise<void> {
  inFlight ??= run(opts.serverKnowsUs ?? true).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(serverKnowsUs: boolean) {
  if (serverKnowsUs) {
    try {
      await unregisterPush();
    } catch {
      // best effort: the server drops the token on the next registration anyway
    }
  }
  forgetSessionInMemory();
  useBootStore.getState().done();
  useAuthStore.getState().leave();
  try {
    router.dismissAll();
  } catch {
    // already at the root
  }
  router.replace("/");
  await sleep(250); // let unmounting screens finish their last save
  try {
    await wipePersonalData();
  } catch (e) {
    captureError(e, { what: "wipePersonalData" });
  }
  queryClient.clear();
}
