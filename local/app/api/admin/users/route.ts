import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { isSystemAdmin, resolveUserQuota } from "@local/lib/auth";
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

function parseOptionalQuota(value: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return { ok: false, error: "配额数量必须为大于等于 0 的整数" };
  }
  return { ok: true, value: num };
}

export async function GET(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const isSysAdmin = await isSystemAdmin(admin.id);
    if (!isSysAdmin) {
      return apiError("仅系统管理员可查看用户列表", "FORBIDDEN", 403);
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const role = (searchParams.get("role") || "all").trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));

    const firstAdmin = await prisma.localAdmin.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role === "banned") {
      where.isBanned = true;
    } else if (role === "vip") {
      where.isVip = true;
    } else if (role === "admin" && firstAdmin) {
      where.id = firstAdmin.id;
    } else if (role === "user" && firstAdmin) {
      where.id = { not: firstAdmin.id };
    }

    const [total, users, totalUsers, totalVip, totalBanned, totalActiveToday] = await Promise.all([
      prisma.localAdmin.count({ where }),
      prisma.localAdmin.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          emailVerifiedAt: true,
          githubId: true,
          githubUsername: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          isBanned: true,
          banReason: true,
          isVip: true,
          vipExpiresAt: true,
          maxSubscriptions: true,
          maxCustomTemplates: true,
          maxNodesPerSubscription: true,
          _count: {
            select: {
              subscriptions: true,
              templates: true,
            },
          },
        },
      }),
      prisma.localAdmin.count(),
      prisma.localAdmin.count({ where: { isVip: true } }),
      prisma.localAdmin.count({ where: { isBanned: true } }),
      prisma.localAdmin.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => {
      const isVipActive = Boolean(
        u.isVip && (!u.vipExpiresAt || u.vipExpiresAt.getTime() > Date.now())
      );
      const isSysAdmin = Boolean(firstAdmin && u.id === firstAdmin.id);
      const effectiveQuota = resolveUserQuota(u, isSysAdmin);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        emailVerified: Boolean(u.emailVerifiedAt),
        githubId: u.githubId,
        githubUsername: u.githubUsername,
        avatarUrl: u.avatarUrl,
        isAdmin: isSysAdmin,
        isBanned: Boolean(u.isBanned),
        banReason: u.banReason,
        isVip: isVipActive,
        vipRaw: Boolean(u.isVip),
        vipExpiresAt: u.vipExpiresAt ? u.vipExpiresAt.toISOString() : null,
        subscriptionCount: u._count.subscriptions,
        templateCount: u._count.templates,
        maxSubscriptions: u.maxSubscriptions ?? null,
        maxCustomTemplates: u.maxCustomTemplates ?? null,
        maxNodesPerSubscription: u.maxNodesPerSubscription ?? null,
        effectiveQuota,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      };
    });

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total,
      page,
      pageSize,
      stats: {
        totalUsers,
        totalVip,
        totalBanned,
        totalActiveToday,
      },
    });
  });
}

export async function POST(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const isSysAdmin = await isSystemAdmin(admin.id);
    if (!isSysAdmin) {
      return apiError("仅系统管理员可创建新用户", "FORBIDDEN", 403);
    }

    const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
    if (!parsedBody.ok) return jsonBodyError(parsedBody);
    const body = parsedBody.value;

    const username = getStringField(body, "username").trim();
    const password = getStringField(body, "password");
    const rawEmail = getStringField(body, "email");
    const email = rawEmail.trim().toLowerCase() || null;
    const isVip = getBooleanField(body, "isVip");
    const vipDays = getNumberField(body, "vipDays");

    if (!username) {
      return apiError("请输入用户名", "BAD_REQUEST", 400);
    }
    if (username.length < 3 || username.length > 32) {
      return apiError("用户名长度需在 3 到 32 个字符之间", "BAD_REQUEST", 400);
    }
    if (!/^[a-zA-Z0-9_\-一-龥]+$/.test(username)) {
      return apiError("用户名仅支持字母、数字、下划线及中文", "BAD_REQUEST", 400);
    }
    if (!password || password.length < USER_PASSWORD_MIN_LENGTH) {
      return apiError(`密码长度至少需要 ${USER_PASSWORD_MIN_LENGTH} 个字符`, "BAD_REQUEST", 400);
    }

    if (email) {
      if (!isValidEmail(email)) {
        return apiError("请输入有效的邮箱地址", "BAD_REQUEST", 400);
      }
      const existingEmail = await prisma.localAdmin.findFirst({
        where: { email },
        select: { id: true },
      });
      if (existingEmail) {
        return apiError("该邮箱已被其他账号使用", "CONFLICT", 409);
      }
    }

    const existingUsername = await prisma.localAdmin.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUsername) {
      return apiError("该用户名已被注册", "CONFLICT", 409);
    }

    let vipExpiresAt: Date | null = null;
    if (isVip && vipDays && vipDays > 0) {
      vipExpiresAt = new Date(Date.now() + vipDays * 86400000);
    }

    let maxSubscriptions: number | null = null;
    let maxCustomTemplates: number | null = null;
    let maxNodesPerSubscription: number | null = null;

    const rawBody = body as Record<string, unknown>;
    if ("maxSubscriptions" in rawBody) {
      const parsed = parseOptionalQuota(rawBody.maxSubscriptions);
      if (!parsed.ok) return apiError("订阅数量必须为大于等于 0 的整数", "BAD_REQUEST", 400);
      maxSubscriptions = parsed.value;
    }
    if ("maxCustomTemplates" in rawBody) {
      const parsed = parseOptionalQuota(rawBody.maxCustomTemplates);
      if (!parsed.ok) return apiError("模板数量必须为大于等于 0 的整数", "BAD_REQUEST", 400);
      maxCustomTemplates = parsed.value;
    }
    if ("maxNodesPerSubscription" in rawBody) {
      const parsed = parseOptionalQuota(rawBody.maxNodesPerSubscription);
      if (!parsed.ok) return apiError("节点数量必须为大于等于 0 的整数", "BAD_REQUEST", 400);
      maxNodesPerSubscription = parsed.value;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.localAdmin.create({
      data: {
        username,
        passwordHash,
        email,
        emailVerifiedAt: email ? new Date() : null,
        isVip,
        vipExpiresAt,
        maxSubscriptions,
        maxCustomTemplates,
        maxNodesPerSubscription,
      },
      select: {
        id: true,
        username: true,
        email: true,
        isVip: true,
        vipExpiresAt: true,
        maxSubscriptions: true,
        maxCustomTemplates: true,
        maxNodesPerSubscription: true,
        createdAt: true,
      },
    });

    const effectiveQuota = resolveUserQuota(newUser, false);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        isVip: newUser.isVip,
        vipExpiresAt: newUser.vipExpiresAt ? newUser.vipExpiresAt.toISOString() : null,
        maxSubscriptions: newUser.maxSubscriptions,
        maxCustomTemplates: newUser.maxCustomTemplates,
        maxNodesPerSubscription: newUser.maxNodesPerSubscription,
        effectiveQuota,
        createdAt: newUser.createdAt.toISOString(),
      },
      message: "用户创建成功",
    });
  });
}
