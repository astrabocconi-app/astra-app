// App Store + Google Play download badges, drawn inline (no external images).
//
// Android is not published yet, so that badge is deliberately inert and greyed
// out with a "Coming soon!" note beneath it. Showing it as a live button would
// promise a download that does not exist; hiding it entirely would lose the
// signal that Android is coming. Swap `PLAY_STORE_URL` in when the listing is up
// and the badge lights up on its own.

/** null until the App Store listing is ready. */
const APP_STORE_URL: string | null = null;
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
 * Curve from the "Coming soon" note up to the badge.
 *
 * One shape, drawn once: the arrowhead is an SVG `<marker>` with
 * `orient="auto"`, so the browser rotates it to match the path's own
 * direction instead of us hand-computing triangle points. The mirrored
 * (App Store) side is the same markup flipped with a CSS transform rather
 * than a second, hand-mirrored copy of the path.
 *
 * Sits in its own absolutely-positioned box so it can point at the badge
 * without taking part in the flex row's layout, and is hidden from screen
 * readers because the note beside it already says the same thing.
 */
function ComingSoonArrow({ id, flipped = false }: { id: string; flipped?: boolean }) {
  const markerId = `coming-soon-arrowhead-${id}`;
  return (
    <svg
      width="96"
      height="58"
      viewBox="0 0 96 58"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute top-full text-neutral-400 ${
        flipped ? "right-6 -scale-x-100" : "left-6"
      }`}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0 0 10 5 0 10 Z" fill="currentColor" />
        </marker>
      </defs>
      {/* Sweeps up from beside the caption to just short of the badge. Dashed,
          with pathLength normalizing the curve to 64 units — 9 full "1 off 6"
          periods (63) plus one more dash (1) — so the pattern always ends on
          a visible dot exactly at the curve's endpoint, flush with the solid
          connector below instead of stopping mid-gap. */}
      <path
        d="M78 50Q40 54 24 22"
        pathLength="64"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 6"
      />
      {/* Solid connector carrying the arrowhead marker. A plain straight
          segment, so the marker's auto-orientation is exact. */}
      <path
        d="M24 22L20 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  const appLive = APP_STORE_URL !== null;
  const playLive = PLAY_STORE_URL !== null;

  return (
    // pb leaves room for the arrow and note, which hang below the row.
    <div className={`flex flex-wrap items-center gap-3 pb-16 ${className}`}>
      {appLive ? (
        <a
          href={APP_STORE_URL}
          aria-label="Download on the App Store"
          className="inline-flex items-center gap-3 rounded-xl bg-neutral-900 px-5 py-2.5 text-white transition-transform hover:-translate-y-0.5 hover:bg-black"
        >
          <BadgeInner eyebrow="Download on the" title="App Store" icon={APPLE_ICON} />
        </a>
      ) : (
        <div className="relative">
          <span
            aria-disabled="true"
            className="inline-flex cursor-default select-none items-center gap-3 rounded-xl bg-neutral-400 px-5 py-2.5 text-white/80"
          >
            <BadgeInner eyebrow="Download on the" title="App Store" icon={APPLE_ICON} muted />
          </span>

          <ComingSoonArrow id="app-store" flipped />
          <span className="absolute right-[112px] top-[calc(100%+38px)] whitespace-nowrap text-sm font-semibold text-neutral-500">
            Coming next week
          </span>
        </div>
      )}

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
          <span
            aria-disabled="true"
            className="inline-flex cursor-default select-none items-center gap-3 rounded-xl bg-neutral-400 px-5 py-2.5 text-white/80"
          >
            <BadgeInner eyebrow="Get it on" title="Google Play" icon={PLAY_ICON} muted />
          </span>

          <ComingSoonArrow id="play-store" />
          <span className="absolute left-[112px] top-[calc(100%+38px)] whitespace-nowrap text-sm font-semibold text-neutral-500">
            Coming soon!
          </span>
        </div>
      )}
    </div>
  );
}
