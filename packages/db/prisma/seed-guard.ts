// Refuse to seed a database that is not on this machine.
//
// The seeds create a published "Launch Night" event, an active venue, an active
// reward and (seed-partner) a login with a known password. `vercel env pull`
// fills apps/web/.env with the PRODUCTION connection string, so running a seed
// by habit would put that in front of real students. Set ALLOW_REMOTE_SEED=1 to
// override for a throwaway Neon branch you created for the purpose.

export function assertSafeToSeed(connectionString: string | undefined): void {
  if (process.env.ALLOW_REMOTE_SEED === "1") return;
  let host = "";
  try {
    host = new URL(connectionString ?? "").hostname;
  } catch {
    // fall through: an unparseable URL is not provably local
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"].includes(host);
  if (!local) {
    throw new Error(
      `Refusing to seed "${host || "an unknown database"}": it is not a local database. ` +
        "Point DATABASE_URL at a local Postgres, or set ALLOW_REMOTE_SEED=1 for a disposable branch.",
    );
  }
}
