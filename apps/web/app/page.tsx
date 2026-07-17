import Link from "next/link";
import { AstraLogo } from "@/app/_ui/logo";
import { StoreBadges } from "@/app/_ui/store-badges";

// Public marketing landing page for the ASTRA app. Shows off the app with a
// download-focused hero + real iPhone screenshots. Staff reach the dashboard
// via the "Staff login" link (auth-gated at /dashboard).

const FEATURES = [
  {
    title: "Earn points",
    body: "Collect points at partner venues and association events — your balance updates instantly.",
    icon: <path d="M12 2 3 7v6c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7l-9-5z" />,
  },
  {
    title: "Events & tickets",
    body: "Browse events, RSVP, and get a QR ticket for fast check-in at the door.",
    icon: (
      <path d="M4 5h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V6a1 1 0 0 1 1-1z" />
    ),
  },
  {
    title: "Rewards",
    body: "Spend your points on exclusive perks, merch, and offers from ASTRA partners.",
    icon: (
      <path d="M20 8h-2.3a3 3 0 0 0-4.7-3.6A3 3 0 0 0 6.3 8H4a1 1 0 0 0-1 1v3h9V8h-2.5a1 1 0 1 1 1-1c.6 0 1 .4 1 1zM3 13v6a1 1 0 0 0 1 1h8v-7H3zm10 7h8a1 1 0 0 0 1-1v-6h-9v7z" />
    ),
  },
  {
    title: "Digital card",
    body: "Your membership lives on your phone — a rotating QR you scan to earn on the go.",
    icon: (
      <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm12 0h4v2h-4v-2zm0 4h4v2h-4v-2z" />
    ),
  },
];

function PhoneFrame({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[2.4rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block h-auto w-full" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 text-astra-primary">
          <AstraLogo size={30} />
          <span className="text-xl font-extrabold tracking-tight">ASTRA</span>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full px-4 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-astra-light hover:text-astra-primary"
        >
          Staff login →
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[560px] bg-gradient-to-b from-astra-light to-transparent"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-8 pt-8 lg:grid-cols-2 lg:pt-16">
          {/* Copy */}
          <div className="astra-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-astra-light px-3.5 py-1.5 text-xs font-semibold text-astra-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-astra-accent" />
              ASTRA · Bocconi student association
            </span>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 sm:text-6xl">
              Your campus life,
              <br />
              <span className="text-astra-primary">rewarded.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-neutral-600">
              Earn points at events and partner venues, unlock rewards, grab event
              tickets, and carry your membership card — all in the ASTRA app.
            </p>
            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold text-neutral-900">
                Download the app
              </p>
              <StoreBadges />
              <p className="mt-3 text-xs text-neutral-400">
                Coming soon to iOS &amp; Android.
              </p>
            </div>
          </div>

          {/* Phones */}
          <div className="astra-fade-up relative mx-auto flex h-[520px] w-full max-w-md items-center justify-center lg:h-[620px]">
            <PhoneFrame
              src="/screens/events.png"
              alt="ASTRA app — events screen"
              className="absolute right-2 top-6 w-40 rotate-6 opacity-90 sm:w-52 lg:right-0"
            />
            <PhoneFrame
              src="/screens/home.png"
              alt="ASTRA app — home screen"
              className="relative w-56 -rotate-3 sm:w-64 lg:w-72"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-neutral-900">
          Everything ASTRA, in your pocket
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-astra-light text-astra-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  {f.icon}
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Download CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="overflow-hidden rounded-3xl bg-astra-primary px-8 py-14 text-center text-white sm:px-16">
          <AstraLogo size={44} className="mx-auto text-white/90" />
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Get the ASTRA app today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-white/70">
            Sign in with your Bocconi email and start earning from day one.
          </p>
          <StoreBadges className="mt-8 justify-center" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-neutral-400 sm:flex-row">
          <div className="flex items-center gap-2 text-astra-primary">
            <AstraLogo size={22} />
            <span className="font-bold">ASTRA</span>
            <span className="text-neutral-400">· Bocconi</span>
          </div>
          <p>© {new Date().getFullYear()} ASTRA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
