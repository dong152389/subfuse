import { jwtVerify, SignJWT } from "jose";
import { prisma } from "./prisma";
import { decryptJson, encryptJson } from "./crypto";
import { getAppUrl, requireEnv } from "./env";

export type GitHubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  callbackUrl?: string;
};

export const GITHUB_OAUTH_CALLBACK_PATH = "/api/auth/github/callback";

export function normalizeGitHubCallbackUrl(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.hash = "";
  parsed.search = "";

  const normalizedPath =
    parsed.pathname === "/" || parsed.pathname === ""
      ? GITHUB_OAUTH_CALLBACK_PATH
      : parsed.pathname.replace(/\/+$/, "");

  return `${parsed.origin}${normalizedPath}`;
}

function getForwardedRequestOrigin(request: Request): string | null {
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();
    if (host) {
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
      const proto = forwardedProto === "https" || forwardedProto === "http" ? forwardedProto : new URL(request.url).protocol.replace(":", "");
      try {
        return new URL(`${proto}://${host}`).origin;
      } catch {
        // fall through to request.url
      }
    }
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export function resolveGitHubOAuthUrls(
  request: Request,
  config?: Pick<GitHubOAuthConfig, "callbackUrl"> | null
): { baseUrl: string; redirectUri: string } {
  const configuredCallback = normalizeGitHubCallbackUrl(config?.callbackUrl);
  if (configuredCallback) {
    return {
      baseUrl: new URL(configuredCallback).origin,
      redirectUri: configuredCallback,
    };
  }

  let baseUrl = "";
  const hasExplicitAppUrl = typeof process.env.APP_URL === "string" && process.env.APP_URL.trim().length > 0;
  if (hasExplicitAppUrl) {
    try {
      baseUrl = getAppUrl();
    } catch {
      baseUrl = "";
    }
  }

  if (!baseUrl) {
    baseUrl = getForwardedRequestOrigin(request) || "";
  }

  if (!baseUrl) {
    baseUrl = getAppUrl();
  }

  return {
    baseUrl,
    redirectUri: `${baseUrl}${GITHUB_OAUTH_CALLBACK_PATH}`,
  };
}

const GITHUB_SETTING_KEY = "github_oauth_config";
const GITHUB_BIND_TOKEN_ISSUER = "subfuse-github-bind";
const GITHUB_STATE_ISSUER = "subfuse-github-oauth-state";

export type GitHubOAuthStatePayload = {
  action?: "login" | "bind";
  adminId?: string;
  returnUrl?: string;
};

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
        const callbackUrl = normalizeGitHubCallbackUrl(parsed.callbackUrl);
        return {
          clientId: parsed.clientId,
          clientSecret: parsed.clientSecret,
          ...(callbackUrl ? { callbackUrl } : {}),
        };
      }
    }
  } catch (error) {
    console.error("Failed to read GitHub OAuth config from database:", error);
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const callbackUrl = normalizeGitHubCallbackUrl(process.env.GITHUB_CALLBACK_URL);

  if (clientId && clientSecret) {
    return {
      clientId,
      clientSecret,
      ...(callbackUrl ? { callbackUrl } : {}),
    };
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
      "User-Agent": "SubFuse-App",
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
          "User-Agent": "SubFuse-App",
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

/**
 * Generate a signed OAuth state parameter.
 * Valid for 15 minutes.
 */
export async function signGitHubOAuthState(payload: GitHubOAuthStatePayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(GITHUB_STATE_ISSUER)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key());
}

/**
 * Verify a GitHub OAuth state parameter.
 */
export async function verifyGitHubOAuthState(state: string | null | undefined): Promise<GitHubOAuthStatePayload | null> {
  if (!state) return null;
  try {
    const { payload } = await jwtVerify(state, key(), {
      algorithms: ["HS256"],
    });

    if (payload.iss !== GITHUB_STATE_ISSUER) return null;

    return {
      action: payload.action === "bind" ? "bind" : "login",
      adminId: typeof payload.adminId === "string" ? payload.adminId : undefined,
      returnUrl: typeof payload.returnUrl === "string" ? payload.returnUrl : undefined,
    };
  } catch {
    return null;
  }
}
