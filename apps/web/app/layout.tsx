import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASTRA Dashboard",
  description: "ASTRA App — internal dashboard (Phase 1.5 skeleton)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
