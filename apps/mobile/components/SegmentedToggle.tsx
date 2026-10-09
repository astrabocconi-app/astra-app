import { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEggStore } from "../lib/egg-store";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { Text } from "./AppText";

const BRAND = "#04107E";
const TRACK = "#EDEFF9"; // astra-light
const PADDING = 4;

export type SegmentOption<T extends string> = { value: T; label: string };

/**
 * Pill switch where a solid accent block glides between the segments.
 *
 * The track is measured at runtime rather than hard-coded so the thumb lines up
 * on any screen width; until the first layout pass the thumb stays 0-width and
 * therefore invisible, which avoids it flashing at the wrong size on mount. The
 * thumb is placed without animation on that first pass (a toggle that mounts on
 * its second option used to slide in from the left) and always when the person
 * has Reduce Motion on.
 *
 * To a screen reader it is a radio group: each option says whether it is the
 * selected one.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const inverted = useEggStore((s) => s.inverted);
  const reduced = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / options.length : 0;

  const x = useSharedValue(0);
  const placed = useRef(false);

  function onLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = index * segmentWidth;
    if (!placed.current || reduced) {
      x.value = target;
      placed.current = true;
    } else {
      x.value = withTiming(target, { duration: 240, easing: Easing.bezier(0.32, 0.72, 0, 1) });
    }
  }, [index, segmentWidth, reduced, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    // Inverted mode flips it: a faint white track and a white thumb on blue.
    <View
      style={[styles.track, { backgroundColor: inverted ? "rgba(255,255,255,0.1)" : TRACK }]}
      onLayout={onLayout}
      accessibilityRole="radiogroup"
    >
      <Animated.View
        style={[
          styles.thumb,
          { width: segmentWidth, backgroundColor: inverted ? "#fff" : BRAND },
          thumbStyle,
        ]}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={styles.segment}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active, checked: active }}
          >
            {/* One line, shrunk to fit: "Giurisprudenza" must never wrap mid-word. */}
            <Text
              chrome
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[
                styles.label,
                { color: active ? (inverted ? BRAND : "#fff") : inverted ? "rgba(255,255,255,0.75)" : "#4B5563" },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 14,
    padding: PADDING,
  },
  thumb: {
    position: "absolute",
    top: PADDING,
    left: PADDING,
    bottom: PADDING,
    borderRadius: 10,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
