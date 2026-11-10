import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { apiError, getStringField, jsonBodyError, LOCAL_JSON_BODY_LIMITS, readJsonBody } from "@local/lib/http";
import { isValidEmail, USER_CREDENTIAL_MESSAGES } from "@local/lib/admin-credentials";
import { prisma } from "@local/lib/prisma";
import { verifyVerificationCode } from "@local/lib/verification-code";

export async function POST(request: Request) {
  return withCurrentAdmin(async (admin) => {
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

    // Check if email already used by another user
    const existing = await prisma.localAdmin.findFirst({
      where: {
        email,
        NOT: { id: admin.id },
      },
      select: { id: true },
    });
    if (existing) {
      return apiError(USER_CREDENTIAL_MESSAGES.emailExists, "CONFLICT", 409);
    }

    // Verify code
    const verifyResult = await verifyVerificationCode(email, "bind", code);
    if (!verifyResult.valid) {
      return apiError(verifyResult.error || "验证码错误或已过期", "UNAUTHORIZED", 401);
    }

    await prisma.localAdmin.update({
      where: { id: admin.id },
      data: {
        email,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      email,
      message: "邮箱绑定成功",
    });
  });
}
