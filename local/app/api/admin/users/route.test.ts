import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bcryptHash: vi.fn(async () => "hashed-password"),
  getCurrentAdmin: vi.fn(),
  isSystemAdmin: vi.fn(),
  prisma: {
    localAdmin: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: mocks.bcryptHash,
  },
}));

vi.mock("@local/lib/auth", () => ({
  getCurrentAdmin: mocks.getCurrentAdmin,
  isSystemAdmin: mocks.isSystemAdmin,
}));

vi.mock("@local/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET as listUsers, POST as createUser } from "./route";
import { PATCH as updateUser, DELETE as deleteUser } from "./[id]/route";

async function readJson(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("admin user management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", username: "admin" });
    mocks.isSystemAdmin.mockResolvedValue(true);
  });

  it("rejects unauthorized access when not logged in", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);

    const res = await listUsers(new Request("https://local.test/api/admin/users"));
    expect(await readJson(res)).toEqual({
      status: 401,
      body: { error: "Authentication required.", code: "UNAUTHORIZED" },
    });
  });

  it("rejects non-system admins from viewing user list", async () => {
    mocks.isSystemAdmin.mockResolvedValue(false);

    const res = await listUsers(new Request("https://local.test/api/admin/users"));
    expect(await readJson(res)).toEqual({
      status: 403,
      body: { error: "仅系统管理员可查看用户列表", code: "FORBIDDEN" },
    });
  });

  it("lists users with pagination, filters and stats", async () => {
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({ id: "admin-1" });
    mocks.prisma.localAdmin.count
      .mockResolvedValueOnce(2) // total matching
      .mockResolvedValueOnce(10) // totalUsers
      .mockResolvedValueOnce(3) // totalVip
      .mockResolvedValueOnce(1) // totalBanned
      .mockResolvedValueOnce(4); // totalActiveToday

    const mockDate = new Date("2026-11-10T12:00:00Z");
    const futureDate = new Date(Date.now() + 10 * 86400000);
    mocks.prisma.localAdmin.findMany.mockResolvedValueOnce([
      {
        id: "admin-1",
        username: "admin",
        email: "admin@example.com",
        emailVerifiedAt: mockDate,
        githubId: null,
        githubUsername: null,
        avatarUrl: null,
        createdAt: mockDate,
        updatedAt: mockDate,
        lastLoginAt: mockDate,
        isBanned: false,
        banReason: null,
        isVip: false,
        vipExpiresAt: null,
        _count: { subscriptions: 2, templates: 1 },
      },
      {
        id: "user-2",
        username: "vip_user",
        email: "vip@example.com",
        emailVerifiedAt: null,
        githubId: "gh-1",
        githubUsername: "vipgh",
        avatarUrl: "https://avatar.test/1",
        createdAt: mockDate,
        updatedAt: mockDate,
        lastLoginAt: null,
        isBanned: false,
        banReason: null,
        isVip: true,
        vipExpiresAt: futureDate,
        _count: { subscriptions: 5, templates: 2 },
      },
    ]);

    const res = await listUsers(
      new Request("https://local.test/api/admin/users?search=vip&role=vip&page=1&pageSize=10")
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toMatchObject({
      id: "admin-1",
      isAdmin: true,
      isVip: false,
      subscriptionCount: 2,
      templateCount: 1,
    });
    expect(body.users[1]).toMatchObject({
      id: "user-2",
      isAdmin: false,
      isVip: true,
      subscriptionCount: 5,
      templateCount: 2,
    });
    expect(body.stats).toEqual({
      totalUsers: 10,
      totalVip: 3,
      totalBanned: 1,
      totalActiveToday: 4,
    });
  });

  it("creates a new user with VIP settings", async () => {
    mocks.prisma.localAdmin.findFirst
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce(null); // username check

    const createdDate = new Date("2026-11-13T00:00:00Z");
    mocks.prisma.localAdmin.create.mockResolvedValueOnce({
      id: "new-user-1",
      username: "bob",
      email: "bob@example.com",
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 30 * 86400000),
      createdAt: createdDate,
    });

    const res = await createUser(
      new Request("https://local.test/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "bob",
          password: "password123",
          email: "bob@example.com",
          isVip: true,
          vipDays: 30,
        }),
      })
    );

    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.username).toBe("bob");
    expect(body.user.isVip).toBe(true);
    expect(mocks.bcryptHash).toHaveBeenCalledWith("password123", 12);
    expect(mocks.prisma.localAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "bob",
          email: "bob@example.com",
          isVip: true,
          vipExpiresAt: expect.any(Date),
        }),
      })
    );
  });

  it("rejects creating user with invalid credentials or duplicate username", async () => {
    // Short password
    let res = await createUser(
      new Request("https://local.test/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ username: "bob", password: "123" }),
      })
    );
    expect(res.status).toBe(400);

    // Duplicate username
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({ id: "existing-1" });
    res = await createUser(
      new Request("https://local.test/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ username: "existing", password: "password123" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("updates user password, VIP status and ban state", async () => {
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({ id: "admin-1" }); // firstAdmin
    mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce({
      id: "user-2",
      username: "charlie",
    });
    mocks.prisma.localAdmin.update.mockResolvedValueOnce({
      id: "user-2",
      username: "charlie",
      email: "charlie@example.com",
      isBanned: true,
      banReason: "违规行为",
      isVip: true,
      vipExpiresAt: null,
      updatedAt: new Date(),
    });

    const res = await updateUser(
      new Request("https://local.test/api/admin/users/user-2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: "new-password123",
          isBanned: true,
          banReason: "违规行为",
          isVip: true,
          vipDays: 0, // lifetime
        }),
      }),
      { params: Promise.resolve({ id: "user-2" }) }
    );

    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user).toMatchObject({
      id: "user-2",
      isBanned: true,
      banReason: "违规行为",
      isVip: true,
      vipExpiresAt: null,
    });
    expect(mocks.prisma.localAdmin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-2" },
        data: expect.objectContaining({
          passwordHash: "hashed-password",
          isBanned: true,
          banReason: "违规行为",
          isVip: true,
          vipExpiresAt: null,
        }),
      })
    );
  });

  it("prevents banning system admin or self", async () => {
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({ id: "admin-1" });
    mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce({ id: "admin-1" });

    // Attempting to ban firstAdmin
    const res = await updateUser(
      new Request("https://local.test/api/admin/users/admin-1", {
        method: "PATCH",
        body: JSON.stringify({ isBanned: true }),
      }),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    expect(res.status).toBe(400);
    expect((await readJson(res)).body.error).toContain("无法封禁");
  });

  it("deletes user and prevents deleting system admin or self", async () => {
    mocks.prisma.localAdmin.findFirst.mockResolvedValue({ id: "admin-1" });

    // Cannot delete firstAdmin
    let res = await deleteUser(
      new Request("https://local.test/api/admin/users/admin-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    expect(res.status).toBe(400);

    // Successfully delete another user
    mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce({ id: "user-3", username: "dave" });
    mocks.prisma.localAdmin.delete.mockResolvedValueOnce({ id: "user-3" });

    res = await deleteUser(
      new Request("https://local.test/api/admin/users/user-3", { method: "DELETE" }),
      { params: Promise.resolve({ id: "user-3" }) }
    );
    expect(res.status).toBe(200);
    expect(mocks.prisma.localAdmin.delete).toHaveBeenCalledWith({ where: { id: "user-3" } });
  });
});
