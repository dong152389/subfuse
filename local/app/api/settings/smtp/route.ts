import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { isSystemAdmin } from "@local/lib/auth";
import { apiError, getBooleanField, getNumberField, getStringArrayField, getStringField, jsonBodyError, LOCAL_JSON_BODY_LIMITS, readJsonBody } from "@local/lib/http";
import { getSmtpConfig, normalizeWhitelistSuffixes, saveSmtpConfig, testSmtpConnection, type SmtpConfig } from "@local/lib/email-service";
import { isValidEmail } from "@local/lib/admin-credentials";

export async function GET() {
  return withCurrentAdmin(async (admin) => {
    const isAdmin = await isSystemAdmin(admin.id);
    if (!isAdmin) {
      return apiError("仅系统管理员可查看邮件配置", "FORBIDDEN", 403);
    }

    const config = await getSmtpConfig();
    return NextResponse.json({
      configured: Boolean(config),
      config: config
        ? {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            pass: config.pass ? "••••••••" : "",
            from: config.from,
            emailWhitelistSuffixes: config.emailWhitelistSuffixes || [],
          }
        : null,
    });
  });
}

export async function PATCH(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const isAdmin = await isSystemAdmin(admin.id);
    if (!isAdmin) {
      return apiError("仅系统管理员可修改邮件配置", "FORBIDDEN", 403);
    }

    const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
    if (!parsedBody.ok) return jsonBodyError(parsedBody);
    const body = parsedBody.value;

    const host = getStringField(body, "host").trim();
    const port = getNumberField(body, "port") || 465;
    const secure = getBooleanField(body, "secure");
    const user = getStringField(body, "user").trim();
    const inputPass = getStringField(body, "pass").trim();
    const from = getStringField(body, "from").trim() || user;
    const rawWhitelist = getStringArrayField(body, "emailWhitelistSuffixes");
    const emailWhitelistSuffixes = normalizeWhitelistSuffixes(rawWhitelist);

    if (!host || !user) {
      return apiError("请填写完整的 SMTP 服务器地址和账号", "BAD_REQUEST", 400);
    }

    const currentConfig = await getSmtpConfig();
    const pass = inputPass && inputPass !== "••••••••" ? inputPass : currentConfig?.pass || "";

    if (!pass) {
      return apiError("请输入 SMTP 密码/授权码", "BAD_REQUEST", 400);
    }

    const newConfig: SmtpConfig = {
      host,
      port,
      secure,
      user,
      pass,
      from,
      emailWhitelistSuffixes,
    };

    await saveSmtpConfig(newConfig);

    return NextResponse.json({
      success: true,
      message: "SMTP 配置已成功保存",
    });
  });
}

export async function POST(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const isAdmin = await isSystemAdmin(admin.id);
    if (!isAdmin) {
      return apiError("仅系统管理员可执行测试", "FORBIDDEN", 403);
    }

    const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
    const body = parsedBody.ok ? parsedBody.value : {};

    const testRecipient = getStringField(body, "testRecipient").trim();
    if (testRecipient && !isValidEmail(testRecipient)) {
      return apiError("测试收件邮箱地址格式不正确", "BAD_REQUEST", 400);
    }

    // Use passed config if available, otherwise saved config
    const host = getStringField(body, "host").trim();
    const port = getNumberField(body, "port");
    const secure = getBooleanField(body, "secure");
    const user = getStringField(body, "user").trim();
    const inputPass = getStringField(body, "pass").trim();
    const from = getStringField(body, "from").trim();

    let targetConfig: SmtpConfig | null = null;
    if (host && user) {
      const currentConfig = await getSmtpConfig();
      const pass = inputPass && inputPass !== "••••••••" ? inputPass : currentConfig?.pass || "";
      targetConfig = {
        host,
        port: port || 465,
        secure,
        user,
        pass,
        from: from || user,
      };
    } else {
      targetConfig = await getSmtpConfig();
    }

    if (!targetConfig || !targetConfig.pass) {
      return apiError("请先配置并保存 SMTP 信息或在测试表单中填写", "BAD_REQUEST", 400);
    }

    const result = await testSmtpConnection(targetConfig, testRecipient || undefined);
    if (!result.success) {
      return apiError(result.error || "SMTP 连接测试失败", "INTERNAL_ERROR", 502);
    }

    return NextResponse.json({
      success: true,
      message: testRecipient ? `测试邮件已发送至 ${testRecipient}` : "SMTP 服务器连接验证成功",
    });
  });
}
