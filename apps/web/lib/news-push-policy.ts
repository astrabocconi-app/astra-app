// Pure rule behind the news "notify" toggle (no imports, so tests can load it).

/** Pure: should this save send a notification? */
export function shouldNotify(opts: {
  requested: boolean;
  published: boolean;
  alreadyPushedAt: Date | null;
  notifyAgain: boolean;
}): boolean {
  return opts.requested && opts.published && (opts.alreadyPushedAt === null || opts.notifyAgain);
}
