import { getCurrentAdmin, isSetupRequired, resolveUserQuota } from "@local/lib/auth";
import { json } from "@local/lib/http";
import { prisma } from "@local/lib/prisma";

export async function GET() {
  const [setupRequired, admin] = await Promise.all([isSetupRequired(), getCurrentAdmin()]);
  const firstAdminPromise =
    admin && typeof prisma.localAdmin.findFirst === "function"
      ? Promise.resolve(prisma.localAdmin.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } })).catch(() => null)
      : Promise.resolve(null);
  const [subscriptionCount, templateCount, firstAdmin] = admin
    ? await Promise.all([
        prisma.subscription.count({ where: { ownerId: admin.id } }),
        prisma.localTemplate.count({ where: { ownerId: admin.id } }),
        firstAdminPromise,
      ])
    : [0, 0, null];
  const isAdmin = Boolean(admin && (!firstAdmin || admin.id === firstAdmin.id));
  const isVipActive = Boolean(
    admin?.isVip && (!admin.vipExpiresAt || new Date(admin.vipExpiresAt).getTime() > Date.now())
  );
  const now = new Date().toISOString();
  const quota = resolveUserQuota(admin, isAdmin);

  return json({
    setupRequired,
    authenticated: Boolean(admin),
    user: admin
      ? {
          id: admin.id,
          username: admin.username,
          name: admin.username,
          email: admin.email || null,
          githubId: admin.githubId || null,
          githubUsername: admin.githubUsername || null,
          avatarUrl: admin.avatarUrl || null,
          trustLevel: isAdmin ? 4 : isVipActive ? 3 : 1,
          aiAssistantEnabled: false,
          isAdmin,
          isBanned: Boolean(admin.isBanned),
          banReason: admin.banReason || null,
          isVip: isVipActive,
          vipExpiresAt: admin.vipExpiresAt ? admin.vipExpiresAt.toISOString() : null,
          active: !admin.isBanned,
          silenced: false,
          saveRequirementSatisfied: true,
          saveRequirementSatisfiedAt: now,
          createdAt: admin.createdAt ? admin.createdAt.toISOString() : now,
          updatedAt: admin.updatedAt ? admin.updatedAt.toISOString() : now,
          accounts: admin.githubId
            ? [{ provider: "github", providerAccountId: admin.githubId }]
            : [],
          quota,
          subscriptionCount,
          templateCount,
        }
      : null,
  });
}
