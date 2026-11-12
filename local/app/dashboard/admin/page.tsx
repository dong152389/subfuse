"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@subfuse/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subfuse/ui/components/ui/card";
import { useUserStore } from "@subfuse/ui/store/user-store";
import { SmtpSettingsCard } from "@local/components/smtp-settings-card";
import { GitHubOAuthSettingsCard } from "@local/components/github-oauth-settings-card";

export default function AdminSettingsPage() {
  const { user, isLoading, fetchUser } = useUserStore();

  React.useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  if (isLoading && !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-ink/10" />
          <div className="h-48 rounded-xl bg-ink/10" />
          <div className="h-40 rounded-xl bg-ink/10" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="mx-auto max-w-lg">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">需要管理员登录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-fg-60">请使用系统管理员账号登录后访问管理员配置。</p>
            <Button asChild>
              <Link href="/login">前往登录</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="mx-auto max-w-lg">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">无权限访问</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-fg-60">仅系统管理员可查看和修改 SMTP 邮件服务与 GitHub OAuth 登录配置。</p>
            <Button asChild variant="outline">
              <Link href="/dashboard">返回我的订阅</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">管理员配置</h1>
          <p className="text-fg-50">配置系统级 SMTP 邮件发信服务与 GitHub OAuth 授权登录</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 self-start sm:self-auto">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            返回我的订阅
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SmtpSettingsCard />
        <GitHubOAuthSettingsCard />
      </div>
    </div>
  );
}
