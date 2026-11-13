"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Unlink } from "lucide-react";
import { Button } from "@subfuse/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subfuse/ui/components/ui/card";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function UserGitHubBindCard({
  currentGithubUsername,
  currentGithubId,
  onUpdated,
}: {
  currentGithubUsername?: string | null;
  currentGithubId?: string | null;
  onUpdated?: () => void;
}) {
  const [githubEnabled, setGithubEnabled] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [confirmUnbind, setConfirmUnbind] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/providers", { cache: "no-store" })
      .then((res) => readJson<{ githubEnabled?: boolean }>(res))
      .then((data) => {
        if (!cancelled) {
          setGithubEnabled(Boolean(data.githubEnabled));
        }
      })
      .catch(() => {
        if (!cancelled) setGithubEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartBind = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/github/url?action=bind");
      const data = await readJson<{ enabled?: boolean; url?: string; error?: string }>(response);
      if (!response.ok || !data.url) {
        throw new Error(data.error || "GitHub 绑定服务暂时不可用");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法发起 GitHub 授权");
      setLoading(false);
    }
  };

  const handleUnbind = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/me/unbind-github", {
        method: "POST",
      });
      const data = await readJson<{ error?: string; message?: string }>(response);
      if (!response.ok) {
        throw new Error(data.error || "解除绑定失败");
      }
      setSuccess("GitHub 账号已成功解除绑定");
      setConfirmUnbind(false);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除绑定失败");
    } finally {
      setLoading(false);
    }
  };

  const isBound = Boolean(currentGithubUsername || currentGithubId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="rounded-lg bg-purple-500/20 p-2 text-purple-300">
          <GitHubIcon className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">GitHub 账号绑定</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isBound ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-fg-40">当前已绑定 GitHub 账号</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-medium text-sm">
                  {currentGithubUsername ? `@${currentGithubUsername}` : "已关联 GitHub 账号"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> 已绑定
                </span>
              </div>
            </div>

            {confirmUnbind ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                <p className="text-xs text-red-300">
                  确定要解除与该 GitHub 账号的绑定吗？解绑后将无法使用该 GitHub 快捷登录。
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={loading}
                    onClick={() => void handleUnbind()}
                  >
                    {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    确认解绑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => setConfirmUnbind(false)}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setConfirmUnbind(true);
                }}
                className="gap-1.5 text-xs"
              >
                <Unlink className="h-3.5 w-3.5" />
                解除 GitHub 绑定
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-fg-40">未绑定 GitHub 账号</p>
              <p className="mt-1 text-sm text-fg-60">
                绑定 GitHub 账号后，您可以在登录页面直接使用 GitHub 账号一键快捷登录本账户。
              </p>
            </div>

            {githubEnabled === false && (
              <p className="text-xs text-amber-400/90">
                系统尚未配置 GitHub OAuth，请管理员前往「管理员配置」完成设置后再绑定。
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={loading || githubEnabled === false}
              onClick={() => void handleStartBind()}
              className="gap-2 text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitHubIcon className="h-4 w-4" />
              )}
              绑定 GitHub 账号
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}
      </CardContent>
    </Card>
  );
}
