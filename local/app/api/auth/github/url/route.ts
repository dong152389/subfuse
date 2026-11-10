import { NextResponse } from "next/server";
import { getGitHubOAuthConfig } from "@local/lib/github-oauth";
import { getAppUrl } from "@local/lib/env";
import { randomBytes } from "node:crypto";

export async function GET(request: Request) {
  const config = await getGitHubOAuthConfig();
  if (!config) {
    return NextResponse.json({ enabled: false });
  }

  let baseUrl = "";
  try {
    baseUrl = getAppUrl();
  } catch {
    baseUrl = new URL(request.url).origin;
  }

  const redirectUri = `${baseUrl}/api/auth/github/callback`;
  const state = randomBytes(16).toString("hex");

  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    config.clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email&state=${state}`;

  return NextResponse.json({
    enabled: true,
    url,
  });
}
