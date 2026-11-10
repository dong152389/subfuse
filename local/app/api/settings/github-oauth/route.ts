import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { isSystemAdmin } from "@local/lib/auth";
import { apiError, getStringField, jsonBodyError, LOCAL_JSON_BODY_LIMITS, readJsonBody } from "@local/lib/http";
import { getGitHubOAuthConfig, saveGitHubOAuthConfig, type GitHubOAuthConfig } from "@local/lib/github-oauth";

export async function GET() {
  return withCurrentAdmin(async (admin) => {
    const isAdmin = await isSystemAdmin(admin.id);
    if (!isAdmin) {
      return apiError("仅系统管理员可查看 GitHub OAuth 配置", "FORBIDDEN", 403);
    }

    const config = await getGitHubOAuthConfig();
    return NextResponse.json({
      configured: Boolean(config),
      config: config
        ? {
            clientId: config.clientId,
            hasClientSecret: Boolean(config.clientSecret),
          }
        : null,
    });
  });
}

export async function PATCH(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const isAdmin = await isSystemAdmin(admin.id);
    if (!isAdmin) {
      return apiError("仅系统管理员可修改 GitHub OAuth 配置", "FORBIDDEN", 403);
    }

    const parsedBody = await readJsonBody(request, LOCAL_JSON_BODY_LIMITS.small);
    if (!parsedBody.ok) return jsonBodyError(parsedBody);
    const body = parsedBody.value;

    const clientId = getStringField(body, "clientId").trim();
    const inputClientSecret = getStringField(body, "clientSecret").trim();

    if (!clientId) {
      return apiError("请输入 GitHub Client ID", "BAD_REQUEST", 400);
    }

    const currentConfig = await getGitHubOAuthConfig();
    const clientSecret =
      inputClientSecret && inputClientSecret !== "••••••••"
        ? inputClientSecret
        : currentConfig?.clientSecret || "";

    if (!clientSecret) {
      return apiError("请输入 GitHub Client Secret", "BAD_REQUEST", 400);
    }

    const newConfig: GitHubOAuthConfig = {
      clientId,
      clientSecret,
    };

    await saveGitHubOAuthConfig(newConfig);

    return NextResponse.json({
      success: true,
      message: "GitHub OAuth 配置已保存",
    });
  });
}
