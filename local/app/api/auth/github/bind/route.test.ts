import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalRateLimitsForTests } from "@local/lib/rate-limit";

const mocks = vi.hoisted(() => ({
  verifyGitHubBindTicket: vi.fn(),
  verifyVerificationCode: vi.fn(),
  isEmailWhitelisted: vi.fn(async () => ({ allowed: true, suffixes: [] })),
  prisma: {
    localAdmin: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  sessionCookieOptions: vi.fn(() => ({ httpOnly: true, path: "/" })),
  signSession: vi.fn(async () => "signed-session-token"),
}));

vi.mock("@local/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@local/lib/github-oauth", () => ({
  verifyGitHubBindTicket: mocks.verifyGitHubBindTicket,
}));

vi.mock("@local/lib/verification-code", () => ({
  verifyVerificationCode: mocks.verifyVerificationCode,
}));

vi.mock("@local/lib/email-service", () => ({
  isEmailWhitelisted: mocks.isEmailWhitelisted,
}));

vi.mock("@local/lib/session", () => ({
  SESSION_COOKIE: "subfuse_local_session",
  sessionCookieOptions: mocks.sessionCookieOptions,
  signSession: mocks.signSession,
}));

async function readJson(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("POST /api/auth/github/bind", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalRateLimitsForTests();
  });

  const validTicketPayload = {
    githubId: "gh-9999",
    githubUsername: "octocat_github",
    avatarUrl: "https://github.com/octocat.png",
    suggestedEmail: "alice@example.com",
  };

  it("binds GitHub to existing email user, keeping original email user's username even if custom/github username provided", async () => {
    const { POST } = await import("./route");

    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);
    mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });

    // GitHub ID is not yet bound
    mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce(null);

    // Existing user found by email
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({
      id: "existing-user-1",
      username: "original_email_username",
      avatarUrl: "https://example.com/existing-avatar.png",
      isBanned: false,
      banReason: null,
      githubId: null,
      emailVerifiedAt: new Date("2026-01-01"),
    });

    mocks.prisma.localAdmin.update.mockResolvedValueOnce({
      id: "existing-user-1",
      username: "original_email_username",
    });

    const response = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket.token",
          email: "alice@example.com",
          code: "123456",
          username: "custom_input_username", // User typed a custom username in the form
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 200,
      body: {
        success: true,
        user: { id: "existing-user-1", username: "original_email_username" },
      },
    });

    // Verify localAdmin.update was called with GitHub info and kept username untouched
    expect(mocks.prisma.localAdmin.update).toHaveBeenCalledWith({
      where: { id: "existing-user-1" },
      data: {
        githubId: "gh-9999",
        githubUsername: "octocat_github",
        avatarUrl: "https://example.com/existing-avatar.png",
        emailVerifiedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
      },
    });

    // Ensure create was not called
    expect(mocks.prisma.localAdmin.create).not.toHaveBeenCalled();

    // Ensure session is signed with the email user's original username
    expect(mocks.signSession).toHaveBeenCalledWith({
      adminId: "existing-user-1",
      username: "original_email_username",
    });
    expect(response.headers.get("set-cookie")).toContain("subfuse_local_session=signed-session-token");
  });

  it("creates a new user when email does not exist", async () => {
    const { POST } = await import("./route");

    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);
    mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });

    // GitHub ID is not yet bound
    mocks.prisma.localAdmin.findUnique
      .mockResolvedValueOnce(null) // githubTaken
      .mockResolvedValueOnce(null); // username uniqueness check

    // No existing user with this email
    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce(null);

    mocks.prisma.localAdmin.create.mockResolvedValueOnce({
      id: "new-user-2",
      username: "brand_new_user",
      avatarUrl: "https://github.com/octocat.png",
    });

    const response = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket.token",
          email: "bob@example.com",
          code: "654321",
          username: "brand_new_user",
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 200,
      body: {
        success: true,
        user: { id: "new-user-2", username: "brand_new_user" },
      },
    });

    expect(mocks.prisma.localAdmin.create).toHaveBeenCalledWith({
      data: {
        username: "brand_new_user",
        email: "bob@example.com",
        emailVerifiedAt: expect.any(Date),
        githubId: "gh-9999",
        githubUsername: "octocat_github",
        avatarUrl: "https://github.com/octocat.png",
        lastLoginAt: expect.any(Date),
      },
      select: { id: true, username: true },
    });
  });

  it("rejects binding if the existing email user is banned", async () => {
    const { POST } = await import("./route");

    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);
    mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });
    mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce(null);

    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({
      id: "banned-user",
      username: "banned_guy",
      avatarUrl: null,
      isBanned: true,
      banReason: "违规操作",
      githubId: null,
      emailVerifiedAt: new Date(),
    });

    const response = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket.token",
          email: "banned@example.com",
          code: "123456",
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 403,
      body: {
        error: "该账号已被管理员封禁，无法登录。 原因：违规操作",
        code: "FORBIDDEN",
      },
    });
    expect(mocks.prisma.localAdmin.update).not.toHaveBeenCalled();
  });

  it("rejects binding if the existing email user already bound a different GitHub account", async () => {
    const { POST } = await import("./route");

    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);
    mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });
    mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce(null);

    mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({
      id: "bound-user",
      username: "bound_guy",
      avatarUrl: null,
      isBanned: false,
      banReason: null,
      githubId: "gh-other-account",
      emailVerifiedAt: new Date(),
    });

    const response = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket.token",
          email: "bound@example.com",
          code: "123456",
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 409,
      body: {
        error: "该邮箱对应的账号已绑定其他 GitHub 账号，如需更换请先在个人设置中解绑",
        code: "CONFLICT",
      },
    });
    expect(mocks.prisma.localAdmin.update).not.toHaveBeenCalled();
  });

  it("rejects if the GitHub account is already bound to another user", async () => {
    const { POST } = await import("./route");

    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);
    mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });

    // GitHub account already taken
    mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce({ id: "other-user" });

    const response = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket.token",
          email: "alice@example.com",
          code: "123456",
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 409,
      body: {
        error: "该 GitHub 账号已被其他账户绑定",
        code: "CONFLICT",
      },
    });
  });

  it("rejects missing or invalid ticket", async () => {
    const { POST } = await import("./route");

    const noTicketRes = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          email: "alice@example.com",
          code: "123456",
        }),
      })
    );
    expect(await readJson(noTicketRes)).toEqual({
      status: 400,
      body: {
        error: "缺少 GitHub 绑定凭证，请重新授权",
        code: "BAD_REQUEST",
      },
    });

    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(null);
    const badTicketRes = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "expired.ticket",
          email: "alice@example.com",
          code: "123456",
        }),
      })
    );
    expect(await readJson(badTicketRes)).toEqual({
      status: 401,
      body: {
        error: "GitHub 授权凭证已过期或无效，请重新发起 GitHub 登录",
        code: "UNAUTHORIZED",
      },
    });
  });

  it("rejects invalid email or code", async () => {
    const { POST } = await import("./route");
    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);

    const badEmailRes = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket",
          email: "not-an-email",
          code: "123456",
        }),
      })
    );
    expect(badEmailRes.status).toBe(400);

    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);
    const shortCodeRes = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket",
          email: "alice@example.com",
          code: "123",
        }),
      })
    );
    expect(shortCodeRes.status).toBe(400);
  });

  it("rejects invalid verification code", async () => {
    const { POST } = await import("./route");
    mocks.verifyGitHubBindTicket.mockResolvedValueOnce(validTicketPayload);
    mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: false, error: "验证码错误或已过期" });

    const response = await POST(
      new Request("https://local.test/api/auth/github/bind", {
        method: "POST",
        body: JSON.stringify({
          ticket: "valid.ticket",
          email: "alice@example.com",
          code: "999999",
        }),
      })
    );

    expect(await readJson(response)).toEqual({
      status: 401,
      body: {
        error: "验证码错误或已过期",
        code: "UNAUTHORIZED",
      },
    });
  });
});
