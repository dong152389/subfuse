"use client";
import Link from "next/link";
import { Shield, Users } from "lucide-react";
import { Card, CardContent } from "@subfuse/ui/components/ui/card";
import {
  SubscriptionDashboardSurface,
  type DashboardSurfaceAdapter,
} from "@subfuse/ui/dashboard/subscription-dashboard-surface";
import { readJsonResponse } from "@subfuse/ui/product/client-response";
import type { RefreshSubscriptionResponse, Subscription, SubscriptionLink } from "@subfuse/ui/dashboard/dashboard-types";
import { LOCAL_AUTO_UPDATE_POLICY } from "@local/lib/auto-update-policy";

function resolveLocalDashboardDownloadUrl(subscription: Subscription): string {
  try {
    const url = new URL(subscription.subscriptionUrl, window.location.href);
    if (url.pathname.includes("/api/subscriptions/")) {
      return `${window.location.origin}${url.pathname}${url.search}`;
    }
  } catch {}
  return subscription.subscriptionUrl;
}

const localDashboardAdapter: DashboardSurfaceAdapter = {
  loginHref: "/login",
  newSubscriptionHref: "/?newSubscription=1",
  templatesHref: "/templates",
  settingsHref: "/dashboard/settings",
  settingsDescription: "查看账户信息和运行状态",
  autoUpdateIntervalPolicy: LOCAL_AUTO_UPDATE_POLICY,
  fetchSubscriptions: async () => {
    const response = await fetch("/api/subscriptions");
    const data = await readJsonResponse<{ subscriptions?: Subscription[]; error?: string }>(response, "获取订阅失败");
    return Array.isArray(data.subscriptions) ? data.subscriptions : [];
  },
  deleteSubscription: async (id) => {
    const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
    await readJsonResponse<{ error?: string }>(response, "删除失败");
  },
  refreshSubscription: async (id) => {
    const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await readJsonResponse<RefreshSubscriptionResponse>(response, "刷新失败");
    return data;
  },
  updateSubscriptionSettings: async (id, payload) => {
    const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await readJsonResponse<{ error?: string }>(response, "保存失败");
  },
  resetSubscriptionLink: async (id, token) => {
    const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}/reset-link`, {
      method: "POST",
      headers: { "If-Match": `"${token}"` },
    });
    const data = await readJsonResponse<{ subscription: SubscriptionLink }>(response, "重置订阅链接失败");
    return data.subscription;
  },
  resolveDownloadUrl: resolveLocalDashboardDownloadUrl,
  renderExtraQuickActions: ({ user }) => {
    if (!user.isAdmin || user.isBanned) return null;
    return (
      <>
        <Link href="/dashboard/admin" className="md:col-span-1">
          <Card className="cursor-pointer hover:border-ink/20 transition-colors h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-medium">管理员配置</h3>
                  <p className="text-sm text-fg-50">配置 SMTP 邮件服务与 GitHub OAuth 授权登录</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/admin/users" className="md:col-span-1">
          <Card className="cursor-pointer hover:border-ink/20 transition-colors h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/20 text-amber-400">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-medium">用户管理</h3>
                  <p className="text-sm text-fg-50">管理系统所有用户、授权 VIP 会员及状态管控</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </>
    );
  },
};

export default function DashboardPage() {
  return <SubscriptionDashboardSurface adapter={localDashboardAdapter} />;
}
