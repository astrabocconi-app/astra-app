import type { Metadata } from "next";
import { AstraLogo } from "@/app/_ui/logo";

// Public support page. This is the URL given to App Store Connect, which is
// checked during review: a marketing homepage with no visible way to get help
// is a known rejection trigger, so this states plainly how to reach us.

export const metadata: Metadata = {
  title: "Support · myAstra",
  description: "How to get help with the myAstra app, and how to delete your account.",
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

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-6 text-astra-primary">
        <AstraLogo size={28} />
        <span className="text-lg font-extrabold tracking-tight">ASTRA</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tight">Support</h1>
        <p className="mt-3 text-lg text-neutral-600">
          Something not working, a question, or an idea for myAstra? We read everything.
        </p>

        <div className="mt-8 rounded-2xl bg-astra-light p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-astra-primary">
            Get in touch
          </p>
          <a
            href={`mailto:${EMAIL}?subject=${encodeURIComponent("myAstra support")}`}
            className="mt-1 block text-2xl font-bold text-astra-primary underline underline-offset-4"
          >
            {EMAIL}
          </a>
          <p className="mt-2 text-sm text-neutral-600">
            We usually reply within a couple of days during term.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          <Item title="From inside the app">
            <p>
              Tap the question mark next to your profile picture on the home screen. It opens a
              short form for a question, a problem or an idea. Messages arrive with your account
              attached, so we always have an address to reply to.
            </p>
          </Item>

          <Item title="Signing in">
            <p>
              myAstra is for Bocconi students, so sign-in uses your university email address
              (@studbocconi.it or @unibocconi.it). We send a six-digit code to that address; there
              is no password to remember or lose.
            </p>
            <p>
              If the code does not arrive, check your spam folder first, then write to us at the
              address above and we will look into it.
            </p>
          </Item>

          <Item title="Points and rewards">
            <p>
              Points are earned by showing your membership QR at partner venues and at association
              events. If a scan did not register, tell us where and roughly when and we can check
              the record.
            </p>
            <p>
              Some rewards give you a code immediately. Others are collected in person: the app
              shows a short reference to give us at the ASTRA desk.
            </p>
          </Item>

          <Item title="Deleting your account">
            <p>
              Open <strong>Profile</strong> and choose <strong>Delete my account</strong>. This
              removes your profile, your course selection and your saved devices, and signs you out
              everywhere. It cannot be undone.
            </p>
            <p>
              If you cannot sign in to do it yourself, email us from your Bocconi address and we
              will take care of it.
            </p>
          </Item>

          <Item title="Privacy">
            <p>
              What we store and why is set out in our{" "}
              <a href="/privacy" className="text-astra-primary underline underline-offset-2">
                privacy policy
              </a>
              .
            </p>
          </Item>
        </div>

        <p className="mt-14 text-sm text-neutral-400">
          ASTRABOCCONI APS · Milan · myAstra is built and run by Bocconi students.
        </p>
      </main>
    </div>
  );
}
