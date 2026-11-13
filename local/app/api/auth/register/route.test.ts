import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalRateLimitsForTests } from "@local/lib/rate-limit";

const mocks = vi.hoisted(() => ({
  bcryptHash: vi.fn(async () => "hashed-password"),
  getEmailWhitelistSuffixes: vi.fn(async (): Promise<string[]> => []),
  isEmailWhitelisted: vi.fn(async (): Promise<{ allowed: boolean; suffixes: string[] }> => ({ allowed: true, suffixes: [] })),
  verifyVerificationCode: vi.fn(async () => ({ valid: true })),
  prisma: {
    localAdmin: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
  sessionCookieOptions: vi.fn(() => ({ httpOnly: true, path: "/" })),
  signSession: vi.fn(async () => "signed-session-token"),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: mocks.bcryptHash },
}));

vi.mock("@local/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@local/lib/email-service", () => ({
  getEmailWhitelistSuffixes: mocks.getEmailWhitelistSuffixes,
  isEmailWhitelisted: mocks.isEmailWhitelisted,
}));

vi.mock("@local/lib/verification-code", () => ({
  verifyVerificationCode: mocks.verifyVerificationCode,
}));

vi.mock("@local/lib/session", () => ({
  SESSION_COOKIE: "subfuse_local_session",
  sessionCookieOptions: mocks.sessionCookieOptions,
  signSession: mocks.signSession,
}));

async function readJson(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalRateLimitsForTests();
  });

  it("registers a new user successfully and sets the session cookie", async () => {
    const { POST } = await import("./route");
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.localAdmin.create.mockResolvedValueOnce({
      id: "user-123",
      username: "alice",
    });

    const response = await POST(
      new Request("https://local.test/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "alice",
          password: "password123",
          passwordConfirm: "password123",
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 200,
      body: { success: true, user: { id: "user-123", username: "alice" } },
    });
    expect(mocks.bcryptHash).toHaveBeenCalledWith("password123", 12);
    expect(mocks.prisma.localAdmin.create).toHaveBeenCalledWith({
      data: {
        username: "alice",
        passwordHash: "hashed-password",
        email: null,
        emailVerifiedAt: null,
        lastLoginAt: expect.any(Date),
      },
      select: { id: true, username: true },
    });
    expect(mocks.signSession).toHaveBeenCalledWith({ adminId: "user-123", username: "alice" });
    expect(response.headers.get("set-cookie")).toContain("subfuse_local_session=signed-session-token");
  });

  it("rejects when the username already exists", async () => {
    const { POST } = await import("./route");
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({ id: "existing-user" });

    const response = await POST(
      new Request("https://local.test/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "alice",
          password: "password123",
          passwordConfirm: "password123",
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 409,
      body: { error: "该用户名已被注册，请尝试其他用户名", code: "CONFLICT" },
    });
    expect(mocks.prisma.localAdmin.create).not.toHaveBeenCalled();
  });

  it("validates credential constraints", async () => {
    const { POST } = await import("./route");

    // Short password
    let response = await POST(
      new Request("https://local.test/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "alice",
          password: "123",
          passwordConfirm: "123",
        }),
      })
    );
    expect(await readJson(response)).toEqual({
      status: 400,
      body: { error: "密码至少需要 8 个字符", code: "BAD_REQUEST" },
    });

    // Password mismatch
    response = await POST(
      new Request("https://local.test/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "alice",
          password: "password123",
          passwordConfirm: "different123",
        }),
      })
    );
    expect(await readJson(response)).toEqual({
      status: 400,
      body: { error: "两次输入的密码不一致，请重新确认", code: "BAD_REQUEST" },
    });

    // Short username
    response = await POST(
      new Request("https://local.test/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: "al",
          password: "password123",
          passwordConfirm: "password123",
        }),
      })
    );
    expect(await readJson(response)).toEqual({
      status: 400,
      body: { error: "用户名长度需在 3 到 32 个字符之间", code: "BAD_REQUEST" },
    });
  });

  it("rejects invalid JSON body", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://local.test/api/auth/register", {
        method: "POST",
        body: "invalid-json",
      })
    );
    expect(await readJson(response)).toEqual({
      status: 400,
      body: { error: "请求格式有误，请刷新页面后重试", code: "BAD_REQUEST" },
    });
  });

  describe("email whitelist constraints", () => {
    it("rejects registration when whitelist is enabled but no email is provided", async () => {
      const { POST } = await import("./route");
      mocks.getEmailWhitelistSuffixes.mockResolvedValueOnce(["@company.com", "@school.edu"]);

      const response = await POST(
        new Request("https://local.test/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: "bob_dev",
            password: "password123",
            passwordConfirm: "password123",
          }),
        })
      );

      expect(await readJson(response)).toEqual({
        status: 400,
        body: {
          error: "系统已启用邮箱白名单注册限制，请填写符合要求的邮箱完成验证（允许后缀：@company.com、@school.edu）",
          code: "BAD_REQUEST",
        },
      });
      expect(mocks.prisma.localAdmin.create).not.toHaveBeenCalled();
    });

    it("rejects registration when email does not match whitelist", async () => {
      const { POST } = await import("./route");
      mocks.getEmailWhitelistSuffixes.mockResolvedValueOnce(["@company.com"]);
      mocks.isEmailWhitelisted.mockResolvedValueOnce({ allowed: false, suffixes: ["@company.com"] });

      const response = await POST(
        new Request("https://local.test/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: "bob_dev",
            password: "password123",
            passwordConfirm: "password123",
            email: "bob@gmail.com",
            code: "123456",
          }),
        })
      );

      expect(await readJson(response)).toEqual({
        status: 400,
        body: {
          error: "该邮箱后缀不在允许注册的范围内，仅允许以下后缀：@company.com",
          code: "BAD_REQUEST",
        },
      });
      expect(mocks.prisma.localAdmin.create).not.toHaveBeenCalled();
    });

    it("allows registration when email matches whitelist and code is valid", async () => {
      const { POST } = await import("./route");
      mocks.getEmailWhitelistSuffixes.mockResolvedValueOnce(["@company.com"]);
      mocks.isEmailWhitelisted.mockResolvedValueOnce({ allowed: true, suffixes: ["@company.com"] });
      mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });
      mocks.prisma.localAdmin.create.mockResolvedValueOnce({
        id: "user-456",
        username: "bob_dev",
      });

      const response = await POST(
        new Request("https://local.test/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: "bob_dev",
            password: "password123",
            passwordConfirm: "password123",
            email: "bob@company.com",
            code: "123456",
          }),
        })
      );

      expect(await readJson(response)).toEqual({
        status: 200,
        body: { success: true, user: { id: "user-456", username: "bob_dev" } },
      });
      expect(mocks.prisma.localAdmin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: "bob_dev",
            email: "bob@company.com",
          }),
        })
      );
    });
  });
});
