"use client";

import * as React from "react";
import {
  Ban,
  CheckCircle2,
  Crown,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Button } from "@subfuse/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subfuse/ui/components/ui/card";
import { confirmDialog } from "@subfuse/ui/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@subfuse/ui/components/ui/dialog";
import { FormField } from "@subfuse/ui/components/ui/form-field";
import { Input } from "@subfuse/ui/components/ui/input";
import { PasswordField } from "@subfuse/ui/components/ui/password-field";
import { SafeImage } from "@subfuse/ui/components/ui/safe-image";
import { SwitchField } from "@subfuse/ui/components/ui/switch-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@subfuse/ui/components/ui/table";
import { toast } from "@subfuse/ui/components/ui/toaster";
import { useUserStore } from "@subfuse/ui/store/user-store";

export type ManagedUser = {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  githubId: string | null;
  githubUsername: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  banReason: string | null;
  isVip: boolean;
  vipRaw: boolean;
  vipExpiresAt: string | null;
  subscriptionCount: number;
  templateCount: number;
  createdAt: string;
  lastLoginAt: string | null;
};

export type UserStats = {
  totalUsers: number;
  totalVip: number;
  totalBanned: number;
  totalActiveToday: number;
};

async function fetchUsersApi(params: {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  users: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
  stats: UserStats;
}> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.role && params.role !== "all") query.set("role", params.role);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const res = await fetch(`/api/admin/users?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "获取用户列表失败");
  }
  return res.json();
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export function AdminUserManagement() {
  const { user: currentAdmin } = useUserStore();
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [stats, setStats] = React.useState<UserStats | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(15);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);

  // Modal states
  const [addUserOpen, setAddUserOpen] = React.useState(false);
  const [resetPwdUser, setResetPwdUser] = React.useState<ManagedUser | null>(null);
  const [vipUser, setVipUser] = React.useState<ManagedUser | null>(null);
  const [banUser, setBanUser] = React.useState<ManagedUser | null>(null);

  // Form states for Add User
  const [newUsername, setNewUsername] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newIsVip, setNewIsVip] = React.useState(false);
  const [newVipDays, setNewVipDays] = React.useState("30");
  const [submittingAdd, setSubmittingAdd] = React.useState(false);

  // Form states for Reset Password
  const [resetPasswordValue, setResetPasswordValue] = React.useState("");
  const [submittingReset, setSubmittingReset] = React.useState(false);

  // Form states for VIP
  const [vipTargetIsVip, setVipTargetIsVip] = React.useState(false);
  const [vipPresetDays, setVipPresetDays] = React.useState("30");
  const [submittingVip, setSubmittingVip] = React.useState(false);

  // Form states for Ban
  const [banReasonInput, setBanReasonInput] = React.useState("");
  const [submittingBan, setSubmittingBan] = React.useState(false);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsersApi({
        search: debouncedSearch,
        role: roleFilter,
        page,
        pageSize,
      });
      setUsers(data.users);
      setTotal(data.total);
      setStats(data.stats);
    } catch (err) {
      toast({
        title: "加载失败",
        description: err instanceof Error ? err.message : "无法加载用户列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, page, pageSize]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Handle Add User
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      toast({ title: "请填写完整", description: "用户名和密码为必填项", variant: "destructive" });
      return;
    }

    setSubmittingAdd(true);
    try {
      const vipDaysNum = newIsVip ? parseInt(newVipDays, 10) || 0 : undefined;
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          email: newEmail.trim() || undefined,
          isVip: newIsVip,
          vipDays: vipDaysNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建用户失败");

      toast({ title: "创建成功", description: `已成功创建用户 ${newUsername}` });
      setAddUserOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      setNewIsVip(false);
      setNewVipDays("30");
      void loadUsers();
    } catch (err) {
      toast({
        title: "创建失败",
        description: err instanceof Error ? err.message : "创建用户失败",
        variant: "destructive",
      });
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handle Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUser || !resetPasswordValue) return;

    setSubmittingReset(true);
    try {
      const res = await fetch(`/api/admin/users/${resetPwdUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "重置密码失败");

      toast({ title: "重置成功", description: `用户 ${resetPwdUser.username} 的密码已成功修改` });
      setResetPwdUser(null);
      setResetPasswordValue("");
    } catch (err) {
      toast({
        title: "重置失败",
        description: err instanceof Error ? err.message : "重置密码失败",
        variant: "destructive",
      });
    } finally {
      setSubmittingReset(false);
    }
  };

  // Handle VIP Setting
  const handleVipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipUser) return;

    setSubmittingVip(true);
    try {
      const vipDaysNum = vipTargetIsVip ? parseInt(vipPresetDays, 10) : 0;
      const res = await fetch(`/api/admin/users/${vipUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isVip: vipTargetIsVip,
          vipDays: vipDaysNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新 VIP 状态失败");

      toast({
        title: "更新成功",
        description: vipTargetIsVip
          ? `已为用户 ${vipUser.username} 开通 VIP 会员`
          : `已取消用户 ${vipUser.username} 的 VIP 会员`,
      });
      setVipUser(null);
      void loadUsers();
    } catch (err) {
      toast({
        title: "设置失败",
        description: err instanceof Error ? err.message : "更新 VIP 状态失败",
        variant: "destructive",
      });
    } finally {
      setSubmittingVip(false);
    }
  };

  // Handle Ban / Unban
  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banUser) return;

    setSubmittingBan(true);
    try {
      const isBanning = !banUser.isBanned;
      const res = await fetch(`/api/admin/users/${banUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBanned: isBanning,
          banReason: isBanning ? banReasonInput.trim() || "管理员操作封禁" : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "操作失败");

      toast({
        title: isBanning ? "封禁成功" : "解封成功",
        description: isBanning
          ? `已封禁用户 ${banUser.username}`
          : `已解封用户 ${banUser.username}`,
      });
      setBanUser(null);
      setBanReasonInput("");
      void loadUsers();
    } catch (err) {
      toast({
        title: "操作失败",
        description: err instanceof Error ? err.message : "状态更新失败",
        variant: "destructive",
      });
    } finally {
      setSubmittingBan(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (user: ManagedUser) => {
    const confirmed = await confirmDialog({
      title: `删除用户 ${user.username}`,
      description: `确定要永久删除用户 ${user.username} 吗？该用户名下的所有订阅与配置模板也将被一并彻底清除，此操作不可撤销！`,
      confirmText: "确认删除",
      cancelText: "取消",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");

      toast({ title: "删除成功", description: `用户 ${user.username} 已被删除` });
      void loadUsers();
    } catch (err) {
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "删除用户失败",
        variant: "destructive",
      });
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">用户管理</h2>
          <p className="text-sm text-fg-50 mt-0.5">
            查看与维护系统所有用户、授权 VIP 会员及账号状态管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button
            size="sm"
            onClick={() => setAddUserOpen(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            添加用户
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-fg-50">全部用户</CardTitle>
              <div className="rounded-lg bg-indigo-500/15 p-2 text-indigo-400">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-fg-40 mt-1">系统注册总账户数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-fg-50">VIP 会员</CardTitle>
              <div className="rounded-lg bg-amber-500/15 p-2 text-amber-400">
                <Crown className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-300">{stats.totalVip}</div>
              <p className="text-xs text-fg-40 mt-1">享更高订阅与节点配额</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-fg-50">24h 活跃</CardTitle>
              <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400">
                <UserCheck className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-300">{stats.totalActiveToday}</div>
              <p className="text-xs text-fg-40 mt-1">今日登录用户数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-fg-50">已封禁</CardTitle>
              <div className="rounded-lg bg-red-500/15 p-2 text-red-400">
                <Ban className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{stats.totalBanned}</div>
              <p className="text-xs text-fg-40 mt-1">禁止访问与转换服务</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-40" />
              <Input
                placeholder="搜索用户名或邮箱..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-40 hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: "all", label: "全部" },
                { key: "vip", label: "VIP 会员" },
                { key: "user", label: "普通用户" },
                { key: "admin", label: "管理员" },
                { key: "banned", label: "已封禁" },
              ].map((tab) => {
                const active = roleFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setRoleFilter(tab.key);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : "text-fg-60 hover:text-fg hover:bg-ink/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">用户</TableHead>
                  <TableHead>身份与等级</TableHead>
                  <TableHead>资源使用</TableHead>
                  <TableHead>时间记录</TableHead>
                  <TableHead>账号状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-fg-50">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                        <span>正在加载用户数据...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-fg-50">
                      未找到符合条件的用户
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const isSelf = currentAdmin?.id === u.id;
                    const canManage = !u.isAdmin && !isSelf;

                    return (
                      <TableRow key={u.id}>
                        {/* User info */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <SafeImage
                              src={u.avatarUrl}
                              alt={u.username}
                              className="h-9 w-9 rounded-full border border-ink/20 shrink-0"
                              fallback={
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold">
                                  {u.username.slice(0, 2).toUpperCase()}
                                </div>
                              }
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-fg truncate">
                                  {u.username}
                                </span>
                                {isSelf && (
                                  <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[10px] text-indigo-400 font-medium border border-indigo-500/20">
                                    当前账号
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-fg-40 truncate flex items-center gap-1 mt-0.5">
                                {u.email ? (
                                  <>
                                    <span>{u.email}</span>
                                    {u.emailVerified && (
                                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                    )}
                                  </>
                                ) : (
                                  <span>未绑定邮箱</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role & VIP */}
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            {u.isAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                <Shield className="h-3 w-3" />
                                管理员
                              </span>
                            ) : u.isVip ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Crown className="h-3 w-3" />
                                  VIP 会员
                                </span>
                                <div className="text-[11px] text-fg-40 mt-0.5">
                                  {u.vipExpiresAt
                                    ? `到期：${formatDate(u.vipExpiresAt)}`
                                    : "永久有效"}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-ink/5 text-fg-60">
                                普通用户
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Resource counts */}
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium text-fg">{u.subscriptionCount}</span>
                            <span className="text-xs text-fg-40"> 订阅</span>
                            <span className="text-fg-30 mx-1">/</span>
                            <span className="font-medium text-fg">{u.templateCount}</span>
                            <span className="text-xs text-fg-40"> 模板</span>
                          </div>
                        </TableCell>

                        {/* Dates */}
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div className="text-fg-60">注册：{formatDate(u.createdAt)}</div>
                            <div className="text-fg-40">登录：{formatDateTime(u.lastLoginAt)}</div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {u.isBanned ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                <Ban className="h-3 w-3" />
                                已封禁
                              </span>
                              {u.banReason && (
                                <p className="text-[11px] text-red-300/80 mt-0.5 max-w-[120px] truncate" title={u.banReason}>
                                  {u.banReason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                              正常
                            </span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {/* VIP setting button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              title="设置 VIP 会员"
                              onClick={() => {
                                setVipUser(u);
                                setVipTargetIsVip(u.isVip);
                                setVipPresetDays(u.isVip ? "0" : "30");
                              }}
                            >
                              <Crown className="h-3.5 w-3.5 mr-1" />
                              VIP
                            </Button>

                            {/* Reset password button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                              title="修改/重置密码"
                              onClick={() => {
                                setResetPwdUser(u);
                                setResetPasswordValue("");
                              }}
                            >
                              <KeyRound className="h-3.5 w-3.5 mr-1" />
                              密码
                            </Button>

                            {/* Ban/Unban button */}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 px-2 text-xs ${
                                  u.isBanned
                                    ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                    : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                }`}
                                title={u.isBanned ? "解封账号" : "封禁账号"}
                                onClick={() => {
                                  setBanUser(u);
                                  setBanReasonInput(u.banReason || "");
                                }}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                {u.isBanned ? "解封" : "封禁"}
                              </Button>
                            )}

                            {/* Delete button */}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                title="删除用户"
                                onClick={() => void handleDeleteUser(u)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-ink/10 px-4 py-3">
              <div className="text-xs text-fg-50">
                共 {total} 位用户，当前第 {page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加新用户</DialogTitle>
            <DialogDescription>
              在系统中手动注册新用户账号并设定初始权限与配额。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUserSubmit} className="space-y-4 py-2">
            <FormField label="用户名 *" description="3-32 位字符，支持字母、数字及下划线">
              <Input
                placeholder="例如: test_user"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
            </FormField>

            <PasswordField
              label="登录密码 *"
              description="至少 8 个字符"
              placeholder="设置初始密码"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <FormField label="电子邮箱 (可选)" description="用于找回密码或邮件登录">
              <Input
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </FormField>

            <div className="rounded-lg border border-ink/10 bg-ink/5 p-3 space-y-3">
              <SwitchField
                label="授予 VIP 会员身份"
                description="开通后享受更高订阅数与节点配额"
                checked={newIsVip}
                onCheckedChange={setNewIsVip}
              />

              {newIsVip && (
                <FormField label="VIP 有效期限">
                  <select
                    className="flex h-10 w-full rounded-xl border border-field-border bg-field px-3 py-2 text-sm text-fg shadow-xs focus:outline-none focus:ring-2 focus:ring-focus-ring transition-all"
                    value={newVipDays}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewVipDays(e.target.value)}
                  >
                    <option value="30">30 天 (月度会员)</option>
                    <option value="90">90 天 (季度会员)</option>
                    <option value="365">365 天 (年度会员)</option>
                    <option value="0">永久有效 (无过期时间)</option>
                  </select>
                </FormField>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddUserOpen(false)}
                disabled={submittingAdd}
              >
                取消
              </Button>
              <Button type="submit" disabled={submittingAdd}>
                {submittingAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                创建用户
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={Boolean(resetPwdUser)} onOpenChange={(open) => !open && setResetPwdUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重置用户密码</DialogTitle>
            <DialogDescription>
              为用户 <strong className="text-fg">{resetPwdUser?.username}</strong> 设置新的登录密码。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4 py-2">
            <PasswordField
              label="新密码 *"
              description="至少 8 位字符"
              placeholder="请输入新密码"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              required
              autoFocus
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPwdUser(null)}
                disabled={submittingReset}
              >
                取消
              </Button>
              <Button type="submit" disabled={submittingReset}>
                {submittingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认修改
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIP Settings Dialog */}
      <Dialog open={Boolean(vipUser)} onOpenChange={(open) => !open && setVipUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-400" />
              VIP 会员设置
            </DialogTitle>
            <DialogDescription>
              管理用户 <strong className="text-fg">{vipUser?.username}</strong> 的 VIP 会员身份及有效期。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVipSubmit} className="space-y-4 py-2">
            <div className="rounded-lg border border-ink/10 bg-ink/5 p-3 space-y-3">
              <SwitchField
                label="VIP 会员资格"
                description="开启后享受专属 VIP 徽章与扩展资源配额"
                checked={vipTargetIsVip}
                onCheckedChange={setVipTargetIsVip}
              />

              {vipTargetIsVip && (
                <FormField label="有效期选择" description="从当前时间开始延长时间">
                  <select
                    className="flex h-10 w-full rounded-xl border border-field-border bg-field px-3 py-2 text-sm text-fg shadow-xs focus:outline-none focus:ring-2 focus:ring-focus-ring transition-all"
                    value={vipPresetDays}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVipPresetDays(e.target.value)}
                  >
                    <option value="30">增加 30 天</option>
                    <option value="90">增加 90 天</option>
                    <option value="180">增加 180 天 (半年)</option>
                    <option value="365">增加 365 天 (一年)</option>
                    <option value="0">设为永久会员 (无到期时间)</option>
                  </select>
                </FormField>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVipUser(null)}
                disabled={submittingVip}
              >
                取消
              </Button>
              <Button type="submit" disabled={submittingVip}>
                {submittingVip && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存会员设置
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ban / Unban Dialog */}
      <Dialog open={Boolean(banUser)} onOpenChange={(open) => !open && setBanUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {banUser?.isBanned ? (
                <>
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                  解封用户账号
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                  封禁用户账号
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {banUser?.isBanned
                ? `确认恢复用户 ${banUser.username} 的正常登录与使用权限？`
                : `封禁后用户 ${banUser?.username} 将立即无法登录系统或使用任何订阅与转换服务。`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBanSubmit} className="space-y-4 py-2">
            {!banUser?.isBanned && (
              <FormField label="封禁原因 *" description="向被封禁用户展示的原因说明">
                <Input
                  placeholder="例如: 违规滥用订阅转换资源"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  required
                />
              </FormField>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBanUser(null)}
                disabled={submittingBan}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant={banUser?.isBanned ? "default" : "destructive"}
                disabled={submittingBan}
              >
                {submittingBan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {banUser?.isBanned ? "确认解封" : "确认封禁"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
