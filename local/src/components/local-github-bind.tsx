"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, Mail, KeyRound, User, ArrowLeft } from "lucide-react";
import { Button } from "@subfuse/ui/components/ui/button";
import { FormField } from "@subfuse/ui/components/ui/form-field";
import { Input } from "@subfuse/ui/components/ui/input";
import { isValidEmail } from "@local/lib/admin-credentials";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function LocalGitHubBind({
  ticket,
  emailWhitelistSuffixes = [],
  onSuccess,
  onCancel,
}: {
  ticket: string;
  emailWhitelistSuffixes?: string[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [countdown, setCountdown] = React.useState(0);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successNotice, setSuccessNotice] = React.useState("");

  // Countdown timer
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    setError("");
    setSuccessNotice("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("请输入要绑定的邮箱地址");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setSendingCode(true);
    try {
      const response = await fetch("/api/auth/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, purpose: "github_bind" }),
      });
      const data = await readJson<{ error?: string; message?: string }>(response);
      if (!response.ok) {
        throw new Error(data.error || "验证码发送失败");
      }
      setCountdown(60);
      setSuccessNotice(data.message || "验证码已发送至您的邮箱，请查收");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败，请稍后重试");
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (!trimmedCode || trimmedCode.length !== 6) {
      setError("请输入 6 位数字验证码");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/github/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket,
          email: trimmedEmail,
          code: trimmedCode,
          username: username.trim() || undefined,
        }),
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(data.error || "绑定失败");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "绑定处理失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-xs text-fg-50 hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          取消并返回
        </button>
        <span className="text-xs font-medium text-indigo-400">GitHub 授权成功</span>
      </div>

      <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3.5 text-xs text-fg-70 leading-relaxed">
        首次使用 GitHub 授权登录，请验证并绑定您的邮箱。如果该邮箱已有账号，将直接与您的 GitHub 账号绑定并保留原有用户名。
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <FormField
          label="绑定邮箱"
          description={
            emailWhitelistSuffixes && emailWhitelistSuffixes.length > 0
              ? `若创建新用户，仅支持后缀：${emailWhitelistSuffixes.join("、")}`
              : undefined
          }
        >
          <div className="relative">
            <Input
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10"
            />
            <Mail className="w-4 h-4 text-fg-40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </FormField>

        <FormField label="邮箱验证码">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 pl-10 tracking-widest font-mono text-center sm:text-left"
              />
              <KeyRound className="w-4 h-4 text-fg-40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={countdown > 0 || sendingCode || !email}
              onClick={() => void handleSendCode()}
              className="h-12 px-4 whitespace-nowrap min-w-[108px]"
            >
              {sendingCode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : countdown > 0 ? (
                `${countdown}s 后重发`
              ) : (
                "获取验证码"
              )}
            </Button>
          </div>
        </FormField>

        <FormField
          label="自定义用户名（可选）"
          description="仅新注册账号生效；若该邮箱已存在账号，将保留原邮箱注册的用户名"
        >
          <div className="relative">
            <Input
              type="text"
              autoComplete="username"
              placeholder="自定义用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 pl-10"
            />
            <User className="w-4 h-4 text-fg-40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </FormField>

        {error ? (
          <p className="text-red-400 text-sm" aria-live="polite">
            {error}
          </p>
        ) : null}

        {successNotice ? (
          <p className="text-emerald-400 text-sm" aria-live="polite">
            {successNotice}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={submitting || !email || code.length !== 6}
          className="h-12 w-full mt-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          绑定邮箱并进入系统
        </Button>
      </form>
    </div>
  );
}
