import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@local/lib/auth";
import {
  fetchGitHubUser,
  getGitHubOAuthConfig,
  resolveGitHubOAuthUrls,
  signGitHubBindTicket,
  verifyGitHubOAuthState,
} from "@local/lib/github-oauth";
import { prisma } from "@local/lib/prisma";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@local/lib/session";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const errorParam = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  const stateParam = requestUrl.searchParams.get("state");
  const config = await getGitHubOAuthConfig();
  const { baseUrl, redirectUri } = resolveGitHubOAuthUrls(request, config);

  const statePayload = await verifyGitHubOAuthState(stateParam);
  const isBindAction = statePayload?.action === "bind";

  if (errorParam || !code) {
    const errorMsg = errorParam || "GitHub 授权已取消或失败";
    const targetUrl = isBindAction
      ? `${baseUrl}/dashboard/settings?error=${encodeURIComponent(errorMsg)}`
      : `${baseUrl}/login?error=${encodeURIComponent(errorMsg)}`;
    return NextResponse.redirect(targetUrl);
  }

  try {
    const ghUser = await fetchGitHubUser(code, redirectUri);

    // If initiated from account settings to bind GitHub
    if (isBindAction) {
      const currentAdmin = await getCurrentAdmin();
      if (!currentAdmin || (statePayload.adminId && currentAdmin.id !== statePayload.adminId)) {
        return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent("登录状态已失效，请重新登录后绑定")}`);
      }

      const existingUser = await prisma.localAdmin.findUnique({
        where: { githubId: ghUser.id },
        select: { id: true, username: true },
      });

      if (existingUser && existingUser.id !== currentAdmin.id) {
        return NextResponse.redirect(
          `${baseUrl}/dashboard/settings?error=${encodeURIComponent(`该 GitHub 账号已被用户「${existingUser.username}」绑定`)}`
        );
      }

      if (existingUser && existingUser.id === currentAdmin.id) {
        return NextResponse.redirect(
          `${baseUrl}/dashboard/settings?notice=${encodeURIComponent("当前账户已绑定此 GitHub 账号")}`
        );
      }

      await prisma.localAdmin.update({
        where: { id: currentAdmin.id },
        data: {
          githubId: ghUser.id,
          githubUsername: ghUser.login,
          avatarUrl: currentAdmin.avatarUrl || ghUser.avatar_url,
          updatedAt: new Date(),
        },
      });

      return NextResponse.redirect(
        `${baseUrl}/dashboard/settings?success=${encodeURIComponent(`已成功绑定 GitHub 账号：@${ghUser.login}`)}`
      );
    }

    // Normal login flow
    // Check if a user with this githubId already exists
    const existingUser = await prisma.localAdmin.findUnique({
      where: { githubId: ghUser.id },
      select: { id: true, username: true, isBanned: true, banReason: true },
    });

    if (existingUser) {
      if (existingUser.isBanned) {
        const reasonMsg = existingUser.banReason ? ` 原因：${existingUser.banReason}` : "";
        return NextResponse.redirect(
          `${baseUrl}/login?error=${encodeURIComponent(`该账号已被管理员封禁，无法登录。${reasonMsg}`)}`
        );
      }

      // User already bound! Sign in directly
      await prisma.localAdmin.update({
        where: { id: existingUser.id },
        data: {
          lastLoginAt: new Date(),
          avatarUrl: ghUser.avatar_url,
          githubUsername: ghUser.login,
        },
      });

      const response = NextResponse.redirect(`${baseUrl}/dashboard`);
      response.cookies.set(
        SESSION_COOKIE,
        await signSession({ adminId: existingUser.id, username: existingUser.username }),
        sessionCookieOptions()
      );
      return response;
    }

    // First time login: "首次授权后跳转回来绑定邮箱"
    const ticket = await signGitHubBindTicket({
      githubId: ghUser.id,
      githubUsername: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      suggestedEmail: ghUser.email,
    });

    return NextResponse.redirect(`${baseUrl}/login#github-bind=${encodeURIComponent(ticket)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub 登录处理异常";
    const targetUrl = isBindAction
      ? `${baseUrl}/dashboard/settings?error=${encodeURIComponent(message)}`
      : `${baseUrl}/login?error=${encodeURIComponent(message)}`;
    return NextResponse.redirect(targetUrl);
  }
}
