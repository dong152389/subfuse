"use client";

import * as React from "react";
import { Loader2, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import { FormField } from "@subboost/ui/components/ui/form-field";
import { Input } from "@subboost/ui/components/ui/input";
import { PasswordField } from "@subboost/ui/components/ui/password-field";
import { isValidEmail, USER_PASSWORD_MIN_LENGTH } from "@local/lib/admin-credentials";

type EmailAuthMode = "code_login" | "reset_password";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function LocalEmailLogin({
  initialMode = "code_login",
  emailEnabled = true,
  providersLoaded = true,
  isRegister = false,
  onSuccess,
  onSwitchToPassword,
}: {
  initialMode?: EmailAuthMode;
  emailEnabled?: boolean;
  providersLoaded?: boolean;
  isRegister?: boolean;
  onSuccess: () => void;
  onSwitchToPassword: () => void;
}) {
  const [mode, setMode] = React.useState<EmailAuthMode>(initialMode);
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [countdown, setCountdown] = React.useState(0);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successNotice, setSuccessNotice] = React.useState("");
  const smtpUnavailable = providersLoaded && !emailEnabled;

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
    if (smtpUnavailable) {
      setError("系统尚未配置 SMTP 邮件服务，请管理员登录后前往「管理员配置」完成设置");
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("请输入邮箱地址");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setSendingCode(true);
    try {
      const purpose = mode === "reset_password" ? "reset_password" : "login";
      const response = await fetch("/api/auth/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, purpose }),
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
    setSuccessNotice("");

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

    if (mode === "reset_password") {
      if (password.length < USER_PASSWORD_MIN_LENGTH) {
        setError(`新密码至少需要 ${USER_PASSWORD_MIN_LENGTH} 个字符`);
        return;
      }
      if (password !== passwordConfirm) {
        setError("两次输入的密码不一致，请重新确认");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "code_login") {
        const response = await fetch("/api/auth/email/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail, code: trimmedCode }),
        });
        const data = await readJson<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(data.error || "登录失败");
        }
        onSuccess();
      } else {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            code: trimmedCode,
            password,
            passwordConfirm,
          }),
        });
        const data = await readJson<{ error?: string; message?: string }>(response);
        if (!response.ok) {
          throw new Error(data.error || "密码重置失败");
        }
        setSuccessNotice(data.message || "密码重置成功，请使用新密码登录");
        setTimeout(() => {
          onSwitchToPassword();
        }, 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求处理失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {smtpUnavailable ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300 leading-relaxed">
          系统尚未配置 SMTP 邮件服务，暂无法发送邮箱验证码。管理员登录后可前往「管理员配置」完成设置。
        </div>
      ) : null}

      {mode === "reset_password" ? (
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => {
              setMode("code_login");
              setError("");
              setSuccessNotice("");
            }}
            className="inline-flex items-center gap-1 text-xs text-fg-50 hover:text-fg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回免密登录
          </button>
          <span className="text-xs font-medium text-fg-60">重置密码</span>
        </div>
      ) : null}

      <FormField label="邮箱地址">
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
              placeholder="6位数字验证码"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-12 pl-10 tracking-widest font-mono text-center sm:text-left"
            />
            <KeyRound className="w-4 h-4 text-fg-40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={smtpUnavailable || countdown > 0 || sendingCode || !email}
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

      {mode === "reset_password" ? (
        <>
          <PasswordField
            label="新密码"
            autoComplete="new-password"
            description={`至少 ${USER_PASSWORD_MIN_LENGTH} 个字符`}
            placeholder="新密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12"
          />
          <PasswordField
            label="确认新密码"
            autoComplete="new-password"
            placeholder="确认新密码"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="h-12"
          />
        </>
      ) : null}

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
        disabled={
          smtpUnavailable ||
          submitting ||
          !email ||
          code.length !== 6 ||
          (mode === "reset_password" && (!password || !passwordConfirm))
        }
        className="h-12 w-full mt-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === "reset_password"
          ? "确认重置密码"
          : isRegister
          ? "验证码注册并登录"
          : "验证码登录 / 注册"}
      </Button>

      <div className="flex items-center justify-between pt-2 text-xs text-fg-50">
        <button
          type="button"
          onClick={onSwitchToPassword}
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {isRegister ? "账号密码注册" : "账号密码登录"}
        </button>

        {mode === "code_login" && (
          <button
            type="button"
            onClick={() => {
              setMode("reset_password");
              setError("");
              setSuccessNotice("");
            }}
            className="text-fg-40 hover:text-fg-60 transition-colors"
          >
            忘记密码？
          </button>
        )}
      </div>
    </form>
  );
}
