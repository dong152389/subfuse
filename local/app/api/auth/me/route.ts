import { getCurrentAdmin, isSetupRequired } from "@local/lib/auth";
import { json } from "@local/lib/http";
import { prisma } from "@local/lib/prisma";

export async function GET() {
  const [setupRequired, admin] = await Promise.all([isSetupRequired(), getCurrentAdmin()]);
  const firstAdminPromise =
    admin && typeof prisma.localAdmin.findFirst === "function"
      ? prisma.localAdmin.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }).catch(() => null)
      : Promise.resolve(null);
  const [subscriptionCount, templateCount, firstAdmin] = admin
    ? await Promise.all([
        prisma.subscription.count({ where: { ownerId: admin.id } }),
        prisma.localTemplate.count({ where: { ownerId: admin.id } }),
        firstAdminPromise,
      ])
    : [0, 0, null];
  const isAdmin = Boolean(admin && (!firstAdmin || admin.id === firstAdmin.id));
  const now = new Date().toISOString();
  return json({
    setupRequired,
    authenticated: Boolean(admin),
    user: admin
      ? {
          id: admin.id,
          username: admin.username,
          name: admin.username,
          email: admin.email || null,
          avatarUrl: admin.avatarUrl || null,
          trustLevel: 4,
          aiAssistantEnabled: false,
          isAdmin,
          isBanned: false,
          active: true,
          silenced: false,
          saveRequirementSatisfied: true,
          saveRequirementSatisfiedAt: now,
          createdAt: now,
          updatedAt: now,
          accounts: admin.githubId
            ? [{ provider: "github", providerAccountId: admin.githubId }]
            : [],
          quota: {
            maxSubscriptions: 9999,
            maxNodesPerSubscription: 10000,
            maxCustomTemplates: 9999,
            maxImportSourcesPerType: 9999,
            canUseSubscriptionLink: true,
          },
          subscriptionCount,
          templateCount,
        }
      : null,
  });
}
