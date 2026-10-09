import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet } from "react-native";
import LogoLoader from "./LogoLoader";
import { useBootStore } from "../lib/boot-store";
import { useEggStore } from "../lib/egg-store";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { IMAGES } from "../lib/assets";

// Full-screen intro overlay shown once when the app boots into the home screen.
//
// The trick that makes it feel layered: instead of hard-cutting from the loader
// to home, the two overlap. First the loader holds on a solid backdrop (white,
// or brand blue in inverted mode).
// Then the *backdrop* dissolves on its own — so the live home fades in
// underneath in opacity — while the morphing logo stays fully visible on top.
// The logo lingers over the real home for a beat, then fades out last. The
// animation literally finishes on top of the home page.
//
// Two ways out for people who do not want to watch it: a tap anywhere skips to
// the end, and with Reduce Motion on the morph is replaced by the still logo
// and a quick fade that never captures a tap.
const HOLD_MS = 1200; // keep the loader up at least this long (min on-screen time)
const BG_FADE_MS = 650; // white backdrop dissolves → home appears gradually in opacity
const LOGO_HOLD_MS = 300; // logo floats over the now-visible home for a beat
const LOGO_FADE_MS = 450; // then the logo itself fades away over home
const SKIP_FADE_MS = 180;
const REDUCED_HOLD_MS = 250;
const REDUCED_FADE_MS = 250;

export default function BootOverlay() {
  const done = useBootStore((s) => s.done);
  const inverted = useEggStore((s) => s.inverted);
  const reduced = useReducedMotion();
  const backdrop = useRef(new Animated.Value(1)).current; // white sheet opacity
  const logo = useRef(new Animated.Value(1)).current; // logo layer opacity
  const [frozen, setFrozen] = useState(false); // stops the morph looping on reveal
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    done();
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (reduced) {
      running.current = Animated.sequence([
        Animated.delay(REDUCED_HOLD_MS),
        Animated.parallel([
          Animated.timing(backdrop, { toValue: 0, duration: REDUCED_FADE_MS, useNativeDriver: true }),
          Animated.timing(logo, { toValue: 0, duration: REDUCED_FADE_MS, useNativeDriver: true }),
        ]),
      ]);
      running.current.start(({ finished: ok }) => ok && finish());
    } else {
      timer = setTimeout(() => {
        // 1) reveal home: fade the white backdrop out, logo stays on top
        running.current = Animated.timing(backdrop, {
          toValue: 0,
          duration: BG_FADE_MS,
          useNativeDriver: true,
        });
        running.current.start(({ finished: ok }) => {
          if (!ok) return; // skipped: skip() owns the rest
          // Freeze the morph the instant home is revealed so it can't kick off a
          // fresh cycle (the faint trailing animation) while the logo fades out.
          setFrozen(true);
          // 2) let the logo hang over the live home, then fade it out last
          running.current = Animated.timing(logo, {
            toValue: 0,
            duration: LOGO_FADE_MS,
            delay: LOGO_HOLD_MS,
            useNativeDriver: true,
          });
          running.current.start(({ finished: ok }) => ok && finish());
        });
      }, HOLD_MS);
    }
    return () => {
      clearTimeout(timer);
      running.current?.stop();
    };
    // finish() only reads refs and the stable `done` action
  }, [reduced, backdrop, logo, done]);

  /** Tap: fade everything out right away and hand the screen back. */
  function skip() {
    running.current?.stop();
    setFrozen(true);
    running.current = Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: SKIP_FADE_MS, useNativeDriver: true }),
      Animated.timing(logo, { toValue: 0, duration: SKIP_FADE_MS, useNativeDriver: true }),
    ]);
    running.current.start(({ finished: ok }) => ok && finish());
  }

  const backdropColor = inverted ? "#04107E" : "#fff";

  return (
    // Outer opacity fades the whole overlay (logo included) out in step 2.
    // Purely decorative: hidden from screen readers so they land on the app.
    <Animated.View
      pointerEvents="box-none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { opacity: logo }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor, opacity: backdrop }]}
      />
      {reduced ? (
        <Image
          source={IMAGES.logoIcon}
          resizeMode="contain"
          style={styles.still}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LogoLoader size={168} paused={frozen} color={inverted ? "#fff" : "#04107e"} />
      )}
      {/* Catches the tap-to-skip. Not rendered for Reduce Motion (nothing to skip),
          and it lets taps through once home is revealed (frozen). */}
      {!reduced && !frozen ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessible={false} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  still: { width: 120, height: 120 },
});
