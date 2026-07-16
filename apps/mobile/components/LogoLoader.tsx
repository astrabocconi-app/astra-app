// @ts-nocheck — vendored animation component (index-heavy worklet math);
// intentionally not type-checked under strict/noUncheckedIndexedAccess.
/**
 * LogoLoader — liquid warping morph loading animation.
 *
 * From nothing, a point appears at center and warps outward into the full
 * logo along spiraling, rippling paths, holds, then twists back down into
 * the point and vanishes. Loops.
 *
 * Curviness comes from three combined effects, all of which vanish at the
 * start and end so the empty point and the finished logo are both clean:
 *   1. polar interpolation + swirl  -> points spiral instead of moving straight
 *   2. radial warp (sine lobes)     -> silhouette bulges and ripples organically
 *   3. tangential shear             -> edges bend sideways, removing straightness
 * A gentle radius overshoot adds an elastic settle. The outline is rendered
 * as smooth cubic curves (Catmull-Rom), never faceted segments.
 *
 * Requires:
 *   npm install react-native-svg react-native-reanimated
 * Files:
 *   LogoLoader.jsx (this file) + logoMorphShapes.js (precomputed geometry)
 *
 * Usage:
 *   import LogoLoader from './LogoLoader';
 *   <LogoLoader size={140} />
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { CX, CY, SHAPES } from './logoMorphShapes';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// Timeline (ms)
const APPEAR = 150;
const GROW = 950;
const HOLD = 550;
const SHRINK = 950;
const VANISH = 150;
const PAUSE = 250;
const TOTAL = APPEAR + GROW + HOLD + SHRINK + VANISH + PAUSE;

// Warp character — tune these for more/less curviness
const SWIRL = 1.4;      // turns of twist during the morph
const WARP_R = 46;      // radial ripple amplitude (viewbox units)
const WARP_T = 34;      // tangential shear amplitude
const LOBES_A = 3;      // radial ripple frequency around the ring
const LOBES_B = 5;      // tangential shear frequency
const OVERSHOOT = 0.10; // elastic radius overshoot mid-morph
const TWOPI = Math.PI * 2;

function phases(clock: number) {
  'worklet';
  const t = clock * TOTAL;
  let morph = 0, rot = 0, opacity = 1, scale = 1;
  const eOut = (k: number) => 1 - Math.pow(1 - k, 3);
  const eIn = (k: number) => k * k * k;

  if (t < APPEAR) {
    const k = t / APPEAR;
    opacity = k;
    scale = 0.2 + 0.8 * k;
  } else if (t < APPEAR + GROW) {
    morph = eOut((t - APPEAR) / GROW);
  } else if (t < APPEAR + GROW + HOLD) {
    morph = 1;
  } else if (t < APPEAR + GROW + HOLD + SHRINK) {
    const k = eIn((t - APPEAR - GROW - HOLD) / SHRINK);
    morph = 1 - k;
    rot = 360 * k;
  } else if (t < TOTAL - PAUSE) {
    const k = (t - APPEAR - GROW - HOLD - SHRINK) / VANISH;
    opacity = 1 - k;
    scale = 1 - 0.6 * k;
  } else {
    opacity = 0;
  }
  return { morph, rot, opacity, scale };
}

// Catmull-Rom -> cubic bezier, smooth closed outline
function smoothPath(pts: number[][]) {
  'worklet';
  const n = pts.length;
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += 'C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' +
               c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' +
               p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  return d + 'Z';
}

function buildPath(shape: { from: number[]; to: number[] }, p: number) {
  'worklet';
  const from = shape.from;
  const to = shape.to;
  const pts: number[][] = [];
  const bell = Math.sin(Math.PI * p);   // 0 at ends, 1 at mid
  const bell2 = bell * bell;            // sharper warp falloff
  const swirl = SWIRL * (1 - p) * TWOPI;
  const phase = p * TWOPI;
  for (let i = 0; i < from.length; i += 2) {
    const fx = from[i] - CX, fy = from[i + 1] - CY;
    const tx = to[i] - CX, ty = to[i + 1] - CY;
    const rf = Math.sqrt(fx * fx + fy * fy);
    const rt = Math.sqrt(tx * tx + ty * ty);
    const af = Math.atan2(fy, fx);
    const at = Math.atan2(ty, tx);
    let da = at - af;
    while (da > Math.PI) da -= TWOPI;
    while (da < -Math.PI) da += TWOPI;
    let r = rf + (rt - rf) * p;
    let a = af + da * p + swirl;
    // organic warps — vanish at p=0 and p=1
    r += WARP_R * bell2 * Math.sin(LOBES_A * a + phase);
    r *= 1 + OVERSHOOT * bell * Math.sin(2 * a - phase);
    a += (WARP_T / (r + 1)) * bell2 * Math.sin(LOBES_B * a - phase);
    pts.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]);
  }
  return smoothPath(pts);
}

export default function LogoLoader({ size = 140, color = '#04107e' }) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: TOTAL, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const groupProps = useAnimatedProps(() => {
    const { rot, opacity, scale } = phases(clock.value);
    return {
      opacity,
      transform: `translate(${CX} ${CY}) rotate(${rot}) scale(${scale}) translate(${-CX} ${-CY})`,
    };
  });

  const shape0Props = useAnimatedProps(() => ({
    d: buildPath(SHAPES[0], phases(clock.value).morph),
  }));
  const shape1Props = useAnimatedProps(() => ({
    d: buildPath(SHAPES[1], phases(clock.value).morph),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 375 374.999991">
        <AnimatedG animatedProps={groupProps}>
          <AnimatedPath animatedProps={shape0Props} fill={color} fillRule="evenodd" />
          <AnimatedPath animatedProps={shape1Props} fill={color} fillRule="evenodd" />
        </AnimatedG>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
