// Mailbox failover for outgoing sign-in email. SERVER-ONLY.
//
// Aruba caps how much a single mailbox may send per hour. Sign-in email is the
// one thing that must not fail — a student who can't get a code can't use the
// app at all — and launch day is exactly the spike that trips an hourly cap on
// a mailbox that normally sends a handful.
//
// Split out from lib/auth.ts so the ordering can be tested with fakes: this
// path only runs when something is already going wrong, which is precisely the
// code most likely to be silently broken by the time it matters.

export interface Mailbox {
  label: string;
  /** Epoch ms; while in the future this mailbox is tried last, never skipped. */
  blockedUntil: number;
}

/** Quota and throttling refusals, as opposed to a bad recipient or bad auth. */
export function looksRateLimited(e: unknown): boolean {
  const err = e as { responseCode?: number; message?: string };
  if (err?.responseCode === 421 || err?.responseCode === 450 || err?.responseCode === 452) {
    return true;
  }
  return /quota|rate limit|too many|limit exceeded|try again later/i.test(err?.message ?? "");
}

export class AllMailboxesFailedError extends Error {
  // Declared and assigned explicitly rather than as a constructor parameter
  // property: Node's --experimental-strip-types only erases types, and a
  // parameter property needs real transformation, so it breaks the test run.
  failures: string[];

  constructor(failures: string[]) {
    super(`Every mailbox refused: ${failures.join(" | ")}`);
    this.name = "AllMailboxesFailedError";
    this.failures = failures;
  }
}

/**
 * Try each mailbox until one accepts the message.
 *
 * Mailboxes in cooldown are tried LAST rather than skipped: the cooldown is our
 * own guess about a remote limit, and a guess must never be the reason someone
 * cannot sign in. It only ever reorders attempts.
 *
 * Returns the mailbox that accepted the message.
 */
export async function sendWithFailover<T extends Mailbox>(
  mailboxes: T[],
  send: (mailbox: T) => Promise<void>,
  options: {
    cooldownMs: number;
    now?: () => number;
    onWarn?: (message: string) => void;
  },
): Promise<T> {
  const now = options.now ?? (() => Date.now());
  const failures: string[] = [];

  const ready = mailboxes.filter((m) => m.blockedUntil <= now());
  const cooling = mailboxes.filter((m) => m.blockedUntil > now());

  for (const mailbox of [...ready, ...cooling]) {
    try {
      await send(mailbox);
      // It works again; clear any cooldown so it returns to first choice.
      mailbox.blockedUntil = 0;
      return mailbox;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failures.push(`${mailbox.label}: ${reason}`);
      if (looksRateLimited(e)) {
        mailbox.blockedUntil = now() + options.cooldownMs;
        options.onWarn?.(`SMTP ${mailbox.label} mailbox rate limited: ${reason}`);
      } else {
        options.onWarn?.(`SMTP ${mailbox.label} send failed: ${reason}`);
      }
    }
  }

  throw new AllMailboxesFailedError(failures);
}
