import { AstraLogo } from "@/app/_ui/logo";
import { StoreBadges } from "@/app/_ui/store-badges";

// Public marketing landing page for the ASTRA app. Shows off the app with a
// download-focused hero + real iPhone screenshots. Staff reach the dashboard
// via the "Staff login" link (auth-gated at /dashboard).

// Material Symbols share one viewBox; every icon below is a single filled path.
const ICON_VIEWBOX = "0 -960 960 960";

const FEATURES = [
  {
    title: "Earn points",
    body: "Collect points at partner venues and association events. Your balance updates instantly.",
    // Material Symbols "loyalty" (rounded, filled) — Apache 2.0
    icon: "M856-390 570-104q-12 12-27 18t-30 6q-15 0-30-6t-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30q0 15-5.5 29.5T856-390ZM260-640q25 0 42.5-17.5T320-700q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm288 352 112-112q11-11 17.5-26t6.5-32q0-34-24-58t-58-24q-19 0-37.5 11T520-492q-30-28-47-38t-35-10q-34 0-58 24t-24 58q0 17 6.5 32t17.5 26l112 112q12 12 28 12t28-12Z",
  },
  {
    title: "Events & tickets",
    body: "Browse events, RSVP, and get a QR ticket for fast check-in at the door.",
    // Material Symbols "confirmation_number" (rounded, filled) — Apache 2.0
    icon: "M160-160q-33 0-56.5-23.5T80-240v-135q0-11 7-19t18-10q24-8 39.5-29t15.5-47q0-26-15.5-47T105-556q-11-2-18-10t-7-19v-135q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v135q0 11-7 19t-18 10q-24 8-39.5 29T800-480q0 26 15.5 47t39.5 29q11 2 18 10t7 19v135q0 33-23.5 56.5T800-160H160Zm320-120q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm0-160q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440Zm0-160q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Z",
  },
  {
    title: "Rewards",
    body: "Spend your points on exclusive perks, merch, and offers from ASTRA partners.",
    // Material Symbols "redeem" (rounded, filled) — Apache 2.0
    icon: "M160-280v80h640v-80H160Zm0-440h88q-5-9-6.5-19t-1.5-21q0-50 35-85t85-35q30 0 55.5 15.5T460-826l20 26 20-26q18-24 44-39t56-15q50 0 85 35t35 85q0 11-1.5 21t-6.5 19h88q33 0 56.5 23.5T880-640v440q0 33-23.5 56.5T800-120H160q-33 0-56.5-23.5T80-200v-440q0-33 23.5-56.5T160-720Zm0 320h640v-240H596l60 82q10 14 8 29.5T648-503q-14 10-29.5 7.5T593-511L480-664 367-511q-10 13-25.5 15.5T312-503q-14-10-16.5-25.5T303-558l59-82H160v240Zm200-320q17 0 28.5-11.5T400-760q0-17-11.5-28.5T360-800q-17 0-28.5 11.5T320-760q0 17 11.5 28.5T360-720Zm240 0q17 0 28.5-11.5T640-760q0-17-11.5-28.5T600-800q-17 0-28.5 11.5T560-760q0 17 11.5 28.5T600-720Z",
  },
  {
    title: "Digital card",
    body: "Your membership lives on your phone: a rotating QR you scan to earn on the go.",
    // Material Symbols "qr_code_2" (rounded, filled) — Apache 2.0
    icon: "M520-120v-80h80v80h-80Zm-80-80v-200h80v200h-80Zm320-120v-160h80v160h-80Zm-80-160v-80h80v80h-80Zm-480 80v-80h80v80h-80Zm-80-80v-80h80v80h-80Zm360-280v-80h80v80h-80ZM180-660h120v-120H180v120Zm-60 20v-160q0-17 11.5-28.5T160-840h160q17 0 28.5 11.5T360-800v160q0 17-11.5 28.5T320-600H160q-17 0-28.5-11.5T120-640Zm60 460h120v-120H180v120Zm-60 20v-160q0-17 11.5-28.5T160-360h160q17 0 28.5 11.5T360-320v160q0 17-11.5 28.5T320-120H160q-17 0-28.5-11.5T120-160Zm540-500h120v-120H660v120Zm-60 20v-160q0-17 11.5-28.5T640-840h160q17 0 28.5 11.5T840-800v160q0 17-11.5 28.5T800-600H640q-17 0-28.5-11.5T600-640Zm80 520v-120h-80v-80h160v120h80v80H680ZM520-400v-80h160v80H520Zm-160 0v-80h-80v-80h240v80h-80v80h-80Zm40-200v-160h80v80h80v80H400Zm-190-90v-60h60v60h-60Zm0 480v-60h60v60h-60Zm480-480v-60h60v60h-60Z",
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
        {/* Admin dashboard is intentionally URL-only (visit /signin directly). */}
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
              tickets, and carry your membership card, all in the ASTRA app.
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
              src="/screens/discounts.png"
              alt="ASTRA app: map of partner venues offering student discounts"
              className="absolute right-2 top-6 w-40 rotate-6 opacity-90 sm:w-52 lg:right-0"
            />
            <PhoneFrame
              src="/screens/home.png"
              alt="ASTRA app: home screen with points, news and shortcuts"
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
                <svg
                  width="26"
                  height="26"
                  viewBox={ICON_VIEWBOX}
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d={f.icon} />
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
