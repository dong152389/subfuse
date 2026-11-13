import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { apiError } from "@local/lib/http";
import { prisma } from "@local/lib/prisma";

export async function POST() {
  return withCurrentAdmin(async (admin) => {
    const fullAdmin = await prisma.localAdmin.findUnique({
      where: { id: admin.id },
      select: {
        id: true,
        githubId: true,
        passwordHash: true,
        email: true,
      },
    });

    if (!fullAdmin?.githubId) {
      return apiError("当前账户未绑定 GitHub 账号", "BAD_REQUEST", 400);
    }

    if (!fullAdmin.passwordHash && !fullAdmin.email) {
      return apiError("请先设置密码或绑定邮箱，以防解绑后无法登录账户", "BAD_REQUEST", 400);
    }

    await prisma.localAdmin.update({
      where: { id: admin.id },
      data: {
        githubId: null,
        githubUsername: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "GitHub 账号已解除绑定",
    });
  });
}
