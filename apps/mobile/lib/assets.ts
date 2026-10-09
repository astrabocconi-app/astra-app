/* eslint-disable @typescript-eslint/no-require-imports --
   Metro resolves bundled image assets through CommonJS require(); this file is
   the one place that does it, so screens import typed sources instead. */
import type { ImageSourcePropType } from "react-native";

export const IMAGES = {
  logoHorizontal: require("../assets/logo-horizontal.png") as ImageSourcePropType,
  logoHorizontalWhite: require("../assets/logo-horizontal-white.png") as ImageSourcePropType,
  logoIcon: require("../assets/logo-icon.png") as ImageSourcePropType,
  campus: require("../assets/campus.jpg") as ImageSourcePropType,
  freeAtB: require("../assets/freeatb-classroom.jpg") as ImageSourcePropType,
  stellaPolare: require("../assets/stella-polare.jpg") as ImageSourcePropType,
};
