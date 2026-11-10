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
    },
  });
  return admin;
}

export async function isSetupRequired(): Promise<boolean> {
  const count = await prisma.localAdmin.count();
  return count === 0;
}

export async function isSystemAdmin(adminId: string): Promise<boolean> {
  const firstAdmin = await prisma.localAdmin.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return !firstAdmin || firstAdmin.id === adminId;
}
