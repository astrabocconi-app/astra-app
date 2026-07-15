// Dashboard login page — PLACEHOLDER.
// TODO(scaffold): wire Better Auth email-OTP admin sign-in. See docs/ARCHITECTURE.md.
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">ASTRA Dashboard</h1>
      <p className="text-sm text-gray-500">
        Sign-in is not implemented yet (scaffold). This page is a placeholder for
        the Better Auth email-OTP admin login.
      </p>
      <a className="text-sm underline" href="/dashboard">
        Go to dashboard skeleton →
      </a>
    </main>
  );
}
