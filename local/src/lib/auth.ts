import { prisma } from "./prisma";
import { readSession } from "./session";

export type CurrentAdmin = {
  id: string;
  username: string;
  email?: string | null;
  emailVerifiedAt?: Date | null;
  githubId?: string | null;
  githubUsername?: string | null;
  avatarUrl?: string | null;
  isBanned?: boolean;
  banReason?: string | null;
  isVip?: boolean;
  vipExpiresAt?: Date | null;
  maxSubscriptions?: number | null;
  maxCustomTemplates?: number | null;
  maxNodesPerSubscription?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await readSession();
  if (!session) return null;
  const admin = await prisma.localAdmin.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      username: true,
      email: true,
      emailVerifiedAt: true,
      githubId: true,
      githubUsername: true,
      avatarUrl: true,
      isBanned: true,
      banReason: true,
      isVip: true,
      vipExpiresAt: true,
      maxSubscriptions: true,
      maxCustomTemplates: true,
      maxNodesPerSubscription: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!admin || admin.isBanned) return null;
  return admin;
}

export async function isSetupRequired(): Promise<boolean> {
  const count = await prisma.localAdmin.count();
  return count === 0;
}

export async function isSystemAdmin(adminId: string): Promise<boolean> {
  try {
    if (typeof prisma?.localAdmin?.findFirst !== "function") return true;
    const firstAdmin = await prisma.localAdmin.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return !firstAdmin || firstAdmin.id === adminId;
  } catch {
    return true;
  }
}

export type UserQuota = {
  maxSubscriptions: number;
  maxNodesPerSubscription: number;
  maxCustomTemplates: number;
  maxImportSourcesPerType: number;
  canUseSubscriptionLink: boolean;
};

export const DEFAULT_USER_QUOTA: UserQuota = {
  maxSubscriptions: 1,
  maxNodesPerSubscription: 200,
  maxCustomTemplates: 0,
  maxImportSourcesPerType: 1,
  canUseSubscriptionLink: true,
};

export const VIP_USER_QUOTA: UserQuota = {
  maxSubscriptions: 50,
  maxNodesPerSubscription: 2000,
  maxCustomTemplates: 50,
  maxImportSourcesPerType: 50,
  canUseSubscriptionLink: true,
};

export const ADMIN_USER_QUOTA: UserQuota = {
  maxSubscriptions: 9999,
  maxNodesPerSubscription: 10000,
  maxCustomTemplates: 9999,
  maxImportSourcesPerType: 9999,
  canUseSubscriptionLink: true,
};

export function resolveUserQuota(
  admin: {
    isVip?: boolean;
    vipExpiresAt?: Date | null;
    maxSubscriptions?: number | null;
    maxCustomTemplates?: number | null;
    maxNodesPerSubscription?: number | null;
  } | null,
  isSysAdmin: boolean
): UserQuota {
  const isVipActive = Boolean(
    admin?.isVip && (!admin.vipExpiresAt || new Date(admin.vipExpiresAt).getTime() > Date.now())
  );
  const baseQuota = isSysAdmin ? ADMIN_USER_QUOTA : isVipActive ? VIP_USER_QUOTA : DEFAULT_USER_QUOTA;

  return {
    ...baseQuota,
    ...(admin?.maxSubscriptions != null && admin.maxSubscriptions >= 0
      ? { maxSubscriptions: admin.maxSubscriptions }
      : {}),
    ...(admin?.maxCustomTemplates != null && admin.maxCustomTemplates >= 0
      ? { maxCustomTemplates: admin.maxCustomTemplates }
      : {}),
    ...(admin?.maxNodesPerSubscription != null && admin.maxNodesPerSubscription >= 0
      ? { maxNodesPerSubscription: admin.maxNodesPerSubscription }
      : {}),
  };
}

export async function getUserQuota(adminId: string): Promise<UserQuota> {
  try {
    if (typeof prisma?.localAdmin?.findUnique !== "function") return DEFAULT_USER_QUOTA;
    const [admin, isSysAdmin] = await Promise.all([
      prisma.localAdmin.findUnique({
        where: { id: adminId },
        select: {
          isVip: true,
          vipExpiresAt: true,
          maxSubscriptions: true,
          maxCustomTemplates: true,
          maxNodesPerSubscription: true,
        },
      }).catch(() => null),
      isSystemAdmin(adminId).catch(() => false),
    ]);
    return resolveUserQuota(admin, isSysAdmin);
  } catch {
    return DEFAULT_USER_QUOTA;
  }
}
