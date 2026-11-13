"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ServerCog,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@subfuse/ui/lib/utils";
import { Button } from "@subfuse/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subfuse/ui/components/ui/card";
import { SafeImage } from "@subfuse/ui/components/ui/safe-image";
import { useUserStore } from "@subfuse/ui/store/user-store";

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, fetchUser } = useUserStore();

  React.useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  if (isLoading && !user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-ink/10" />
          <div className="h-48 rounded-xl bg-ink/10" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <Card className="mx-auto">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">需要管理员登录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-fg-60">请使用系统管理员账号登录后访问管理后台。</p>
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
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <Card className="mx-auto">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">无权限访问</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-fg-60">仅系统管理员可访问管理后台。</p>
            <Button asChild variant="outline">
              <Link href="/dashboard">返回我的订阅</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    {
      href: "/dashboard/admin",
      exact: true,
      label: "系统配置",
      description: "SMTP 邮件服务与 OAuth 登录",
      icon: ServerCog,
    },
    {
      href: "/dashboard/admin/users",
      exact: false,
      label: "用户管理",
      description: "用户列表、VIP 会员与状态管控",
      icon: Users,
    },
  ];

  const isCurrentActive = (itemHref: string, exact: boolean) => {
    if (!pathname) return false;
    if (exact) return pathname === itemHref;
    return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Top Header bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/15 p-2.5 text-indigo-400 border border-indigo-500/20 shadow-xs">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">管理控制台</h1>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/20">
                Admin
              </span>
            </div>
            <p className="text-xs text-fg-50">系统全局服务与全量用户账户管理中心</p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-2 self-start sm:self-auto">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            返回我的订阅
          </Link>
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="rounded-xl border border-ink/10 bg-surface/50 backdrop-blur-sm p-2 flex flex-row lg:flex-col gap-1.5 shadow-xs">
            {navItems.map((item) => {
              const active = isCurrentActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 lg:flex-initial items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 shadow-xs"
                      : "text-fg-60 hover:text-fg hover:bg-ink/5"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-indigo-400" : "text-fg-40")} />
                  <div className="hidden sm:block text-left">
                    <div className="leading-tight">{item.label}</div>
                    <div className="text-[11px] text-fg-40 font-normal hidden lg:block leading-tight mt-0.5">
                      {item.description}
                    </div>
                  </div>
                  <span className="sm:hidden">{item.label}</span>
                </Link>
              );
            })}

            <div className="hidden lg:block my-2 border-t border-ink/5" />

            {/* Current Admin badge in sidebar on desktop */}
            <div className="hidden lg:flex items-center gap-3 px-3 py-2 mt-auto rounded-lg bg-ink/5 border border-ink/5">
              <SafeImage
                src={user.avatarUrl}
                alt={user.username}
                className="h-8 w-8 rounded-full border border-ink/20"
                fallback={
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                }
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{user.username}</div>
                <div className="text-[11px] text-indigo-400">系统主管理员</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
