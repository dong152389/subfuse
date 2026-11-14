import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stateMock = vi.hoisted(() => ({
  enabled: false,
  callIndex: 0,
  overrides: {} as Record<number, unknown>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (!stateMock.enabled) return actual.useState(initial);
      const index = stateMock.callIndex++;
      const value = Object.prototype.hasOwnProperty.call(stateMock.overrides, index)
        ? stateMock.overrides[index]
        : initial;
      const setter = vi.fn();
      return [value, setter];
    },
  };
});

import { GitHubOAuthSettingsCard } from "./github-oauth-settings-card";

describe("GitHubOAuthSettingsCard", () => {
  beforeEach(() => {
    stateMock.enabled = false;
    stateMock.callIndex = 0;
    stateMock.overrides = {};
    vi.restoreAllMocks();
  });

  it("renders with gray icon while loading or unconfigured", () => {
    const html = renderToStaticMarkup(React.createElement(GitHubOAuthSettingsCard));
    expect(html).toContain("GitHub OAuth 登录配置");
    expect(html).toContain("bg-zinc-500/10");
  });

  it("renders lit purple icon and 已配置 badge when configured", () => {
    stateMock.enabled = true;
    stateMock.callIndex = 0;
    // 0: clientId, 1: clientSecret, 2: callbackUrl, 3: defaultCallbackUrl, 4: browserCallbackUrl
    // 5: copiedCallback, 6: configured, 7: loading, 8: saving, 9: notice
    stateMock.overrides = {
      0: "Ov23test",
      1: "••••••••",
      6: true, // configured
      7: false, // loading
    };

    const html = renderToStaticMarkup(React.createElement(GitHubOAuthSettingsCard));
    expect(html).toContain("GitHub OAuth 登录配置");
    expect(html).toContain("bg-purple-500/15");
    expect(html).toContain("text-purple-600");
    expect(html).toContain("已配置");
  });

  it("renders gray icon and 未配置 badge when not configured and loaded", () => {
    stateMock.enabled = true;
    stateMock.callIndex = 0;
    stateMock.overrides = {
      0: "",
      1: "",
      6: false, // configured
      7: false, // loading
    };

    const html = renderToStaticMarkup(React.createElement(GitHubOAuthSettingsCard));
    expect(html).toContain("GitHub OAuth 登录配置");
    expect(html).toContain("bg-zinc-500/10");
    expect(html).toContain("text-zinc-400");
    expect(html).toContain("未配置");
  });
});
