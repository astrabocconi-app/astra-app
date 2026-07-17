-- CreateTable
CREATE TABLE "PartnerMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "loginCode" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMembership_userId_key" ON "PartnerMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMembership_loginCode_key" ON "PartnerMembership"("loginCode");

-- CreateIndex
CREATE INDEX "PartnerMembership_partnerId_idx" ON "PartnerMembership"("partnerId");

-- AddForeignKey
ALTER TABLE "PartnerMembership" ADD CONSTRAINT "PartnerMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerMembership" ADD CONSTRAINT "PartnerMembership_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
