import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  isSystemAdmin: vi.fn(),
  getSmtpConfig: vi.fn(),
  saveSmtpConfig: vi.fn(),
  testSmtpConnection: vi.fn(),
}));

vi.mock("@local/lib/auth", () => ({
  getCurrentAdmin: mocks.getCurrentAdmin,
  isSystemAdmin: mocks.isSystemAdmin,
}));

vi.mock("@local/lib/email-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@local/lib/email-service")>();
  return {
    ...actual,
    getSmtpConfig: mocks.getSmtpConfig,
    saveSmtpConfig: mocks.saveSmtpConfig,
    testSmtpConnection: mocks.testSmtpConnection,
  };
});

import { GET, PATCH, POST } from "./route";

async function readJson(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("SMTP settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", username: "admin" });
    mocks.isSystemAdmin.mockResolvedValue(true);
  });

  describe("GET /api/settings/smtp", () => {
    it("returns 403 if user is not system admin", async () => {
      mocks.isSystemAdmin.mockResolvedValueOnce(false);

      const response = await GET();
      expect(await readJson(response)).toEqual({
        status: 403,
        body: { error: "仅系统管理员可查看邮件配置", code: "FORBIDDEN" },
      });
    });

    it("returns null config when unconfigured", async () => {
      mocks.getSmtpConfig.mockResolvedValueOnce(null);

      const response = await GET();
      expect(await readJson(response)).toEqual({
        status: 200,
        body: { configured: false, config: null },
      });
    });

    it("returns masked config with emailWhitelistSuffixes", async () => {
      mocks.getSmtpConfig.mockResolvedValueOnce({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "admin@example.com",
        pass: "supersecret",
        from: "SubFuse <admin@example.com>",
        emailWhitelistSuffixes: ["@example.com", "@company.org"],
      });

      const response = await GET();
      expect(await readJson(response)).toEqual({
        status: 200,
        body: {
          configured: true,
          config: {
            host: "smtp.example.com",
            port: 465,
            secure: true,
            user: "admin@example.com",
            pass: "••••••••",
            from: "SubFuse <admin@example.com>",
            emailWhitelistSuffixes: ["@example.com", "@company.org"],
          },
        },
      });
    });
  });

  describe("PATCH /api/settings/smtp", () => {
    it("saves smtp config including normalized emailWhitelistSuffixes", async () => {
      mocks.getSmtpConfig.mockResolvedValueOnce(null);

      const response = await PATCH(
        new Request("https://local.test/api/settings/smtp", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host: "smtp.example.com",
            port: 465,
            secure: true,
            user: "admin@example.com",
            pass: "newsecret",
            from: "SubFuse <admin@example.com>",
            emailWhitelistSuffixes: ["company.com", "@school.edu", "  @company.com  "],
          }),
        })
      );

      expect(await readJson(response)).toEqual({
        status: 200,
        body: { success: true, message: "SMTP 配置已成功保存" },
      });

      expect(mocks.saveSmtpConfig).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "admin@example.com",
        pass: "newsecret",
        from: "SubFuse <admin@example.com>",
        emailWhitelistSuffixes: ["@company.com", "@school.edu"],
      });
    });

    it("preserves existing password if placeholder is sent", async () => {
      mocks.getSmtpConfig.mockResolvedValueOnce({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "admin@example.com",
        pass: "existing-secret",
        from: "SubFuse <admin@example.com>",
      });

      const response = await PATCH(
        new Request("https://local.test/api/settings/smtp", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host: "smtp.example.com",
            port: 465,
            secure: true,
            user: "admin@example.com",
            pass: "••••••••",
            from: "SubFuse <admin@example.com>",
            emailWhitelistSuffixes: [],
          }),
        })
      );

      expect(await readJson(response)).toEqual({
        status: 200,
        body: { success: true, message: "SMTP 配置已成功保存" },
      });

      expect(mocks.saveSmtpConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          pass: "existing-secret",
          emailWhitelistSuffixes: [],
        })
      );
    });
  });

  describe("POST /api/settings/smtp", () => {
    it("tests SMTP connection successfully", async () => {
      mocks.getSmtpConfig.mockResolvedValueOnce({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "admin@example.com",
        pass: "secret",
        from: "SubFuse <admin@example.com>",
      });
      mocks.testSmtpConnection.mockResolvedValueOnce({ success: true });

      const response = await POST(
        new Request("https://local.test/api/settings/smtp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testRecipient: "test@example.com",
          }),
        })
      );

      expect(await readJson(response)).toEqual({
        status: 200,
        body: { success: true, message: "测试邮件已发送至 test@example.com" },
      });
      expect(mocks.testSmtpConnection).toHaveBeenCalledWith(
        expect.objectContaining({ host: "smtp.example.com" }),
        "test@example.com"
      );
    });
  });
});
