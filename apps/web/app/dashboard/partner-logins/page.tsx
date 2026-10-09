import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { PartnerAccountManager } from "./account-manager";
import { requireDashboardPage } from "../_lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venue logins" };

export default async function PartnerLoginsPage() {
  await requireDashboardPage("partner-logins");
  const [partners, accounts] = await Promise.all([
    prisma.partner.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.partnerMembership.findMany({
      include: { partner: { select: { id: true, name: true, deletedAt: true } } },
      orderBy: [{ partner: { name: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Venue logins"
        subtitle="Accounts venue staff use to scan student cards. Separate from student accounts."
      />
      <PartnerAccountManager
        partners={partners}
        accounts={accounts.map((a) => ({
          id: a.id,
          partnerId: a.partnerId,
          partnerName: a.partner.name,
          loginCode: a.loginCode,
          label: a.label,
          scanOnly: a.scanOnly,
          venueDeleted: a.partner.deletedAt !== null,
        }))}
      />
    </>
  );
}
