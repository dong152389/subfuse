import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@local/lib/auth";
import { getGitHubOAuthConfig, resolveGitHubOAuthUrls, signGitHubOAuthState } from "@local/lib/github-oauth";

export async function GET(request: Request) {
  const config = await getGitHubOAuthConfig();
  if (!config) {
    return NextResponse.json({
      enabled: false,
      error: "GitHub OAuth 尚未配置，请管理员登录后前往「管理员配置」完成设置",
    });
  }

  const requestUrl = new URL(request.url);
  const actionParam = requestUrl.searchParams.get("action");
  const action = actionParam === "bind" ? "bind" : "login";

  let adminId: string | undefined;
  if (action === "bind") {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        {
          enabled: true,
          error: "请先登录账户后再进行 GitHub 绑定",
        },
        { status: 401 }
      );
    }
    adminId = admin.id;
  }

  const { redirectUri } = resolveGitHubOAuthUrls(request, config);
  const state = await signGitHubOAuthState({ action, adminId });

  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    config.clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email&state=${encodeURIComponent(state)}`;

  return NextResponse.json({
    enabled: true,
    url,
  });
}
