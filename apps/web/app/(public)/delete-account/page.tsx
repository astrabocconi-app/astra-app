import type { Metadata } from "next";
import { AstraLogo } from "@/app/_ui/logo";

// Public account-deletion page. Google Play requires a URL, on the web, that
// explains how to ask for an account and its data to be deleted and what happens
// to the data. The wording mirrors the privacy policy ("Deleting your account").

export const metadata: Metadata = {
  title: { absolute: "Delete your account · myAstra" },
  description: "How to delete your myAstra account and its data. / Come eliminare il tuo account myAstra e i tuoi dati.",
};

const EMAIL = "info@astrabocconi.com";

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-neutral-100 pt-6">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-neutral-600">{children}</div>
    </div>
  );
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-6 text-astra-primary">
        <AstraLogo size={28} />
        <span className="text-lg font-extrabold tracking-tight">ASTRA</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tight">Delete your myAstra account</h1>
        <p className="mt-3 text-lg text-neutral-600">
          myAstra is the app of ASTRA, the Bocconi student association. You can delete your account and
          its data yourself in the app, or ask us to do it. / Puoi eliminare il tuo account e i tuoi dati
          direttamente dall&apos;app, oppure chiederlo a noi.
        </p>

        <div className="mt-10 space-y-8">
          <Item title="In the app (immediate) / Dall'app (immediato)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open myAstra and sign in. / Apri myAstra e accedi.</li>
              <li>Go to Profile. / Vai su Profilo.</li>
              <li>Tap &quot;Delete my account&quot; and confirm. / Tocca &quot;Elimina il mio account&quot; e conferma.</li>
            </ol>
            <p>Deletion takes effect straight away and cannot be undone.</p>
          </Item>

          <Item title="By email / Via email">
            <p>
              If you cannot sign in, write to{" "}
              <a
                className="font-semibold text-astra-primary underline underline-offset-4"
                href={`mailto:${EMAIL}?subject=${encodeURIComponent("Delete my myAstra account")}`}
              >
                {EMAIL}
              </a>{" "}
              from your university address (@studbocconi.it or @unibocconi.it) with the subject
              &quot;Delete my myAstra account&quot;. We delete the account within 30 days, usually much sooner.
            </p>
            <p>
              Se non riesci ad accedere, scrivici dal tuo indirizzo universitario: eliminiamo l&apos;account
              entro 30 giorni.
            </p>
          </Item>

          <Item title="What is deleted / Cosa viene eliminato">
            <p>
              Your email address (replaced by an unusable placeholder), name, avatar, study profile, sign-in
              sessions, push tokens, event registrations and tickets, in-app discount codes, material access
              records, partner-discount usage, memberships, consents and support messages. Personal discount
              codes created for you on Eventbrite are revoked.
            </p>
          </Item>

          <Item title="What is kept / Cosa viene conservato">
            <p>
              The points ledger and reward redemptions stay attached to an anonymous account with no name,
              email or personal details, which can never be signed into; this protects the integrity of the
              points system. The staff audit log is kept. A one-way hash of your email is kept so a deleted
              account cannot claim the signup bonus again; the address cannot be recovered from it. Provider
              backups are overwritten on their own short rolling schedule.
            </p>
            <p>
              See the <a className="font-semibold text-astra-primary underline underline-offset-4" href="/privacy">privacy policy</a> for details.
            </p>
          </Item>
        </div>
      </main>
    </div>
  );
}
