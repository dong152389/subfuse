-- AlterTable
ALTER TABLE "LocalAdmin" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "LocalAdmin" ADD COLUMN "email" TEXT;
ALTER TABLE "LocalAdmin" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "LocalAdmin" ADD COLUMN "githubId" TEXT;
ALTER TABLE "LocalAdmin" ADD COLUMN "githubUsername" TEXT;
ALTER TABLE "LocalAdmin" ADD COLUMN "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalAdmin_email_key" ON "LocalAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAdmin_githubId_key" ON "LocalAdmin"("githubId");

-- CreateIndex
CREATE INDEX "VerificationCode_target_purpose_idx" ON "VerificationCode"("target", "purpose");

-- CreateIndex
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");
