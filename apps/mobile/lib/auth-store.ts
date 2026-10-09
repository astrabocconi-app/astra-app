import { create } from "zustand";
import type { AccountType } from "./session";

// What the root layout needs to know, reactively, about who is signed in. The
// token itself lives in session.ts (synchronous reads for the API client); this
// store mirrors "is there a session, and of what kind" so the router can guard
// screens and every per-session piece of UI can be keyed by `session`.
type AuthState = {
  /** False until the boot read of the keychain has finished. */
  ready: boolean;
  signedIn: boolean;
  accountType: AccountType | null;
  /** Bumped on every sign-out; used as a React key so nothing from the last session survives. */
  session: number;
  /** "Later" on the first-login sheet, for this session: two mounted sheets must never both open. */
  onboardingClosed: boolean;
  /** A name typed at sign-in that could not be saved yet; Profile retries it quietly. */
  pendingName: { firstName: string; lastName: string } | null;
  setPendingName: (name: { firstName: string; lastName: string } | null) => void;
  restore: (signedIn: boolean, accountType: AccountType | null) => void;
  enter: (accountType: AccountType) => void;
  leave: () => void;
  closeOnboarding: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  signedIn: false,
  accountType: null,
  session: 0,
  onboardingClosed: false,
  pendingName: null,
  setPendingName: (pendingName) => set({ pendingName }),
  restore: (signedIn, accountType) => set({ ready: true, signedIn, accountType }),
  enter: (accountType) => set({ signedIn: true, accountType, onboardingClosed: false }),
  leave: () =>
    set((s) => ({
      signedIn: false,
      accountType: null,
          onboardingClosed: false,
      pendingName: null,
      session: s.session + 1,
    })),
  closeOnboarding: () => set({ onboardingClosed: true }),
}));
