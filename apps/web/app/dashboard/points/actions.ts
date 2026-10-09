"use server";

// Read-only lookup behind the manual-adjustment review step: who is this email,
// and what do they have now. Guarded like the page itself (a server action is a
// public POST endpoint), and it never writes.

import { prisma } from "@astra/db";
import { getBalance } from "@/lib/points";
import { requireDashboardPage } from "../_lib/session";

export type StudentLookup =
  | { found: true; email: string; name: string | null; balance: number }
  | { found: false; reason: string };

export async function lookUpStudent(rawEmail: string): Promise<StudentLookup> {
  await requireDashboardPage("points");
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!email) return { found: false, reason: "Enter the student's email." };

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true, roles: true },
  });
  if (!user) return { found: false, reason: `No account with the email ${email}.` };
  if (!user.roles.includes("STUDENT")) {
    return { found: false, reason: `${user.email} is a staff or venue account, not a student. Points are for students only.` };
  }
  return { found: true, email: user.email, name: user.name, balance: await getBalance(user.id) };
}
