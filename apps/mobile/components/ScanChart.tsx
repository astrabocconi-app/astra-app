import { View, Text, useWindowDimensions } from "react-native";
import Svg, { Rect } from "react-native-svg";

export type ChartSeries = {
  offerId: string | null;
  title: string;
  counts: number[];
  total: number;
};

/**
 * Categorical palette, fixed order, never cycled. Validated for the light
 * surface: worst adjacent CVD ΔE 9.1, worst normal-vision ΔE 19.6. Because the
 * lighter hues fall under 3:1 against white, identity is never carried by
 * colour alone — the legend below the chart names every series and shows its
 * total, which is also the accessible table view of the same data.
 */
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;
/** Scans not tied to a promotion — deliberately neutral, not a categorical slot. */
const UNATTRIBUTED_COLOR = "#9CA3AF";

export function seriesColor(series: ChartSeries, index: number): string {
  return series.offerId === null
    ? UNATTRIBUTED_COLOR
    : (SERIES_COLORS[index % SERIES_COLORS.length] as string);
}

function bucketLabel(iso: string, bucket: "day" | "week"): string {
  const d = new Date(iso);
  return bucket === "week"
    ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : d.toLocaleDateString(undefined, { weekday: "narrow" });
}

/**
 * Scans per period, stacked by promotion.
 *
 * Stacked rather than multi-line: the venue reads total footfall from the bar
 * height and the promotion mix from the segments, and five overlapping lines on
 * a phone is unreadable. Empty periods stay in place as gaps so a quiet week
 * doesn't silently compress the axis.
 */
export function ScanChart({
  buckets,
  series,
  bucket,
}: {
  buckets: string[];
  series: ChartSeries[];
  bucket: "day" | "week";
}) {
  const { width } = useWindowDimensions();
  const W = width - 40 - 32; // screen px-5 (2×20) + card p-4 (2×16)
  const H = 160;
  const padTop = 10;
  const axis = 1;
  const plotH = H - padTop - axis;

  const n = buckets.length;
  if (n === 0) return null;

  const totals = buckets.map((_, i) => series.reduce((sum, s) => sum + (s.counts[i] ?? 0), 0));
  const max = Math.max(1, ...totals);

  const slot = W / n;
  // Thin marks: a bar occupies most of its slot but never touches its neighbour.
  const barW = Math.max(6, Math.min(28, slot * 0.62));
  const GAP = 2; // surface gap between stacked segments
  const RADIUS = 4; // rounded data-end, anchored to the baseline

  // Only label every nth bucket when they'd otherwise collide.
  const labelEvery = Math.ceil(n / 7);

  return (
    <View>
      <Svg width={W} height={H}>
        {buckets.map((_, i) => {
          const x = i * slot + (slot - barW) / 2;
          let cursorY = H - axis;
          const total = totals[i] ?? 0;
          return series.map((s, si) => {
            const value = s.counts[i] ?? 0;
            if (value === 0) return null;
            const raw = (value / max) * plotH;
            // Keep a hairline visible for tiny values, and leave room for the gap.
            const h = Math.max(2, raw - GAP);
            cursorY -= raw;
            const isTop = series.slice(si + 1).every((rest) => (rest.counts[i] ?? 0) === 0);
            return (
              <Rect
                key={`${i}-${s.offerId ?? "none"}`}
                x={x}
                y={cursorY}
                width={barW}
                height={h}
                rx={isTop && total > 0 ? RADIUS : 0}
                fill={seriesColor(s, si)}
              />
            );
          });
        })}
        {/* Recessive baseline */}
        <Rect x={0} y={H - axis} width={W} height={axis} fill="#E5E7EB" />
      </Svg>

      <View style={{ width: W }} className="mt-1 flex-row">
        {buckets.map((b, i) => (
          <View key={b} style={{ width: slot }} className="items-center">
            <Text className="text-[10px] text-gray-400 dark:text-white/60">
              {i % labelEvery === 0 ? bucketLabel(b, bucket) : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
