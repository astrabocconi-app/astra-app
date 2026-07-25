// App Store + Google Play download badges, drawn inline (no external images).
// The app isn't published yet, so they link to "#" and are marked coming-soon;
// swap the hrefs for the real store URLs once listings exist.

function Badge({
  href,
  eyebrow,
  title,
  icon,
}: {
  href: string;
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={`${eyebrow} ${title}`}
      className="inline-flex items-center gap-3 rounded-xl bg-neutral-900 px-5 py-2.5 text-white transition-transform hover:-translate-y-0.5 hover:bg-black"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium text-white/70">{eyebrow}</span>
        <span className="mt-0.5 text-lg font-semibold tracking-tight">{title}</span>
      </span>
    </a>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Badge
        href="#"
        eyebrow="Download on the"
        title="App Store"
        icon={
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        }
      />
      <Badge
        href="#"
        eyebrow="Get it on"
        title="Google Play"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.6 2.4c-.24.25-.38.63-.38 1.13v16.94c0 .5.14.88.38 1.13l.06.05L13.1 12v-.02L3.66 2.35l-.06.05z" fill="#00D2FF" />
            <path d="M16.3 15.2 13.1 12v-.02l3.2-3.2.07.04 3.77 2.14c1.08.61 1.08 1.62 0 2.24l-3.77 2.14-.07.04z" fill="#FFCE00" />
            <path d="m16.37 15.16-3.27-3.18-9.5 9.55c.36.38.94.42 1.6.05l11.17-6.42z" fill="#FF3D3D" />
            <path d="M16.37 8.82 5.2 2.4c-.66-.38-1.24-.33-1.6.05l9.5 9.53 3.27-3.16z" fill="#00E676" />
          </svg>
        }
      />
    </div>
  );
}
