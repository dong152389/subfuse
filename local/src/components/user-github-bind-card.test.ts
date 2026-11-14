import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserGitHubBindCard } from "./user-github-bind-card";

describe("UserGitHubBindCard", () => {
  it("renders unbound state when no github is bound", () => {
    const html = renderToStaticMarkup(
      React.createElement(UserGitHubBindCard, {
        currentGithubUsername: null,
        currentGithubId: null,
      })
    );
    expect(html).toContain("GitHub 账号绑定");
    expect(html).toContain("未绑定 GitHub 账号");
    expect(html).toContain("绑定 GitHub 账号");
    expect(html).toContain("bg-zinc-500/10");
  });

  it("renders bound state when github is bound", () => {
    const html = renderToStaticMarkup(
      React.createElement(UserGitHubBindCard, {
        currentGithubUsername: "octocat",
        currentGithubId: "123456",
      })
    );
    expect(html).toContain("当前已绑定 GitHub 账号");
    expect(html).toContain("@octocat");
    expect(html).toContain("已绑定");
    expect(html).toContain("解除 GitHub 绑定");
    expect(html).toContain("bg-purple-500/15");
  });
});
