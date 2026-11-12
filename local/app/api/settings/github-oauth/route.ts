import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { isSystemAdmin } from "@local/lib/auth";
import { apiError, getStringField, jsonBodyError, LOCAL_JSON_BODY_LIMITS, readJsonBody } from "@local/lib/http";
import {
  getGitHubOAuthConfig,
  normalizeGitHubCallbackUrl,
  resolveGitHubOAuthUrls,
  saveGitHubOAuthConfig,
  type GitHubOAuthConfig,
} from "@local/lib/github-oauth";

export async function GET(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const isAdmin = await isSystemAdmin(admin.id);
    if (!isAdmin) {
      return apiError("仅系统管理员可查看 GitHub OAuth 配置", "FORBIDDEN", 403);
    }

    const config = await getGitHubOAuthConfig();
    const { redirectUri: defaultCallbackUrl } = resolveGitHubOAuthUrls(request, null);
    const { redirectUri: effectiveCallbackUrl } = resolveGitHubOAuthUrls(request, config);

    return NextResponse.json({
      configured: Boolean(config),
      defaultCallbackUrl,
      effectiveCallbackUrl,
      config: config
        ? {
            clientId: config.clientId,
            hasClientSecret: Boolean(config.clientSecret),
            callbackUrl: config.callbackUrl || "",
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
    const rawCallbackUrl = getStringField(body, "callbackUrl").trim();

    if (!clientId) {
      return apiError("请输入 GitHub Client ID", "BAD_REQUEST", 400);
    }

    let callbackUrl: string | undefined;
    if (rawCallbackUrl) {
      const normalized = normalizeGitHubCallbackUrl(rawCallbackUrl);
      if (!normalized) {
        return apiError("请输入有效的授权回调 URL（需以 http:// 或 https:// 开头）", "BAD_REQUEST", 400);
      }
      callbackUrl = normalized;
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
      ...(callbackUrl ? { callbackUrl } : {}),
    };

    await saveGitHubOAuthConfig(newConfig);
    const { redirectUri: effectiveCallbackUrl } = resolveGitHubOAuthUrls(request, newConfig);

    return NextResponse.json({
      success: true,
      effectiveCallbackUrl,
      callbackUrl: callbackUrl || "",
      message: "GitHub OAuth 配置已保存",
    });
  });
}
