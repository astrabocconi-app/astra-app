import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import LogoLoader from "./LogoLoader";
import { useBootStore } from "../lib/boot-store";

// Full-screen intro overlay shown once when the app boots into the home screen.
//
// The trick that makes it feel layered: instead of hard-cutting from the loader
// to home, the two overlap. First the loader holds on a solid white backdrop.
// Then the *backdrop* dissolves on its own — so the live home fades in
// underneath in opacity — while the morphing logo stays fully visible on top.
// The logo lingers over the real home for a beat, then fades out last. The
// animation literally finishes on top of the home page.
const HOLD_MS = 2200; // keep the loader up at least this long (min on-screen time)
const BG_FADE_MS = 650; // white backdrop dissolves → home appears gradually in opacity
const LOGO_HOLD_MS = 300; // logo floats over the now-visible home for a beat
const LOGO_FADE_MS = 450; // then the logo itself fades away over home

export default function BootOverlay() {
  const done = useBootStore((s) => s.done);
  const backdrop = useRef(new Animated.Value(1)).current; // white sheet opacity
  const logo = useRef(new Animated.Value(1)).current; // logo layer opacity
  const [frozen, setFrozen] = useState(false); // stops the morph looping on reveal

  useEffect(() => {
    const t = setTimeout(() => {
      // 1) reveal home: fade the white backdrop out, logo stays on top
      Animated.timing(backdrop, {
        toValue: 0,
        duration: BG_FADE_MS,
        useNativeDriver: true,
      }).start(() => {
        // Freeze the morph the instant home is revealed so it can't kick off a
        // fresh cycle (the faint trailing animation) while the logo fades out.
        setFrozen(true);
        // 2) let the logo hang over the live home, then fade it out last
        Animated.timing(logo, {
          toValue: 0,
          duration: LOGO_FADE_MS,
          delay: LOGO_HOLD_MS,
          useNativeDriver: true,
        }).start(() => done());
      });
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [backdrop, logo, done]);

  return (
    // Outer opacity fades the whole overlay (logo included) out in step 2.
    // pointerEvents="none" keeps the app underneath responsive throughout.
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { opacity: logo }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: backdrop }]}
      />
      <LogoLoader size={168} paused={frozen} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
