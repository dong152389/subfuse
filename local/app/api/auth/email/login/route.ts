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
import { isValidEmail, USER_CREDENTIAL_MESSAGES } from "@local/lib/admin-credentials";
import { prisma } from "@local/lib/prisma";
import { verifyVerificationCode } from "@local/lib/verification-code";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@local/lib/session";

function generateUsernameFromEmail(email: string): string {
  const prefix = email.split("@")[0].replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 16);
  const base = prefix || "user";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}_${suffix}`;
}

export async function POST(request: Request) {
  const clientKey = getTrustedClientRateLimitKey(request);
  if (clientKey) {
    const limit = consumeLocalRateLimit("email-login-client", clientKey, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return localRateLimitResponse("登录尝试过于频繁，请稍后再试", limit.retryAfterSeconds);
    }
  }

  const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
  if (!parsedBody.ok) return jsonBodyError(parsedBody);
  const body = parsedBody.value;

  const rawEmail = getStringField(body, "email");
  const email = rawEmail.trim().toLowerCase();
  const code = getStringField(body, "code").trim();

  if (!email || !isValidEmail(email)) {
    return apiError(USER_CREDENTIAL_MESSAGES.emailInvalid, "BAD_REQUEST", 400);
  }

  if (!code || code.length !== 6) {
    return apiError(USER_CREDENTIAL_MESSAGES.codeRequired, "BAD_REQUEST", 400);
  }

  const emailRateKey = hashLocalRateLimitKey(`verify-${email}`);
  const attemptLimit = consumeLocalRateLimit("email-verify-attempt", emailRateKey, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!attemptLimit.allowed) {
    return localRateLimitResponse("验证码尝试次数过多，请重新获取验证码", attemptLimit.retryAfterSeconds);
  }

  // Verify the code
  const verifyResult = await verifyVerificationCode(email, "login", code);
  if (!verifyResult.valid) {
    return apiError(verifyResult.error || "验证码错误或已过期", "UNAUTHORIZED", 401);
  }

  resetLocalRateLimit("email-verify-attempt", emailRateKey);

  // Check if user already exists with this email
  let user = await prisma.localAdmin.findFirst({
    where: { email },
    select: { id: true, username: true, email: true },
  });

  if (!user) {
    // Auto-create user for new email
    let candidateUsername = generateUsernameFromEmail(email);
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.localAdmin.findUnique({
        where: { username: candidateUsername },
        select: { id: true },
      });
      if (!existing) break;
      candidateUsername = `${candidateUsername.slice(0, 16)}_${Math.floor(1000 + Math.random() * 9000)}`;
      attempts++;
    }

    user = await prisma.localAdmin.create({
      data: {
        username: candidateUsername,
        email,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
      select: { id: true, username: true, email: true },
    });
  } else {
    await prisma.localAdmin.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    });
  }

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username },
  });

  response.cookies.set(
    SESSION_COOKIE,
    await signSession({ adminId: user.id, username: user.username }),
    sessionCookieOptions()
  );

  return response;
}
