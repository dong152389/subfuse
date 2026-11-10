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
} from "@local/lib/rate-limit";
import { isValidEmail, USER_CREDENTIAL_MESSAGES } from "@local/lib/admin-credentials";
import { prisma } from "@local/lib/prisma";
import {
  canSendVerificationCode,
  createVerificationCode,
  type VerificationPurpose,
} from "@local/lib/verification-code";
import { isSmtpConfigured, sendVerificationCodeEmail } from "@local/lib/email-service";

const VALID_PURPOSES: VerificationPurpose[] = [
  "login",
  "register",
  "github_bind",
  "reset_password",
  "bind",
];

export async function POST(request: Request) {
  // Check if SMTP is configured
  const configured = await isSmtpConfigured();
  if (!configured) {
    return apiError("系统未配置 SMTP 邮件服务，无法发送验证码", "CONFIGURATION_ERROR", 503);
  }

  // Rate limit by client IP
  const clientKey = getTrustedClientRateLimitKey(request);
  if (clientKey) {
    const limit = consumeLocalRateLimit("send-email-code-client", clientKey, {
      limit: 15,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return localRateLimitResponse("请求过于频繁，请稍后再试", limit.retryAfterSeconds);
    }
  }

  const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
  if (!parsedBody.ok) return jsonBodyError(parsedBody);
  const body = parsedBody.value;

  const rawEmail = getStringField(body, "email");
  const email = rawEmail.trim().toLowerCase();
  const purpose = getStringField(body, "purpose") as VerificationPurpose;

  if (!email || !isValidEmail(email)) {
    return apiError(USER_CREDENTIAL_MESSAGES.emailInvalid, "BAD_REQUEST", 400);
  }

  if (!VALID_PURPOSES.includes(purpose)) {
    return apiError("无效的验证场景", "BAD_REQUEST", 400);
  }

  // Specific validations per purpose
  if (purpose === "register") {
    const existing = await prisma.localAdmin.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return apiError(USER_CREDENTIAL_MESSAGES.emailExists, "CONFLICT", 409);
    }
  } else if (purpose === "reset_password") {
    const existing = await prisma.localAdmin.findFirst({
      where: { email },
      select: { id: true },
    });
    if (!existing) {
      return apiError(USER_CREDENTIAL_MESSAGES.emailNotFound, "NOT_FOUND", 404);
    }
  }

  // Rate limit by email target (60s cool down)
  const emailRateKey = hashLocalRateLimitKey(`${email}-${purpose}`);
  const emailLimit = consumeLocalRateLimit("send-email-code-target", emailRateKey, {
    limit: 1,
    windowMs: 60 * 1000,
  });
  if (!emailLimit.allowed) {
    return localRateLimitResponse("验证码发送太频繁，请稍后重试", emailLimit.retryAfterSeconds);
  }

  const canSend = await canSendVerificationCode(email, purpose);
  if (!canSend.allowed) {
    return localRateLimitResponse("验证码发送太频繁，请稍后重试", canSend.retryAfterSeconds || 60);
  }

  // Generate code and send
  const code = await createVerificationCode(email, purpose);
  const result = await sendVerificationCodeEmail(email, code, purpose);

  if (!result.success) {
    return apiError(result.error || "邮件发送失败，请检查 SMTP 配置", "INTERNAL_ERROR", 502);
  }

  return NextResponse.json({
    success: true,
    message: "验证码已发送至您的邮箱，请查收",
  });
}
