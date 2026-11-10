import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalRateLimitsForTests } from "@local/lib/rate-limit";

const mocks = vi.hoisted(() => ({
  canSendVerificationCode: vi.fn(),
  createVerificationCode: vi.fn(),
  sendVerificationCodeEmail: vi.fn(),
  isSmtpConfigured: vi.fn(),
  prisma: {
    localAdmin: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  verifyVerificationCode: vi.fn(),
  sessionCookieOptions: vi.fn(() => ({ httpOnly: true, path: "/" })),
  signSession: vi.fn(async () => "test-session-token"),
}));

vi.mock("@local/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@local/lib/email-service", () => ({
  isSmtpConfigured: mocks.isSmtpConfigured,
  sendVerificationCodeEmail: mocks.sendVerificationCodeEmail,
}));

vi.mock("@local/lib/verification-code", () => ({
  canSendVerificationCode: mocks.canSendVerificationCode,
  createVerificationCode: mocks.createVerificationCode,
  verifyVerificationCode: mocks.verifyVerificationCode,
}));

vi.mock("@local/lib/session", () => ({
  SESSION_COOKIE: "subboost_local_session",
  sessionCookieOptions: mocks.sessionCookieOptions,
  signSession: mocks.signSession,
}));

async function readJson(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("Email Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalRateLimitsForTests();
  });

  describe("POST /api/auth/email/send-code", () => {
    it("returns 503 if SMTP is not configured", async () => {
      const { POST } = await import("./send-code/route");
      mocks.isSmtpConfigured.mockResolvedValueOnce(false);

      const res = await POST(
        new Request("https://test.local/api/auth/email/send-code", {
          method: "POST",
          body: JSON.stringify({ email: "user@example.com", purpose: "login" }),
        })
      );

      expect(await readJson(res)).toEqual({
        status: 503,
        body: { error: "系统未配置 SMTP 邮件服务，无法发送验证码", code: "CONFIGURATION_ERROR" },
      });
    });

    it("sends verification code successfully", async () => {
      const { POST } = await import("./send-code/route");
      mocks.isSmtpConfigured.mockResolvedValueOnce(true);
      mocks.canSendVerificationCode.mockResolvedValueOnce({ allowed: true });
      mocks.createVerificationCode.mockResolvedValueOnce("123456");
      mocks.sendVerificationCodeEmail.mockResolvedValueOnce({ success: true });

      const res = await POST(
        new Request("https://test.local/api/auth/email/send-code", {
          method: "POST",
          body: JSON.stringify({ email: "user@example.com", purpose: "login" }),
        })
      );

      expect(await readJson(res)).toEqual({
        status: 200,
        body: { success: true, message: "验证码已发送至您的邮箱，请查收" },
      });
      expect(mocks.createVerificationCode).toHaveBeenCalledWith("user@example.com", "login");
      expect(mocks.sendVerificationCodeEmail).toHaveBeenCalledWith("user@example.com", "123456", "login");
    });
  });

  describe("POST /api/auth/email/login", () => {
    it("logs in existing user with valid code", async () => {
      const { POST } = await import("./login/route");
      mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });
      mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce({
        id: "user-1",
        username: "testuser",
        email: "user@example.com",
      });
      mocks.prisma.localAdmin.update.mockResolvedValueOnce({});

      const res = await POST(
        new Request("https://test.local/api/auth/email/login", {
          method: "POST",
          body: JSON.stringify({ email: "user@example.com", code: "123456" }),
        })
      );

      expect(await readJson(res)).toEqual({
        status: 200,
        body: { success: true, user: { id: "user-1", username: "testuser" } },
      });
      expect(mocks.signSession).toHaveBeenCalledWith({ adminId: "user-1", username: "testuser" });
      expect(res.headers.get("set-cookie")).toContain("subboost_local_session=test-session-token");
    });

    it("auto-registers new user on first email code login", async () => {
      const { POST } = await import("./login/route");
      mocks.verifyVerificationCode.mockResolvedValueOnce({ valid: true });
      mocks.prisma.localAdmin.findFirst.mockResolvedValueOnce(null);
      mocks.prisma.localAdmin.findUnique.mockResolvedValueOnce(null);
      mocks.prisma.localAdmin.create.mockResolvedValueOnce({
        id: "new-user-1",
        username: "user_1234",
        email: "user@example.com",
      });

      const res = await POST(
        new Request("https://test.local/api/auth/email/login", {
          method: "POST",
          body: JSON.stringify({ email: "user@example.com", code: "123456" }),
        })
      );

      expect(await readJson(res)).toEqual({
        status: 200,
        body: { success: true, user: { id: "new-user-1", username: "user_1234" } },
      });
      expect(mocks.prisma.localAdmin.create).toHaveBeenCalled();
    });
  });
});
