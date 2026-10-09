import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s · ASTRA", default: "ASTRA" },
  description: "ASTRA App: the Bocconi student association app, and its staff dashboard.",
};

// No analytics here: public pages load it from app/(public)/layout.tsx.
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
