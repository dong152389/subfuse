import { jwtVerify, SignJWT } from "jose";
import { prisma } from "./prisma";
import { decryptJson, encryptJson } from "./crypto";
import { requireEnv } from "./env";

export type GitHubOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

const GITHUB_SETTING_KEY = "github_oauth_config";
const GITHUB_BIND_TOKEN_ISSUER = "subboost-github-bind";

export type GitHubUserProfile = {
  id: string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export type GitHubBindTicketPayload = {
  githubId: string;
  githubUsername: string;
  avatarUrl: string | null;
  suggestedEmail: string | null;
};

function key(): Uint8Array {
  return new TextEncoder().encode(requireEnv("JWT_SECRET"));
}

/**
 * Retrieve GitHub OAuth configuration from database or env vars.
 */
export async function getGitHubOAuthConfig(): Promise<GitHubOAuthConfig | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: GITHUB_SETTING_KEY },
    });

    if (setting?.value) {
      const parsed = decryptJson<GitHubOAuthConfig | null>(setting.value, null);
      if (parsed?.clientId && parsed.clientSecret) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Failed to read GitHub OAuth config from database:", error);
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  return null;
}

export async function isGitHubOAuthEnabled(): Promise<boolean> {
  const config = await getGitHubOAuthConfig();
  return Boolean(config);
}

export async function saveGitHubOAuthConfig(config: GitHubOAuthConfig): Promise<void> {
  const encrypted = encryptJson(config);
  await prisma.systemSetting.upsert({
    where: { key: GITHUB_SETTING_KEY },
    update: { value: encrypted },
    create: { key: GITHUB_SETTING_KEY, value: encrypted },
  });
}

/**
 * Exchange GitHub authorization code for user profile.
 */
export async function fetchGitHubUser(code: string, redirectUri: string): Promise<GitHubUserProfile> {
  const config = await getGitHubOAuthConfig();
  if (!config) throw new Error("GitHub OAuth 未配置");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`GitHub 授权换取令牌失败 (HTTP ${tokenResponse.status})`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "GitHub 授权失败");
  }

  const accessToken = tokenData.access_token;

  // Fetch user profile
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "SubBoost-App",
    },
  });

  if (!userResponse.ok) {
    throw new Error(`获取 GitHub 用户信息失败 (HTTP ${userResponse.status})`);
  }

  const ghUser = (await userResponse.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  };

  let primaryEmail = ghUser.email || null;

  // If email is null/private, try fetching emails list
  if (!primaryEmail) {
    try {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "SubBoost-App",
        },
      });
      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const verifiedPrimary = emails.find((e) => e.primary && e.verified);
        if (verifiedPrimary) {
          primaryEmail = verifiedPrimary.email;
        } else if (emails[0]?.email) {
          primaryEmail = emails[0].email;
        }
      }
    } catch {
      // Ignore private email fetch errors
    }
  }

  return {
    id: String(ghUser.id),
    login: ghUser.login,
    name: ghUser.name || null,
    avatar_url: ghUser.avatar_url || null,
    email: primaryEmail,
  };
}

/**
 * Generate a signed bind ticket for GitHub first-time users.
 * Valid for 15 minutes.
 */
export async function signGitHubBindTicket(payload: GitHubBindTicketPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(GITHUB_BIND_TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key());
}

/**
 * Verify a GitHub bind ticket.
 */
export async function verifyGitHubBindTicket(ticket: string): Promise<GitHubBindTicketPayload | null> {
  try {
    const { payload } = await jwtVerify(ticket, key(), {
      algorithms: ["HS256"],
    });

    if (payload.iss !== GITHUB_BIND_TOKEN_ISSUER) return null;

    const githubId = typeof payload.githubId === "string" ? payload.githubId : "";
    const githubUsername = typeof payload.githubUsername === "string" ? payload.githubUsername : "";
    const avatarUrl = typeof payload.avatarUrl === "string" ? payload.avatarUrl : null;
    const suggestedEmail = typeof payload.suggestedEmail === "string" ? payload.suggestedEmail : null;

    if (!githubId || !githubUsername) return null;

    return {
      githubId,
      githubUsername,
      avatarUrl,
      suggestedEmail,
    };
  } catch {
    return null;
  }
}
