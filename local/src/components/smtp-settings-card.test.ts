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

import { SmtpSettingsCard } from "./smtp-settings-card";

describe("SmtpSettingsCard", () => {
  beforeEach(() => {
    stateMock.enabled = false;
    stateMock.callIndex = 0;
    stateMock.overrides = {};
    vi.restoreAllMocks();
  });

  it("renders with gray icon while loading or unconfigured", () => {
    const html = renderToStaticMarkup(React.createElement(SmtpSettingsCard));
    expect(html).toContain("SMTP 邮件服务配置");
    expect(html).toContain("bg-zinc-500/10");
  });

  it("renders lit blue icon and 已配置 badge when configured", () => {
    stateMock.enabled = true;
    stateMock.callIndex = 0;
    // 0: host, 1: port, 2: secure, 3: user, 4: pass, 5: from, 6: emailWhitelistText
    // 7: configured, 8: loading, 9: saving, 10: testing, 11: testRecipient, 12: notice
    stateMock.overrides = {
      0: "smtp.example.com",
      7: true, // configured
      8: false, // loading
    };

    const html = renderToStaticMarkup(React.createElement(SmtpSettingsCard));
    expect(html).toContain("SMTP 邮件服务配置");
    expect(html).toContain("bg-blue-500/15");
    expect(html).toContain("text-blue-600");
    expect(html).toContain("已配置");
  });

  it("renders gray icon and 未配置 badge when not configured and loaded", () => {
    stateMock.enabled = true;
    stateMock.callIndex = 0;
    stateMock.overrides = {
      0: "",
      7: false, // configured
      8: false, // loading
    };

    const html = renderToStaticMarkup(React.createElement(SmtpSettingsCard));
    expect(html).toContain("SMTP 邮件服务配置");
    expect(html).toContain("bg-zinc-500/10");
    expect(html).toContain("text-zinc-400");
    expect(html).toContain("未配置");
  });
});
