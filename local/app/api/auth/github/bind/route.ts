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
  localRateLimitResponse,
} from "@local/lib/rate-limit";
import { isValidEmail, USER_CREDENTIAL_MESSAGES } from "@local/lib/admin-credentials";
import { prisma } from "@local/lib/prisma";
import { verifyGitHubBindTicket } from "@local/lib/github-oauth";
import { verifyVerificationCode } from "@local/lib/verification-code";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@local/lib/session";

export async function POST(request: Request) {
  const clientKey = getTrustedClientRateLimitKey(request);
  if (clientKey) {
    const limit = consumeLocalRateLimit("github-bind-client", clientKey, {
      limit: 15,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return localRateLimitResponse("操作过于频繁，请稍后再试", limit.retryAfterSeconds);
    }
  }

  const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
  if (!parsedBody.ok) return jsonBodyError(parsedBody);
  const body = parsedBody.value;

  const ticket = getStringField(body, "ticket").trim();
  const rawEmail = getStringField(body, "email");
  const email = rawEmail.trim().toLowerCase();
  const code = getStringField(body, "code").trim();
  const customUsername = getStringField(body, "username").trim();

  if (!ticket) {
    return apiError("缺少 GitHub 绑定凭证，请重新授权", "BAD_REQUEST", 400);
  }

  const ticketPayload = await verifyGitHubBindTicket(ticket);
  if (!ticketPayload) {
    return apiError("GitHub 授权凭证已过期或无效，请重新发起 GitHub 登录", "UNAUTHORIZED", 401);
  }

  if (!email || !isValidEmail(email)) {
    return apiError(USER_CREDENTIAL_MESSAGES.emailInvalid, "BAD_REQUEST", 400);
  }

  if (!code || code.length !== 6) {
    return apiError(USER_CREDENTIAL_MESSAGES.codeRequired, "BAD_REQUEST", 400);
  }

  // Verify verification code
  const verifyResult = await verifyVerificationCode(email, "github_bind", code);
  if (!verifyResult.valid) {
    return apiError(verifyResult.error || "验证码错误或已过期", "UNAUTHORIZED", 401);
  }

  // Check if this githubId was already bound in between
  const githubTaken = await prisma.localAdmin.findUnique({
    where: { githubId: ticketPayload.githubId },
    select: { id: true },
  });
  if (githubTaken) {
    return apiError("该 GitHub 账号已被其他账户绑定", "CONFLICT", 409);
  }

  // Check if a user with this email already exists
  let user = await prisma.localAdmin.findFirst({
    where: { email },
    select: { id: true, username: true, avatarUrl: true },
  });

  if (user) {
    // Bind GitHub to existing user
    await prisma.localAdmin.update({
      where: { id: user.id },
      data: {
        githubId: ticketPayload.githubId,
        githubUsername: ticketPayload.githubUsername,
        avatarUrl: user.avatarUrl || ticketPayload.avatarUrl,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });
  } else {
    // Create new user
    let candidateUsername = customUsername || ticketPayload.githubUsername || "user";
    // Sanitize candidate username
    candidateUsername = candidateUsername.replace(/[^a-zA-Z0-9_\-一-龥]/g, "").slice(0, 32);
    if (candidateUsername.length < 3) {
      candidateUsername = `user_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.localAdmin.findUnique({
        where: { username: candidateUsername },
        select: { id: true },
      });
      if (!existing) break;
      candidateUsername = `${candidateUsername.slice(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
      attempts++;
    }

    user = await prisma.localAdmin.create({
      data: {
        username: candidateUsername,
        email,
        emailVerifiedAt: new Date(),
        githubId: ticketPayload.githubId,
        githubUsername: ticketPayload.githubUsername,
        avatarUrl: ticketPayload.avatarUrl,
        lastLoginAt: new Date(),
      },
      select: { id: true, username: true, avatarUrl: true },
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
