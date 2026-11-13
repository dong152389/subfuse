import { NextResponse } from "next/server";
import { getEmailWhitelistSuffixes, isSmtpConfigured } from "@local/lib/email-service";
import { isGitHubOAuthEnabled } from "@local/lib/github-oauth";

export async function GET() {
  const [emailEnabled, githubEnabled, emailWhitelistSuffixes] = await Promise.all([
    isSmtpConfigured(),
    isGitHubOAuthEnabled(),
    getEmailWhitelistSuffixes(),
  ]);

  return NextResponse.json({
    emailEnabled,
    githubEnabled,
    emailWhitelistSuffixes,
  });
}
