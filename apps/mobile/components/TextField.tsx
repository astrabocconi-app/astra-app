import type { ComponentProps } from "react";
import { TextInput } from "react-native";

/**
 * TextInput that always states its letter spacing and alignment.
 *
 * iOS recycles native text inputs between screens and keeps any text style the
 * previous one set but the new one leaves out — the login code field's 8px
 * tracking and centring were showing up in the search bars right after login.
 * Use this for every input except one that sets its own tracking (the code).
 *
 * Text scaling is capped at 1.6x (see AppText) so fields keep their shape.
 */
export function TextField({
  center,
  style,
  maxFontSizeMultiplier,
  ...rest
}: ComponentProps<typeof TextInput> & { center?: boolean }) {
  return (
    <TextInput
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? 1.6}
      {...rest}
      style={[{ letterSpacing: 0, textAlign: center ? "center" : "left" }, style]}
    />
  );
}
