import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  encryptJson: vi.fn((val: unknown) => JSON.stringify(val)),
  decryptJson: vi.fn((_raw: unknown, fallback: unknown) => fallback),
}));

vi.mock("./prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./crypto", () => ({
  encryptJson: mocks.encryptJson,
  decryptJson: mocks.decryptJson,
}));

import {
  GITHUB_OAUTH_CALLBACK_PATH,
  normalizeGitHubCallbackUrl,
  resolveGitHubOAuthUrls,
  signGitHubOAuthState,
  verifyGitHubOAuthState,
} from "./github-oauth";

const originalEnv = {
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
  TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("GitHub OAuth URL resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("normalizes callback URLs and rejects invalid protocols", () => {
    expect(normalizeGitHubCallbackUrl(" https://sub.example.com/api/auth/github/callback/ ")).toBe(
      "https://sub.example.com/api/auth/github/callback"
    );
    expect(normalizeGitHubCallbackUrl("https://sub.example.com")).toBe(
      `https://sub.example.com${GITHUB_OAUTH_CALLBACK_PATH}`
    );
    expect(normalizeGitHubCallbackUrl("http://localhost:3001/api/auth/github/callback?foo=1#bar")).toBe(
      "http://localhost:3001/api/auth/github/callback"
    );
    expect(normalizeGitHubCallbackUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeGitHubCallbackUrl("not-a-url")).toBeNull();
    expect(normalizeGitHubCallbackUrl("   ")).toBeNull();
  });

  it("prefers explicit callbackUrl over APP_URL and request origin", () => {
    process.env.APP_URL = "http://localhost:3000";
    const request = new Request("http://127.0.0.1:3001/api/auth/github/url");

    expect(
      resolveGitHubOAuthUrls(request, {
        callbackUrl: "https://sub.example.com/api/auth/github/callback",
      })
    ).toEqual({
      baseUrl: "https://sub.example.com",
      redirectUri: "https://sub.example.com/api/auth/github/callback",
    });
  });

  it("uses request origin in dev when APP_URL is unset so localhost and 127.0.0.1 both work", () => {
    delete process.env.APP_URL;
    const localhostReq = new Request("http://localhost:3001/api/auth/github/url");
    expect(resolveGitHubOAuthUrls(localhostReq, null)).toEqual({
      baseUrl: "http://localhost:3001",
      redirectUri: "http://localhost:3001/api/auth/github/callback",
    });

    const loopbackReq = new Request("http://127.0.0.1:3001/api/auth/github/url");
    expect(resolveGitHubOAuthUrls(loopbackReq, null)).toEqual({
      baseUrl: "http://127.0.0.1:3001",
      redirectUri: "http://127.0.0.1:3001/api/auth/github/callback",
    });
  });

  it("uses explicit APP_URL when callbackUrl is not configured, and supports trusted proxy headers when APP_URL is unset", () => {
    process.env.APP_URL = "https://configured.example.com/";
    const req = new Request("http://localhost:3000/api/auth/github/url");
    expect(resolveGitHubOAuthUrls(req, null)).toEqual({
      baseUrl: "https://configured.example.com",
      redirectUri: "https://configured.example.com/api/auth/github/callback",
    });

    delete process.env.APP_URL;
    process.env.TRUST_PROXY_HEADERS = "true";
    const proxiedReq = new Request("http://localhost:3000/api/auth/github/url", {
      headers: {
        "x-forwarded-host": "proxy.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveGitHubOAuthUrls(proxiedReq, null)).toEqual({
      baseUrl: "https://proxy.example.com",
      redirectUri: "https://proxy.example.com/api/auth/github/callback",
    });
  });

  it("signs and verifies github oauth state for login and bind", async () => {
    process.env.JWT_SECRET = "test-secret-key-for-jwt-signing-0001";

    const loginState = await signGitHubOAuthState({ action: "login" });
    const verifiedLogin = await verifyGitHubOAuthState(loginState);
    expect(verifiedLogin).toEqual({
      action: "login",
      adminId: undefined,
      returnUrl: undefined,
    });

    const bindState = await signGitHubOAuthState({ action: "bind", adminId: "user-123" });
    const verifiedBind = await verifyGitHubOAuthState(bindState);
    expect(verifiedBind).toEqual({
      action: "bind",
      adminId: "user-123",
      returnUrl: undefined,
    });

    expect(await verifyGitHubOAuthState("invalid.state")).toBeNull();
    expect(await verifyGitHubOAuthState("")).toBeNull();
  });
});
