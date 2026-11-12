"use client";

import * as React from "react";
import { Mail, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { Button } from "@subfuse/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subfuse/ui/components/ui/card";
import { FormField } from "@subfuse/ui/components/ui/form-field";
import { Input } from "@subfuse/ui/components/ui/input";
import { isValidEmail } from "@local/lib/admin-credentials";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function UserEmailBindCard({
  currentEmail,
  onEmailUpdated,
}: {
  currentEmail?: string | null;
  onEmailUpdated: (newEmail: string) => void;
}) {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(!currentEmail);
  const [countdown, setCountdown] = React.useState(0);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    setError("");
    setSuccess("");
    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setSendingCode(true);
    try {
      const response = await fetch("/api/auth/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, purpose: "bind" }),
      });
      const data = await readJson<{ error?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.error || "验证码发送失败");
      setCountdown(60);
      setSuccess("验证码已发送至新邮箱，请查收");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setSendingCode(false);
    }
  };

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (!trimmedCode || trimmedCode.length !== 6) {
      setError("请输入 6 位有效数字验证码");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/me/bind-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, code: trimmedCode }),
      });
      const data = await readJson<{ error?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.error || "绑定邮箱失败");
      setSuccess("邮箱绑定成功");
      onEmailUpdated(trimmedEmail);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "绑定邮箱失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="rounded-lg bg-teal-500/20 p-2 text-teal-300">
          <Mail className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">绑定邮箱</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentEmail && !isEditing ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-fg-40">当前已绑定邮箱</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-medium text-sm">{currentEmail}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> 已验证
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(true);
                setEmail("");
                setCode("");
                setError("");
                setSuccess("");
              }}
            >
              更换绑定邮箱
            </Button>
          </div>
        ) : (
          <form onSubmit={handleBind} className="space-y-3">
            <FormField label={currentEmail ? "更换新邮箱" : "输入要绑定的邮箱"}>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
                <Mail className="w-4 h-4 text-fg-40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>

            <FormField label="验证码">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-9 tracking-widest font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-fg-40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={countdown > 0 || sendingCode || !email}
                  onClick={() => void handleSendCode()}
                  className="px-3 text-xs whitespace-nowrap min-w-[96px]"
                >
                  {sendingCode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : countdown > 0 ? (
                    `${countdown}s 后重发`
                  ) : (
                    "发送验证码"
                  )}
                </Button>
              </div>
            </FormField>

            {error && <p className="text-xs text-red-400">{error}</p>}
            {success && <p className="text-xs text-emerald-400">{success}</p>}

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={submitting || !email || code.length !== 6}>
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                确认绑定
              </Button>
              {currentEmail && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setError("");
                    setSuccess("");
                  }}
                >
                  取消
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
