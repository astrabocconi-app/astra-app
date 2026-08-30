import { astraWorldContent, ASTRAWORLD_DEFAULT, type AstraWorldContent } from "@astra/shared";

/**
 * The event content the app falls back to.
 *
 * Not a placeholder: if the backoffice has never been used, or the API is
 * unreachable, or a stored row fails validation, the screen renders this rather
 * than going blank. Editing in the backoffice overrides it.
 *
 * The literal lives in @astra/shared so the backoffice editor seeds from the
 * same source — two copies would drift the first time anyone fixed a typo in
 * one of them.
 */
export const BUNDLED_ASTRAWORLD: AstraWorldContent = ASTRAWORLD_DEFAULT;

/**
 * Validate whatever the server returned, falling back to the bundled copy.
 *
 * Parsed rather than trusted: the row is free-form JSON that a person edits by
 * hand, so a bad save must degrade to the shipped content instead of crashing
 * the tab.
 */
export function resolveAstraWorld(remote: unknown): AstraWorldContent {
  const parsed = astraWorldContent.safeParse(remote);
  return parsed.success ? parsed.data : BUNDLED_ASTRAWORLD;
}
