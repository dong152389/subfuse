import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  apiError,
  getStringField,
  jsonBodyError,
  LOCAL_JSON_BODY_LIMITS,
  readJsonBody,
} from "@local/lib/http";
import {
  consumeLocalRateLimit,
  getTrustedClientRateLimitKey,
  hashLocalRateLimitKey,
  localRateLimitResponse,
  resetLocalRateLimit,
} from "@local/lib/rate-limit";
import {
  isValidEmail,
  USER_CREDENTIAL_MESSAGES,
  USER_PASSWORD_MIN_LENGTH,
} from "@local/lib/admin-credentials";
import { prisma } from "@local/lib/prisma";
import { verifyVerificationCode } from "@local/lib/verification-code";

export async function POST(request: Request) {
  const clientKey = getTrustedClientRateLimitKey(request);
  if (clientKey) {
    const limit = consumeLocalRateLimit("reset-password-client", clientKey, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return localRateLimitResponse("操作过于频繁，请稍后再试", limit.retryAfterSeconds);
    }
  }

  const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
  if (!parsedBody.ok) return jsonBodyError(parsedBody);
  const body = parsedBody.value;

  const rawEmail = getStringField(body, "email");
  const email = rawEmail.trim().toLowerCase();
  const code = getStringField(body, "code").trim();
  const password = getStringField(body, "password").trim();
  const passwordConfirm = getStringField(body, "passwordConfirm").trim();

  if (!email || !isValidEmail(email)) {
    return apiError(USER_CREDENTIAL_MESSAGES.emailInvalid, "BAD_REQUEST", 400);
  }

  if (!code || code.length !== 6) {
    return apiError(USER_CREDENTIAL_MESSAGES.codeRequired, "BAD_REQUEST", 400);
  }

  if (password.length < USER_PASSWORD_MIN_LENGTH) {
    return apiError(USER_CREDENTIAL_MESSAGES.passwordMinLength, "BAD_REQUEST", 400);
  }

  if (password !== passwordConfirm) {
    return apiError(USER_CREDENTIAL_MESSAGES.passwordMismatch, "BAD_REQUEST", 400);
  }

  const rateKey = hashLocalRateLimitKey(`reset-pwd-${email}`);
  const attemptLimit = consumeLocalRateLimit("reset-password-attempt", rateKey, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!attemptLimit.allowed) {
    return localRateLimitResponse("尝试次数过多，请稍后重新获取验证码", attemptLimit.retryAfterSeconds);
  }

  const user = await prisma.localAdmin.findFirst({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return apiError(USER_CREDENTIAL_MESSAGES.emailNotFound, "NOT_FOUND", 404);
  }

  const verifyResult = await verifyVerificationCode(email, "reset_password", code);
  if (!verifyResult.valid) {
    return apiError(verifyResult.error || "验证码错误或已过期", "UNAUTHORIZED", 401);
  }

  resetLocalRateLimit("reset-password-attempt", rateKey);

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.localAdmin.update({
    where: { id: user.id },
    data: {
      passwordHash,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    message: "密码已重置，请使用新密码登录",
  });
}
