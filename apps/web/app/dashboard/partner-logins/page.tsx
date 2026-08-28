import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { PartnerAccountManager } from "./account-manager";

export const dynamic = "force-dynamic";

export default async function PartnerLoginsPage() {
  const [partners, accounts] = await Promise.all([
    prisma.partner.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.partnerMembership.findMany({
      include: { partner: { select: { id: true, name: true } } },
      orderBy: [{ partner: { name: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Partner logins"
        subtitle="Venue accounts for the scanner app — separate from student users."
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
        }))}
      />
    </>
  );
}
