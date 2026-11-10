import { NextResponse } from "next/server";
import { isSmtpConfigured } from "@local/lib/email-service";
import { isGitHubOAuthEnabled } from "@local/lib/github-oauth";

export async function GET() {
  const [emailEnabled, githubEnabled] = await Promise.all([
    isSmtpConfigured(),
    isGitHubOAuthEnabled(),
  ]);

  return NextResponse.json({
    emailEnabled,
    githubEnabled,
  });
}
