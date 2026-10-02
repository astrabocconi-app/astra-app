import type { ComponentProps } from "react";
import { TextInput } from "react-native";

/**
 * TextInput that always states its letter spacing and alignment.
 *
 * iOS recycles native text inputs between screens and keeps any text style the
 * previous one set but the new one leaves out — the login code field's 8px
 * tracking and centring were showing up in the search bars right after login.
 * Use this for every input except one that sets its own tracking (the code).
 */
export function TextField({ center, style, ...rest }: ComponentProps<typeof TextInput> & { center?: boolean }) {
  return <TextInput {...rest} style={[{ letterSpacing: 0, textAlign: center ? "center" : "left" }, style]} />;
}
