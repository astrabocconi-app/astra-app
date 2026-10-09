import Script from "next/script";

// Public pages only (landing, privacy, support). Analytics lives here and not in
// the root layout so it never loads on /signin or /dashboard, where pages show
// student emails and one-time passwords and URLs carry search terms.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script
        defer
        strategy="afterInteractive"
        src="https://umami-analytics-five-rosy.vercel.app/script.js"
        data-website-id="d1329fcf-7ba9-40c5-92db-a33774dd0825"
      />
    </>
  );
}
