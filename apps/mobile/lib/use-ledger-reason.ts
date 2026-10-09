import { ledgerLabel } from "./ledger-label";
import { useT, type TranslationKey } from "./i18n";

/**
 * The points-history line for an entry, in the app's language. The server stores
 * the reason as an English sentence; known shapes are rebuilt from the entry's
 * `source` and parts, anything else is shown as the server wrote it.
 */
export function useLedgerReason() {
  const t = useT();
  return (source: string, reason: string): string => {
    const label = ledgerLabel(source, reason);
    return label ? t(label.key as TranslationKey, label.vars) : reason;
  };
}
