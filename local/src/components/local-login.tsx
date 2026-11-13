"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Mail, KeyRound } from "lucide-react";
import {
  getLocalAdminSetupCredentialError,
  getUserRegisterCredentialError,
  isValidEmail,
  LOCAL_ADMIN_PASSWORD_MIN_LENGTH,
  USER_PASSWORD_MIN_LENGTH,
} from "@local/lib/admin-credentials";
import { Button } from "@subfuse/ui/components/ui/button";
import { FormField } from "@subfuse/ui/components/ui/form-field";
import { Input } from "@subfuse/ui/components/ui/input";
import { PasswordField } from "@subfuse/ui/components/ui/password-field";
import { hasAuthConfigHandoff } from "@subfuse/ui/store/config-store/auth-handoff";
import { LocalEmailLogin } from "./local-email-login";
import { LocalGitHubBind } from "./local-github-bind";

type AuthState = {
  setupRequired: boolean;
  authenticated: boolean;
};

type ProvidersState = {
  emailEnabled: boolean;
  githubEnabled: boolean;
  loaded?: boolean;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function getPostLoginHref(): string {
  return hasAuthConfigHandoff() ? "/" : "/dashboard";
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LocalLogin() {
  const [auth, setAuth] = React.useState<AuthState | null>(null);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [setupToken, setSetupToken] = React.useState("");
  const [isRegister, setIsRegister] = React.useState(false);

  // Email & GitHub Auth states
  const [activeTab, setActiveTab] = React.useState<"password" | "email" | "reset_password">("password");
  const [providers, setProviders] = React.useState<ProvidersState>({
    emailEnabled: false,
    githubEnabled: false,
    loaded: false,
  });
  const [githubBindTicket, setGithubBindTicket] = React.useState<string | null>(null);
  const [githubRedirecting, setGithubRedirecting] = React.useState(false);

  // Optional email registration inputs
  const [regEmail, setRegEmail] = React.useState("");
  const [regEmailCode, setRegEmailCode] = React.useState("");
  const [regCountdown, setRegCountdown] = React.useState(0);
  const [regSendingCode, setRegSendingCode] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setSetupToken(fragment.get("setup-token")?.trim() || "");
    const bindTicket = fragment.get("github-bind")?.trim() || null;
    if (bindTicket) setGithubBindTicket(bindTicket);

    const queryParams = new URLSearchParams(window.location.search);
    const queryError = queryParams.get("error");
    if (queryError) setError(decodeURIComponent(queryError));

    void fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => readJson<AuthState>(response))
      .then((nextAuth) => {
        if (!cancelled) {
          setAuth(nextAuth);
          if (nextAuth.authenticated) window.location.href = getPostLoginHref();
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "加载失败");
      });

    void fetch("/api/auth/providers", { cache: "no-store" })
      .then((res) => readJson<ProvidersState>(res))
      .then((data) => {
        if (!cancelled && data) {
          setProviders({
            emailEnabled: Boolean(data.emailEnabled),
            githubEnabled: Boolean(data.githubEnabled),
            loaded: true,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviders({
            emailEnabled: false,
            githubEnabled: false,
            loaded: true,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Reg email countdown
  React.useEffect(() => {
    if (regCountdown <= 0) return;
    const timer = setInterval(() => {
      setRegCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [regCountdown]);

  const handleSendRegCode = async () => {
    setError("");
    if (providers.loaded && !providers.emailEnabled) {
      setError("系统尚未配置 SMTP 邮件服务，请管理员登录后前往「管理员配置」完成设置");
      return;
    }
    const trimmed = regEmail.trim();
    if (!trimmed || !isValidEmail(trimmed)) {
      setError("请输入有效的注册邮箱");
      return;
    }
    setRegSendingCode(true);
    try {
      const response = await fetch("/api/auth/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, purpose: "register" }),
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "验证码发送失败");
      setRegCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败，请稍后重试");
    } finally {
      setRegSendingCode(false);
    }
  };

  const setupRequired = auth?.setupRequired === true;

  const handleGitHubClick = async () => {
    setError("");
    if (providers.loaded && !providers.githubEnabled) {
      setError("GitHub OAuth 尚未配置，请管理员登录后前往「管理员配置」完成设置");
      return;
    }
    setGithubRedirecting(true);
    try {
      const response = await fetch("/api/auth/github/url");
      const data = await readJson<{ enabled?: boolean; url?: string; error?: string }>(response);
      if (!response.ok || !data.url) {
        throw new Error(data.error || "GitHub 登录未配置或暂时不可用");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动 GitHub 授权失败");
      setGithubRedirecting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const credentialError = setupRequired
      ? getLocalAdminSetupCredentialError({ username, password, passwordConfirm })
      : isRegister
      ? getUserRegisterCredentialError({ username, password, passwordConfirm })
      : "";
    if (credentialError) {
      setError(credentialError);
      return;
    }
    if (setupRequired && !setupToken) {
      setError("缺少初始化令牌，请使用安装器输出的初始化链接");
      return;
    }

    if (isRegister && providers.emailEnabled) {
      if (!regEmail.trim() || !isValidEmail(regEmail.trim())) {
        setError("请输入有效的注册邮箱");
        return;
      }
      if (!regEmailCode || regEmailCode.length !== 6) {
        setError("请输入邮箱验证码");
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = setupRequired
        ? "/api/setup/admin"
        : isRegister
        ? "/api/auth/register"
        : "/api/auth/login";
      const payload: Record<string, string> = { username, password, passwordConfirm };
      if (isRegister && providers.emailEnabled && regEmail) {
        payload.email = regEmail.trim();
        payload.code = regEmailCode.trim();
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(setupRequired ? { "X-SubFuse-Setup-Token": setupToken } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || (isRegister ? "注册失败" : "登录失败"));
      if (setupRequired) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      window.location.href = getPostLoginHref();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : (isRegister ? "注册失败，请重试" : "登录失败，请重试"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/logo.png" alt="SubFuse" width={64} height={64} className="rounded-2xl shadow-lg shadow-blue-500/25" />
          </Link>
          <h1 className="text-2xl font-bold mt-4 text-fg">
            {!auth || setupRequired || githubBindTicket
              ? "欢迎使用 SubFuse"
              : activeTab === "reset_password"
              ? "重置密码"
              : isRegister
              ? "创建一个账户"
              : "登录"}
          </h1>
          <p className="text-fg-50 mt-2 text-sm">
            {setupRequired ? (
              "初始化本地管理员账号"
            ) : githubBindTicket ? (
              "完善 GitHub 账号绑定信息"
            ) : !auth ? (
              "登录以使用订阅管理功能"
            ) : activeTab === "reset_password" ? (
              "验证已绑定的邮箱以设置新密码"
            ) : (
              <>
                {isRegister ? "已有账号？" : "没有账号？"}
                <a
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setActiveTab("password");
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsRegister(!isRegister);
                      setActiveTab("password");
                      setError("");
                    }
                  }}
                  className="text-indigo-400 hover:text-indigo-300 ml-1.5 font-medium underline-offset-4 hover:underline cursor-pointer"
                >
                  {isRegister ? "直接登录" : "立即注册"}
                </a>
              </>
            )}
          </p>
        </div>

        <div className="bg-ink/5 backdrop-blur-sm border border-ink/10 rounded-2xl p-6 space-y-4">
          {githubBindTicket ? (
            <LocalGitHubBind
              ticket={githubBindTicket}
              onSuccess={() => {
                window.location.href = getPostLoginHref();
              }}
              onCancel={() => {
                setGithubBindTicket(null);
                window.history.replaceState(null, "", window.location.pathname);
              }}
            />
          ) : auth ? (
            <>
              {(activeTab === "email" || activeTab === "reset_password") && !setupRequired ? (
                <div className="space-y-3">
                  <LocalEmailLogin
                    key={activeTab}
                    initialMode={activeTab === "reset_password" ? "reset_password" : "code_login"}
                    emailEnabled={providers.emailEnabled}
                    providersLoaded={Boolean(providers.loaded)}
                    isRegister={isRegister}
                    onSuccess={() => {
                      window.location.href = getPostLoginHref();
                    }}
                    onSwitchToPassword={() => {
                      setActiveTab("password");
                      setError("");
                    }}
                  />
                  {error ? (
                    <p className="text-red-400 text-sm" aria-live="polite">
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <FormField
                    label={
                      setupRequired
                        ? "管理员账号"
                        : isRegister
                        ? "用户名"
                        : "用户名或电子邮件"
                    }
                  >
                    <Input
                      autoComplete="username"
                      placeholder={
                        setupRequired
                          ? "管理员账号"
                          : isRegister
                          ? "输入您的用户名"
                          : "输入您的用户名或电子邮件"
                      }
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-12"
                    />
                  </FormField>

                  <PasswordField
                    label="密码"
                    labelAction={
                      !setupRequired && !isRegister ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("reset_password");
                            setError("");
                          }}
                          className="text-xs text-fg-50 hover:text-fg underline-offset-4 hover:underline transition-colors"
                        >
                          忘记密码？
                        </button>
                      ) : undefined
                    }
                    autoComplete={setupRequired || isRegister ? "new-password" : "current-password"}
                    description={
                      setupRequired
                        ? `至少 ${LOCAL_ADMIN_PASSWORD_MIN_LENGTH} 个字符`
                        : isRegister
                        ? `至少 ${USER_PASSWORD_MIN_LENGTH} 个字符`
                        : undefined
                    }
                    placeholder={setupRequired ? "密码" : isRegister ? `输入密码（至少 ${USER_PASSWORD_MIN_LENGTH} 个字符）` : "输入密码"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12"
                  />
                  {setupRequired && !setupToken ? (
                    <p className="text-amber-300/80 text-xs">
                      请从安装器输出的初始化链接进入本页面。
                    </p>
                  ) : null}
                  {setupRequired || isRegister ? (
                    <PasswordField
                      label="确认密码"
                      autoComplete="new-password"
                      placeholder="确认密码"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="h-12"
                    />
                  ) : null}

                  {/* Email verification section right below confirm password in registration */}
                  {isRegister && (
                    <div className="space-y-3">
                      <FormField
                        label={
                          providers.loaded && !providers.emailEnabled
                            ? "电子邮件（未配置 SMTP 时可留空）"
                            : "电子邮件（验证必需）"
                        }
                        description={
                          providers.loaded && !providers.emailEnabled
                            ? "系统尚未配置 SMTP 邮件服务，暂无法发送验证码（可留空直接注册，或由管理员前往「管理员配置」开启）"
                            : undefined
                        }
                      >
                        <div className="relative">
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder={
                              providers.loaded && !providers.emailEnabled
                                ? "未配置 SMTP，留空可直接注册"
                                : "name@example.com"
                            }
                            value={regEmail}
                            disabled={providers.loaded && !providers.emailEnabled}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="h-12 pl-10"
                          />
                          <Mail className="w-4 h-4 text-fg-40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </FormField>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            aria-label="邮箱验证码"
                            placeholder={
                              providers.loaded && !providers.emailEnabled ? "无需验证码" : "验证码"
                            }
                            value={regEmailCode}
                            disabled={providers.loaded && !providers.emailEnabled}
                            onChange={(e) => setRegEmailCode(e.target.value.replace(/\D/g, ""))}
                            className="h-12 pl-10 tracking-widest font-mono"
                          />
                          <KeyRound className="w-4 h-4 text-fg-40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={(providers.loaded && !providers.emailEnabled) || regCountdown > 0 || regSendingCode || !regEmail}
                          onClick={() => void handleSendRegCode()}
                          className="h-12 px-4 whitespace-nowrap text-xs"
                        >
                          {regSendingCode ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : regCountdown > 0 ? (
                            `${regCountdown}s 后重发`
                          ) : (
                            "发送验证码"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {error ? (
                    <p className="text-red-400 text-sm" aria-live="polite">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      !username ||
                      !password ||
                      ((setupRequired || isRegister) && !passwordConfirm) ||
                      (isRegister && providers.emailEnabled && (!regEmail || regEmailCode.length !== 6))
                    }
                    className="h-12 w-full mt-1"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {setupRequired ? "创建管理员" : isRegister ? "创建账户" : "登录"}
                  </Button>

                  {!setupRequired && !isRegister && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("email");
                          setError("");
                        }}
                        className="text-xs text-fg-50 hover:text-indigo-400 underline-offset-4 hover:underline transition-colors"
                      >
                        使用邮箱验证码免密登录
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* GitHub OAuth Button */}
              {!setupRequired && (
                <div className="pt-2">
                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-ink/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-ink/5 px-2 text-fg-40 rounded">或继续使用</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={githubRedirecting}
                    onClick={() => void handleGitHubClick()}
                    className="h-12 w-full gap-2 text-sm font-normal"
                  >
                    {githubRedirecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <GitHubIcon className="w-5 h-5" />
                    )}
                    使用 GitHub 继续
                  </Button>

                  {providers.loaded && !providers.githubEnabled ? (
                    <p className="mt-2 text-center text-xs text-fg-40">
                      GitHub OAuth 尚未配置，管理员可在「管理员配置」中开启
                    </p>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="h-36 animate-pulse rounded-xl bg-ink/5" />
          )}
        </div>
      </div>
    </div>
  );
}
