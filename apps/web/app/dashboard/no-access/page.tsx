import { PageHeader } from "@/app/_ui/page-header";

// Where requirePage() sends someone who has no page at all to fall back to.
// Rare: the dashboard layout catches the empty case first. This exists so the
// redirect can never point at a route that does not resolve.

export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  return (
    <>
      <PageHeader
        title="No access"
        subtitle="This account has not been given access to that section."
      />
      <p className="text-sm text-gray-500">
        Ask an admin to grant it from Administration &rsaquo; Team.
      </p>
    </>
  );
}
