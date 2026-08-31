// App Store + Google Play download badges, drawn inline (no external images).
//
// Android is not published yet, so that badge is deliberately inert and greyed
// out with a "Coming soon!" note beneath it. Showing it as a live button would
// promise a download that does not exist; hiding it entirely would lose the
// signal that Android is coming. Swap `PLAY_STORE_URL` in when the listing is up
// and the badge lights up on its own.

const APP_STORE_URL = "#";
/** null until the Play Store listing exists. */
const PLAY_STORE_URL: string | null = null;

function BadgeInner({
  eyebrow,
  title,
  icon,
  muted,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <>
      <span className={`shrink-0 ${muted ? "opacity-60 grayscale" : ""}`}>{icon}</span>
      <span className="flex flex-col leading-none">
        <span className={`text-[10px] font-medium ${muted ? "text-white/50" : "text-white/70"}`}>
          {eyebrow}
        </span>
        <span className="mt-0.5 text-lg font-semibold tracking-tight">{title}</span>
      </span>
    </>
  );
}

const APPLE_ICON = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

const PLAY_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3.6 2.4c-.24.25-.38.63-.38 1.13v16.94c0 .5.14.88.38 1.13l.06.05L13.1 12v-.02L3.66 2.35l-.06.05z" fill="#00D2FF" />
    <path d="M16.3 15.2 13.1 12v-.02l3.2-3.2.07.04 3.77 2.14c1.08.61 1.08 1.62 0 2.24l-3.77 2.14-.07.04z" fill="#FFCE00" />
    <path d="m16.37 15.16-3.27-3.18-9.5 9.55c.36.38.94.42 1.6.05l11.17-6.42z" fill="#FF3D3D" />
    <path d="M16.37 8.82 5.2 2.4c-.66-.38-1.24-.33-1.6.05l9.5 9.53 3.27-3.16z" fill="#00E676" />
  </svg>
);

/**
 * Hand-drawn curve from the "Coming soon!" note up to the Play badge.
 *
 * Sits in its own absolutely-positioned box so it can point at the badge
 * without taking part in the flex row's layout, and is hidden from screen
 * readers because the note beside it already says the same thing.
 */
function ComingSoonArrow() {
  return (
    <svg
      width="96"
      height="58"
      viewBox="0 0 96 58"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute left-6 top-full text-neutral-400"
    >
      {/* Sweeps from beside the caption, out right, then back up under the
          badge — a hand-drawn loop rather than a straight pointer. */}
      <path
        d="M88 50C74 53 44 52 28 42C14 33.5 12 22 18 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 6"
      />
      {/* Arrowhead sits on the curve's end tangent, so it reads as one stroke. */}
      <path
        d="M11.5 18.5L18.5 9.5L26 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  const playLive = PLAY_STORE_URL !== null;

  return (
    // pb leaves room for the arrow and note, which hang below the row.
    <div className={`flex flex-wrap items-center gap-3 pb-16 ${className}`}>
      <a
        href={APP_STORE_URL}
        aria-label="Download on the App Store"
        className="inline-flex items-center gap-3 rounded-xl bg-neutral-900 px-5 py-2.5 text-white transition-transform hover:-translate-y-0.5 hover:bg-black"
      >
        <BadgeInner eyebrow="Download on the" title="App Store" icon={APPLE_ICON} />
      </a>

      {playLive ? (
        <a
          href={PLAY_STORE_URL}
          aria-label="Get it on Google Play"
          className="inline-flex items-center gap-3 rounded-xl bg-neutral-900 px-5 py-2.5 text-white transition-transform hover:-translate-y-0.5 hover:bg-black"
        >
          <BadgeInner eyebrow="Get it on" title="Google Play" icon={PLAY_ICON} />
        </a>
      ) : (
        <div className="relative">
          {/* A span, not a link: there is nothing to open yet, and a dead <a>
              would still look and behave clickable. */}
          <span
            aria-disabled="true"
            className="inline-flex cursor-default select-none items-center gap-3 rounded-xl bg-neutral-400 px-5 py-2.5 text-white/80"
          >
            <BadgeInner eyebrow="Get it on" title="Google Play" icon={PLAY_ICON} muted />
          </span>

          <ComingSoonArrow />
          <span className="absolute left-[112px] top-[calc(100%+38px)] whitespace-nowrap text-sm font-semibold text-neutral-500">
            Coming soon!
          </span>
        </div>
      )}
    </div>
  );
}
