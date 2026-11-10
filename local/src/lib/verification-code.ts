import { randomInt } from "node:crypto";
import { prisma } from "./prisma";

export const VERIFICATION_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const VERIFICATION_CODE_RESEND_INTERVAL_MS = 60 * 1000; // 60 seconds

export type VerificationPurpose = "login" | "register" | "github_bind" | "reset_password" | "bind";

/**
 * Generate a 6-digit numeric verification code.
 */
export function generateNumericCode(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Check if a new code can be sent to the target email.
 * Prevents spamming within 60 seconds.
 */
export async function canSendVerificationCode(target: string, purpose: VerificationPurpose): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
}> {
  const normalizedTarget = target.trim().toLowerCase();
  const latest = await prisma.verificationCode.findFirst({
    where: {
      target: normalizedTarget,
      purpose,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return { allowed: true };

  const elapsedMs = Date.now() - latest.createdAt.getTime();
  if (elapsedMs < VERIFICATION_CODE_RESEND_INTERVAL_MS) {
    const retryAfterSeconds = Math.ceil((VERIFICATION_CODE_RESEND_INTERVAL_MS - elapsedMs) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/**
 * Create and persist a new verification code.
 */
export async function createVerificationCode(target: string, purpose: VerificationPurpose): Promise<string> {
  const normalizedTarget = target.trim().toLowerCase();
  const code = generateNumericCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS);

  await prisma.verificationCode.create({
    data: {
      target: normalizedTarget,
      code,
      purpose,
      expiresAt,
    },
  });

  return code;
}

/**
 * Verify a code for the given target and purpose.
 * Marks the code as used upon successful verification.
 */
export async function verifyVerificationCode(
  target: string,
  purpose: VerificationPurpose,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const normalizedTarget = target.trim().toLowerCase();
  const normalizedCode = code.trim();

  if (!normalizedCode || normalizedCode.length !== 6) {
    return { valid: false, error: "请输入 6 位有效验证码" };
  }

  const record = await prisma.verificationCode.findFirst({
    where: {
      target: normalizedTarget,
      purpose,
      code: normalizedCode,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { valid: false, error: "验证码无效或已过期，请重新获取" };
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { valid: true };
}
