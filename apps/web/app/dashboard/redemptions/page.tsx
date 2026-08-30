import Link from "next/link";
import { RedemptionStatus } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { EmptyState } from "@/app/_ui/empty-state";
import { GiftIcon } from "@/app/_ui/icons";
import { Input } from "@/app/_ui/field";
import { listRedemptions, countByStatus } from "@/lib/redemptions";
import { RedemptionRow } from "./redemption-row";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "PENDING", label: "To hand over" },
  { key: "FULFILLED", label: "Collected" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

/**
 * Redemptions queue.
 *
 * Rewards with a voucher pool fulfil themselves. Everything physical lands here
 * as "to hand over" and needs someone to tick it off, which is the whole point
 * of the screen: before this, those redemptions had taken the student's points
 * and could never be closed.
 */
export default async function RedemptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const active = (TABS.find((t) => t.key === status)?.key ?? "PENDING") as RedemptionStatus;
  const query = q?.trim() ?? "";

  const [rows, counts] = await Promise.all([
    listRedemptions({ status: active, query }),
    countByStatus(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Redemptions"
        subtitle="Rewards students have claimed. Tick off the ones you hand over."
      />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const on = t.key === active;
          const n = counts[t.key] ?? 0;
          return (
            <Link
              key={t.key}
              href={`/dashboard/redemptions?status=${t.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                on ? "bg-astra-primary text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.label}
              {n > 0 ? ` (${n})` : ""}
            </Link>
          );
        })}

        <form className="ml-auto w-64" action="/dashboard/redemptions">
          <input type="hidden" name="status" value={active} />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Name, email or code…"
            aria-label="Search redemptions"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<GiftIcon size={28} />}
          title={
            query
              ? "Nothing matches that search"
              : active === "PENDING"
                ? "Nothing waiting"
                : active === "FULFILLED"
                  ? "Nothing collected yet"
                  : "Nothing cancelled"
          }
          description={
            active === "PENDING"
              ? "When someone redeems a reward that isn't a voucher code, it appears here to be handed over."
              : "Redemptions move here once you act on them."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Props passed explicitly rather than spread. Spreading the row was
              how a field called `ref` reached a client component, which React
              reserves and refuses across the server boundary — the page failed
              to load with nothing in the logs. */}
          {rows.map((r) => (
            <RedemptionRow
              key={r.id}
              id={r.id}
              pickupRef={r.pickupRef}
              status={r.status}
              costPoints={r.costPoints}
              code={r.code}
              createdAt={r.createdAt}
              fulfilledAt={r.fulfilledAt}
              rewardTitle={r.rewardTitle}
              student={r.student}
            />
          ))}
        </div>
      )}
    </div>
  );
}
