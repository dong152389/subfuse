import { NextResponse } from "next/server";
import { getGitHubOAuthConfig, resolveGitHubOAuthUrls } from "@local/lib/github-oauth";
import { randomBytes } from "node:crypto";

export async function GET(request: Request) {
  const config = await getGitHubOAuthConfig();
  if (!config) {
    return NextResponse.json({
      enabled: false,
      error: "GitHub OAuth 尚未配置，请管理员登录后前往「管理员配置」完成设置",
    });
  }

  const { redirectUri } = resolveGitHubOAuthUrls(request, config);
  const state = randomBytes(16).toString("hex");

  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    config.clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email&state=${state}`;

  return NextResponse.json({
    enabled: true,
    url,
  });
}
