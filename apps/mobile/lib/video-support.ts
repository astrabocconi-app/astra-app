import { requireOptionalNativeModule } from "expo";

/**
 * Whether this binary was built with expo-video. OTA updates reach older builds
 * that don't have the native module, and importing expo-video there throws, so
 * anything that touches it is only loaded when this is true.
 */
export const videoSupported = requireOptionalNativeModule("ExpoVideo") != null;
