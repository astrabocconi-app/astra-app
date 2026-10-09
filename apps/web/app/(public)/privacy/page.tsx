import type { Metadata } from "next";
import { headers } from "next/headers";
import { PolicyView } from "./policy-view";
import type { Lang } from "./content";

// Public privacy policy for the ASTRA app (App Store / Play Store requirement),
// in English and Italian. The text lives in ./content.ts: update it whenever the
// real data practices change (new processor, new data category, new retention rule).

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy · Informativa sulla Privacy · ASTRA" },
  description:
    "How the ASTRA Bocconi app and website process personal data. / Come l'app e il sito ASTRA Bocconi trattano i dati personali.",
};

export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  // ?lang= wins; otherwise follow the browser, defaulting to English.
  let initial: Lang;
  if (lang === "it" || lang === "en") {
    initial = lang;
  } else {
    const accept = (await headers()).get("accept-language") ?? "";
    initial = /^\s*it\b/i.test(accept) ? "it" : "en";
  }
  return <PolicyView initial={initial} />;
}
