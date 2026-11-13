import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  getUserRegisterCredentialError,
  isValidEmail,
  USER_CREDENTIAL_MESSAGES,
} from "@local/lib/admin-credentials";
import { apiError, getStringField, jsonBodyError, LOCAL_JSON_BODY_LIMITS, readJsonBody } from "@local/lib/http";
import { prisma } from "@local/lib/prisma";
import { sessionCookieOptions, signSession, SESSION_COOKIE } from "@local/lib/session";
import {
  consumeLocalRateLimit,
  getTrustedClientRateLimitKey,
  hashLocalRateLimitKey,
  localRateLimitResponse,
  resetLocalRateLimit,
} from "@local/lib/rate-limit";
import { verifyVerificationCode } from "@local/lib/verification-code";
import { getEmailWhitelistSuffixes, isEmailWhitelisted } from "@local/lib/email-service";

const REGISTER_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const clientKey = getTrustedClientRateLimitKey(request);
  if (clientKey) {
    const clientLimit = consumeLocalRateLimit("auth-register-client", clientKey, {
      limit: 15,
      windowMs: REGISTER_WINDOW_MS,
    });
    if (!clientLimit.allowed) {
      return localRateLimitResponse("Too many registration attempts. Try again later.", clientLimit.retryAfterSeconds);
    }
  }

  const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
  if (!parsedBody.ok) return jsonBodyError(parsedBody, USER_CREDENTIAL_MESSAGES.invalidJson);
  const body = parsedBody.value;

  const username = getStringField(body, "username").trim();
  const password = getStringField(body, "password");
  const passwordConfirm = getStringField(body, "passwordConfirm");
  const rawEmail = getStringField(body, "email");
  const email = rawEmail.trim().toLowerCase();
  const code = getStringField(body, "code").trim();

  const credentialError = getUserRegisterCredentialError({ username, password, passwordConfirm });
  if (credentialError) {
    return apiError(credentialError, "BAD_REQUEST", 400);
  }

  // Check if email whitelist requires email verification for registration
  const whitelistSuffixes = await getEmailWhitelistSuffixes();
  if (whitelistSuffixes.length > 0 && !email) {
    return apiError(
      `系统已启用邮箱白名单注册限制，请填写符合要求的邮箱完成验证（允许后缀：${whitelistSuffixes.join("、")}）`,
      "BAD_REQUEST",
      400
    );
  }

  // If email is provided, validate email and verification code
  if (email) {
    if (!isValidEmail(email)) {
      return apiError(USER_CREDENTIAL_MESSAGES.emailInvalid, "BAD_REQUEST", 400);
    }
    // Check email whitelist
    const whitelist = await isEmailWhitelisted(email);
    if (!whitelist.allowed) {
      return apiError(
        `该邮箱后缀不在允许注册的范围内，仅允许以下后缀：${whitelist.suffixes.join("、")}`,
        "BAD_REQUEST",
        400
      );
    }
    if (!code || code.length !== 6) {
      return apiError(USER_CREDENTIAL_MESSAGES.codeRequired, "BAD_REQUEST", 400);
    }
    const existingEmail = await prisma.localAdmin.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingEmail) {
      return apiError(USER_CREDENTIAL_MESSAGES.emailExists, "CONFLICT", 409);
    }
    const verifyResult = await verifyVerificationCode(email, "register", code);
    if (!verifyResult.valid) {
      return apiError(verifyResult.error || "验证码错误或已过期", "UNAUTHORIZED", 401);
    }
  }

  const usernameLimitKey = hashLocalRateLimitKey(username.toLowerCase());
  const usernameLimit = consumeLocalRateLimit("auth-register-username", usernameLimitKey, {
    limit: 5,
    windowMs: REGISTER_WINDOW_MS,
  });
  if (!usernameLimit.allowed) {
    return localRateLimitResponse("Too many registration attempts. Try again later.", usernameLimit.retryAfterSeconds);
  }

  const existing = await prisma.localAdmin.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return apiError(USER_CREDENTIAL_MESSAGES.userExists, "CONFLICT", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.localAdmin.create({
    data: {
      username,
      passwordHash,
      email: email || null,
      emailVerifiedAt: email ? new Date() : null,
      lastLoginAt: new Date(),
    },
    select: { id: true, username: true },
  });

  resetLocalRateLimit("auth-register-username", usernameLimitKey);

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
