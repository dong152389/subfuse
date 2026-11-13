import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { isSystemAdmin } from "@local/lib/auth";
import { isValidEmail, USER_PASSWORD_MIN_LENGTH } from "@local/lib/admin-credentials";
import {
  apiError,
  getBooleanField,
  getNumberField,
  getStringField,
  jsonBodyError,
  LOCAL_JSON_BODY_LIMITS,
  readJsonBody,
} from "@local/lib/http";
import { prisma } from "@local/lib/prisma";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const targetId = params.id;

  return withCurrentAdmin(async (admin) => {
    const isSysAdmin = await isSystemAdmin(admin.id);
    if (!isSysAdmin) {
      return apiError("仅系统管理员可修改用户信息", "FORBIDDEN", 403);
    }

    const firstAdmin = await prisma.localAdmin.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const targetUser = await prisma.localAdmin.findUnique({
      where: { id: targetId },
    });
    if (!targetUser) {
      return apiError("用户不存在", "NOT_FOUND", 404);
    }

    const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
    if (!parsedBody.ok) return jsonBodyError(parsedBody);
    const body = parsedBody.value as Record<string, unknown>;

    const data: any = {};

    // Password reset
    const newPassword = getStringField(body, "password");
    if (newPassword) {
      if (newPassword.length < USER_PASSWORD_MIN_LENGTH) {
        return apiError(`密码长度至少需要 ${USER_PASSWORD_MIN_LENGTH} 个字符`, "BAD_REQUEST", 400);
      }
      data.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    // Email update
    if ("email" in body) {
      const email = getStringField(body, "email").trim().toLowerCase() || null;
      if (email) {
        if (!isValidEmail(email)) {
          return apiError("请输入有效的邮箱地址", "BAD_REQUEST", 400);
        }
        const existing = await prisma.localAdmin.findFirst({
          where: { email, id: { not: targetId } },
          select: { id: true },
        });
        if (existing) {
          return apiError("该邮箱已被其他账号使用", "CONFLICT", 409);
        }
        data.email = email;
        data.emailVerifiedAt = new Date();
      } else {
        data.email = null;
        data.emailVerifiedAt = null;
      }
    }

    // Ban / Unban
    if ("isBanned" in body) {
      const isBanned = getBooleanField(body, "isBanned");
      if (isBanned) {
        if (firstAdmin && targetId === firstAdmin.id) {
          return apiError("无法封禁系统主管理员账号", "BAD_REQUEST", 400);
        }
        if (targetId === admin.id) {
          return apiError("无法封禁当前登录的管理员账号", "BAD_REQUEST", 400);
        }
        data.isBanned = true;
        data.banReason = getStringField(body, "banReason").trim() || "管理员操作封禁";
      } else {
        data.isBanned = false;
        data.banReason = null;
      }
    }

    // VIP settings
    if ("isVip" in body) {
      const isVip = getBooleanField(body, "isVip");
      data.isVip = isVip;
      if (isVip) {
        const vipDays = getNumberField(body, "vipDays");
        const customExpiresAt = getStringField(body, "vipExpiresAt").trim();
        if (customExpiresAt) {
          const parsed = new Date(customExpiresAt);
          if (!isNaN(parsed.getTime())) {
            data.vipExpiresAt = parsed;
          }
        } else if (vipDays && vipDays > 0) {
          data.vipExpiresAt = new Date(Date.now() + vipDays * 86400000);
        } else if (vipDays === 0 || vipDays === -1) {
          data.vipExpiresAt = null; // Lifetime VIP
        }
      } else {
        data.vipExpiresAt = null;
      }
    }

    const updated = await prisma.localAdmin.update({
      where: { id: targetId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        isBanned: true,
        banReason: true,
        isVip: true,
        vipExpiresAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        isBanned: updated.isBanned,
        banReason: updated.banReason,
        isVip: updated.isVip,
        vipExpiresAt: updated.vipExpiresAt ? updated.vipExpiresAt.toISOString() : null,
      },
      message: "用户信息更新成功",
    });
  });
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const targetId = params.id;

  return withCurrentAdmin(async (admin) => {
    const isSysAdmin = await isSystemAdmin(admin.id);
    if (!isSysAdmin) {
      return apiError("仅系统管理员可删除用户", "FORBIDDEN", 403);
    }

    const firstAdmin = await prisma.localAdmin.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (firstAdmin && targetId === firstAdmin.id) {
      return apiError("无法删除系统主管理员账号", "BAD_REQUEST", 400);
    }

    if (targetId === admin.id) {
      return apiError("无法删除当前正在登录的账号", "BAD_REQUEST", 400);
    }

    const targetUser = await prisma.localAdmin.findUnique({
      where: { id: targetId },
      select: { id: true, username: true },
    });
    if (!targetUser) {
      return apiError("用户不存在", "NOT_FOUND", 404);
    }

    await prisma.localAdmin.delete({
      where: { id: targetId },
    });

    return NextResponse.json({
      success: true,
      message: `用户 ${targetUser.username} 已成功删除`,
    });
  });
}
