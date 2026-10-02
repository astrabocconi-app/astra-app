import { useState } from "react";
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useEggStore } from "../lib/egg-store";

const BRAND = "#04107E";
const TRACK = "#EDEFF9"; // astra-light
const PADDING = 4;

export type SegmentOption<T extends string> = { value: T; label: string };

/**
 * Pill switch where a solid accent block glides between the segments.
 *
 * The track is measured at runtime rather than hard-coded so the thumb lines up
 * on any screen width; until the first layout pass the thumb stays 0-width and
 * therefore invisible, which avoids it flashing at the wrong size on mount.
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
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / options.length : 0;

  function onLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  // Re-runs whenever `index`/`segmentWidth` change, animating to the new offset.
  const thumbStyle = useAnimatedStyle(
    () => ({
      width: segmentWidth,
      transform: [
        {
          translateX: withTiming(index * segmentWidth, {
            duration: 240,
            easing: Easing.bezier(0.32, 0.72, 0, 1),
          }),
        },
      ],
    }),
    [index, segmentWidth],
  );

  return (
    // Inverted mode flips it: a faint white track and a white thumb on blue.
    <View
      style={[styles.track, { backgroundColor: inverted ? "rgba(255,255,255,0.1)" : TRACK }]}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: inverted ? "#fff" : BRAND }, thumbStyle]} />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.label,
                { color: active ? (inverted ? BRAND : "#fff") : inverted ? "rgba(255,255,255,0.7)" : "#6B7280" },
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
    paddingVertical: 9,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
