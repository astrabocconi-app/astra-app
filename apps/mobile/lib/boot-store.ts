import { create } from "zustand";

// One-shot signal for the intro overlay (LogoLoader) that plays over the whole
// app right after sign-in / cold-boot-with-session. Call `trigger()` just before
// navigating to /home; the root-level <BootOverlay> plays the morph, crossfades
// out over the live home, then calls `done()` to unmount itself.
type BootState = {
  booting: boolean;
  trigger: () => void;
  done: () => void;
};

export const useBootStore = create<BootState>((set) => ({
  booting: false,
  trigger: () => set({ booting: true }),
  done: () => set({ booting: false }),
}));
