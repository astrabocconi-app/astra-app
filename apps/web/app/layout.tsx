import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASTRA Dashboard",
  description: "ASTRA App — staff dashboard for the ASTRA loyalty platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          defer
          src="https://umami-analytics-five-rosy.vercel.app/script.js"
          data-website-id="d1329fcf-7ba9-40c5-92db-a33774dd0825"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
