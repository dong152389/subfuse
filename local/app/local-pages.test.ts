import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buttons: [] as any[],
  dashboardAdapter: null as any,
  homeAdapter: null as any,
  readJsonResponse: vi.fn(),
  readSourceImportResponse: vi.fn(),
  switches: [] as any[],
  templateAdapter: null as any,
  userState: {
    fetchUser: vi.fn(),
    logout: vi.fn(),
    user: null as any,
  },
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => React.createElement("span", null, "ArrowLeft"),
  CheckCircle2: () => React.createElement("span", null, "CheckCircle2"),
  Github: () => React.createElement("span", null, "Github"),
  KeyRound: () => React.createElement("span", null, "KeyRound"),
  Loader2: () => React.createElement("span", null, "Loader2"),
  LogOut: () => React.createElement("span", null, "LogOut"),
  Mail: () => React.createElement("span", null, "Mail"),
  Network: () => React.createElement("span", null, "Network"),
  Send: () => React.createElement("span", null, "Send"),
  ServerCog: () => React.createElement("span", null, "ServerCog"),
  Shield: () => React.createElement("span", null, "Shield"),
  ShieldAlert: () => React.createElement("span", null, "ShieldAlert"),
  ShieldCheck: () => React.createElement("span", null, "ShieldCheck"),
  Users: () => React.createElement("span", null, "Users"),
  Crown: () => React.createElement("span", null, "Crown"),
  Ban: () => React.createElement("span", null, "Ban"),
  UserPlus: () => React.createElement("span", null, "UserPlus"),
  UserCheck: () => React.createElement("span", null, "UserCheck"),
  RefreshCw: () => React.createElement("span", null, "RefreshCw"),
  Trash2: () => React.createElement("span", null, "Trash2"),
}));

vi.mock("@subfuse/ui/components/ui/button", () => ({
  Button: (props: any) => {
    mocks.buttons.push(props);
    return React.createElement("button", props, props.children);
  },
}));

vi.mock("@subfuse/ui/components/ui/card", () => ({
  Card: (props: any) => React.createElement("section", props, props.children),
  CardContent: (props: any) => React.createElement("div", props, props.children),
  CardHeader: (props: any) => React.createElement("header", props, props.children),
  CardTitle: (props: any) => React.createElement("h2", props, props.children),
}));

vi.mock("@subfuse/ui/components/ui/switch", () => ({
  Switch: (props: any) => {
    mocks.switches.push(props);
    return React.createElement("button", { disabled: props.disabled, role: "switch" });
  },
}));

vi.mock("@subfuse/ui/dashboard/subscription-dashboard-surface", () => ({
  SubscriptionDashboardSurface: (props: any) => {
    mocks.dashboardAdapter = props.adapter;
    return React.createElement("main", null, "DashboardSurface");
  },
}));

vi.mock("@subfuse/ui/product/client-response", () => ({
  readJsonResponse: mocks.readJsonResponse,
  readSourceImportResponse: mocks.readSourceImportResponse,
}));

vi.mock("@subfuse/ui/product/home/home-surface", () => ({
  HomeSurface: (props: any) => {
    mocks.homeAdapter = props.adapter;
    return React.createElement("main", null, "HomeSurface");
  },
}));

vi.mock("@subfuse/ui/store/user-store", () => ({
  useUserStore: () => mocks.userState,
}));

vi.mock("@subfuse/ui/templates/template-library-surface", () => ({
  TemplateLibrarySurface: (props: any) => {
    mocks.templateAdapter = props.adapter;
    return React.createElement("main", null, "TemplateLibrarySurface");
  },
}));

vi.mock("@local/components/local-login", () => ({
  LocalLogin: () => React.createElement("main", null, "LocalLogin"),
}));

vi.mock("@local/components/smtp-settings-card", () => ({
  SmtpSettingsCard: () => React.createElement("section", null, "SmtpSettingsCard"),
}));

vi.mock("@local/components/github-oauth-settings-card", () => ({
  GitHubOAuthSettingsCard: () => React.createElement("section", null, "GitHubOAuthSettingsCard"),
}));

vi.mock("@local/components/admin-user-management", () => ({
  AdminUserManagement: () => React.createElement("section", null, "AdminUserManagement"),
}));

import AdminConsoleLayout from "./dashboard/admin/layout";
import AdminUsersPage from "./dashboard/admin/users/page";
import AdminSettingsPage from "./dashboard/admin/page";
import DashboardPage from "./dashboard/page";
import LoginPage from "./login/page";
import SettingsPage from "./dashboard/settings/page";
import manifest from "./manifest";
import HomePage from "./page";
import TemplatesPage from "./templates/page";

describe("local app pages and adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.dashboardAdapter = null;
    mocks.homeAdapter = null;
    mocks.templateAdapter = null;
    mocks.buttons = [];
    mocks.switches = [];
    mocks.userState = {
      fetchUser: vi.fn(),
      logout: vi.fn(),
      user: null,
    };
  });

  it("builds the local web app manifest", () => {
    expect(manifest()).toMatchObject({
      short_name: "SubFuse",
      start_url: "/",
      display: "standalone",
      lang: "zh-CN",
      icons: [
        { src: "/icon.png", purpose: "any" },
        { src: "/icon.png", purpose: "maskable" },
      ],
    });
  });

  it("renders the local login page wrapper", () => {
    expect(renderToStaticMarkup(React.createElement(LoginPage))).toBe("<main>LocalLogin</main>");
  });

  it("connects the local home adapter to local API routes", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.readSourceImportResponse.mockResolvedValueOnce({ content: "yaml", headers: {}, parseResult: { nodes: [] } });
    mocks.readJsonResponse
      .mockResolvedValueOnce({ totalRules: 7 })
      .mockResolvedValueOnce({ items: [{ id: "rule-1" }], totalRules: 7, totalMatched: 1, source: "remote" })
      .mockResolvedValueOnce({ items: [{ key: "cn" }] });

    renderToStaticMarkup(React.createElement(HomePage));
    const adapter = mocks.homeAdapter;

    await expect(adapter.productApi.sourceImport.importSource({ url: "https://example.test/sub" })).resolves.toEqual({
      content: "yaml",
      headers: {},
      parseResult: { nodes: [] },
    });
    await expect(adapter.productApi.rules.getTotalRules()).resolves.toBe(7);
    await expect(adapter.productApi.rules.searchRules({ keyword: "hk", page: 2, size: 10 })).resolves.toEqual({
      items: [{ id: "rule-1" }],
      totalRules: 7,
      totalMatched: 1,
      source: "remote",
    });
    await expect(adapter.productApi.rules.loadCnCandidateRules({ moduleIds: ["stream"], excludedRuleKeys: ["old"] })).resolves.toEqual([
      { key: "cn" },
    ]);
    await adapter.loadSubscription("sub 1");
    await adapter.subscription.saveSubscription({ isEditing: true, subscriptionId: "sub 1", payload: { name: "Sub" } });
    await adapter.subscription.saveSubscription({ isEditing: false, payload: { name: "New" } });

    expect(adapter.subscription.autoUpdateIntervalPolicy).toEqual({
      defaultHours: 12,
      minHours: 0.1,
      stepHours: 0.1,
      requireIntegerHours: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/source-import", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions/sub%201", { cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions/sub%201", expect.objectContaining({ method: "PUT" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions", expect.objectContaining({ method: "POST" }));
  });

  it("connects the dashboard adapter to local subscription routes", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.readJsonResponse.mockResolvedValueOnce({ subscriptions: [{ id: "sub-1" }] }).mockResolvedValueOnce({}).mockResolvedValueOnce({
      ok: true,
    });

    renderToStaticMarkup(React.createElement(DashboardPage));
    const adapter = mocks.dashboardAdapter;
    vi.stubGlobal("window", {
      location: {
        href: "http://local.subfuse.test:31401/dashboard",
        origin: "http://local.subfuse.test:31401",
      },
    });

    await expect(adapter.fetchSubscriptions()).resolves.toEqual([{ id: "sub-1" }]);
    await expect(adapter.deleteSubscription("sub 1")).resolves.toBeUndefined();
    await expect(adapter.refreshSubscription("sub 1")).resolves.toEqual({ ok: true });
    await expect(adapter.updateSubscriptionSettings("sub 1", { name: "Sub" })).resolves.toBeUndefined();
    expect(
      adapter.resolveDownloadUrl({
        subscriptionUrl: "http://localhost:3001/api/subscriptions/token-1/config.yaml",
      })
    ).toBe("http://local.subfuse.test:31401/api/subscriptions/token-1/config.yaml");
    expect(adapter.autoUpdateIntervalPolicy).toEqual({
      defaultHours: 12,
      minHours: 0.1,
      stepHours: 0.1,
      requireIntegerHours: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions/sub%201", { method: "DELETE" });
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions/sub%201/refresh", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions/sub%201", expect.objectContaining({ method: "PUT" }));
  });

  it("connects the template library adapter to local template routes", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.readJsonResponse
      .mockResolvedValueOnce({ templates: [{ id: "tpl-1" }] })
      .mockResolvedValueOnce({ template: { kind: "yaml", config: {} } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    renderToStaticMarkup(React.createElement(TemplatesPage));
    const adapter = mocks.templateAdapter;

    await expect(adapter.loadTemplates("my")).resolves.toEqual([{ id: "tpl-1" }]);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(adapter.loadTemplateDetail("missing")).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(adapter.loadTemplateDetail("tpl 1")).resolves.toEqual({ kind: "yaml", config: {} });
    await expect(adapter.uploadTemplate({ name: "Tpl" })).resolves.toBeUndefined();
    await expect(adapter.deleteTemplate("tpl 1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/templates?type=my", { cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledWith("/api/templates/tpl%201", { cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledWith("/api/templates", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/templates?id=tpl%201", { method: "DELETE" });
  });

  it("rotates the dashboard link with its current token and propagates rejection", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    renderToStaticMarkup(React.createElement(DashboardPage));
    const link = { id: "sub 1", token: "rotated", subscriptionUrl: "https://local.subfuse.test/sub/rotated" };
    mocks.readJsonResponse.mockResolvedValueOnce({ subscription: link });
    await expect(mocks.dashboardAdapter.resetSubscriptionLink("sub 1", "old")).resolves.toEqual(link);
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions/sub%201/reset-link", {
      method: "POST", headers: { "If-Match": '"old"' },
    });
    mocks.readJsonResponse.mockRejectedValueOnce(new Error("stale link"));
    await expect(mocks.dashboardAdapter.resetSubscriptionLink("sub 1", "old")).rejects.toThrow("stale link");
  });

  it("renders local settings for anonymous and authenticated states", async () => {
    let html = renderToStaticMarkup(React.createElement(SettingsPage));
    expect(html).toContain("未登录");
    expect(html).toContain("允许本机和局域网订阅");
    expect(html).toContain("本机、局域网及其他保留地址都可作为订阅源");
    expect(html).toContain("/api/health/live");
    expect(mocks.buttons.find((button: any) => button.variant === "destructive")).toMatchObject({
      disabled: true,
    });
    expect(mocks.switches[0]).toMatchObject({ checked: false, disabled: true });

    vi.stubGlobal("window", { location: { href: "" } });
    mocks.buttons = [];
    mocks.switches = [];
    mocks.userState = {
      fetchUser: vi.fn(),
      logout: vi.fn(),
      user: { username: "admin", subscriptionCount: 2, quota: { maxSubscriptions: 9999 } },
    };
    html = renderToStaticMarkup(React.createElement(SettingsPage));
    expect(html).toContain("admin");
    expect(html).toContain("2 / 9999");
    const logoutButton = mocks.buttons.find((button: any) => button.variant === "destructive");
    expect(logoutButton).toMatchObject({ disabled: false });
    expect(mocks.switches[0]).toMatchObject({ checked: false, disabled: true });
    logoutButton.onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.userState.logout).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("/login");
  });

  it("renders standalone admin settings page based on admin privileges", () => {
    let html = renderToStaticMarkup(React.createElement(AdminSettingsPage));
    expect(html).toContain("需要管理员登录");

    mocks.userState = {
      fetchUser: vi.fn(),
      logout: vi.fn(),
      user: { username: "member", isAdmin: false },
    };
    html = renderToStaticMarkup(React.createElement(AdminSettingsPage));
    expect(html).toContain("无权限访问");

    mocks.userState = {
      fetchUser: vi.fn(),
      logout: vi.fn(),
      user: { username: "admin", isAdmin: true },
    };
    html = renderToStaticMarkup(React.createElement(AdminSettingsPage));
    expect(html).toContain("管理员配置");
    expect(html).toContain("SmtpSettingsCard");
    expect(html).toContain("GitHubOAuthSettingsCard");
  });

  it("renders admin quick action on dashboard only for non-banned admins", () => {
    renderToStaticMarkup(React.createElement(DashboardPage));
    const adapter = mocks.dashboardAdapter;

    expect(adapter.renderExtraQuickActions({ user: { isAdmin: false, isBanned: false } })).toBeNull();
    expect(adapter.renderExtraQuickActions({ user: { isAdmin: true, isBanned: true } })).toBeNull();

    const adminCardHtml = renderToStaticMarkup(
      adapter.renderExtraQuickActions({ user: { isAdmin: true, isBanned: false } })
    );
    expect(adminCardHtml).toContain('href="/dashboard/admin"');
    expect(adminCardHtml).toContain("管理员配置");
    expect(adminCardHtml).toContain('href="/dashboard/admin/users"');
    expect(adminCardHtml).toContain("用户管理");
  });

  it("renders admin console layout and users page based on admin privileges", () => {
    let layoutHtml = renderToStaticMarkup(
      React.createElement(AdminConsoleLayout, null, React.createElement("div", null, "Child Content"))
    );
    expect(layoutHtml).toContain("需要管理员登录");

    mocks.userState = {
      fetchUser: vi.fn(),
      logout: vi.fn(),
      user: { username: "member", isAdmin: false },
    };
    layoutHtml = renderToStaticMarkup(
      React.createElement(AdminConsoleLayout, null, React.createElement("div", null, "Child Content"))
    );
    expect(layoutHtml).toContain("无权限访问");

    mocks.userState = {
      fetchUser: vi.fn(),
      logout: vi.fn(),
      user: { username: "admin", isAdmin: true },
    };
    layoutHtml = renderToStaticMarkup(
      React.createElement(AdminConsoleLayout, null, React.createElement("div", null, "Child Content"))
    );
    expect(layoutHtml).toContain("管理控制台");
    expect(layoutHtml).toContain('href="/dashboard/admin"');
    expect(layoutHtml).toContain('href="/dashboard/admin/users"');
    expect(layoutHtml).toContain("系统配置");
    expect(layoutHtml).toContain("用户管理");
    expect(layoutHtml).toContain("Child Content");

    const usersPageHtml = renderToStaticMarkup(React.createElement(AdminUsersPage));
    expect(usersPageHtml).toContain("AdminUserManagement");
  });
});
