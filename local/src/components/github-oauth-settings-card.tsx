"use client";

import * as React from "react";
import { Check, CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@subfuse/ui/lib/utils";
import { Button } from "@subfuse/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subfuse/ui/components/ui/card";
import { FormField } from "@subfuse/ui/components/ui/form-field";
import { Input } from "@subfuse/ui/components/ui/input";
import { copyTextToClipboard } from "@subfuse/ui/lib/clipboard";

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

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function GitHubOAuthSettingsCard() {
  const [clientId, setClientId] = React.useState("");
  const [clientSecret, setClientSecret] = React.useState("");
  const [callbackUrl, setCallbackUrl] = React.useState("");
  const [defaultCallbackUrl, setDefaultCallbackUrl] = React.useState("");
  const [browserCallbackUrl, setBrowserCallbackUrl] = React.useState("");
  const [copiedCallback, setCopiedCallback] = React.useState(false);
  const [copiedHomepage, setCopiedHomepage] = React.useState(false);
  const [configured, setConfigured] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  React.useEffect(() => {
    const currentOriginCallback = `${window.location.origin}/api/auth/github/callback`;
    setBrowserCallbackUrl(currentOriginCallback);

    let cancelled = false;
    void fetch("/api/settings/github-oauth", { cache: "no-store" })
      .then((res) =>
        readJson<{
          configured: boolean;
          defaultCallbackUrl?: string;
          effectiveCallbackUrl?: string;
          config?: { clientId?: string; hasClientSecret?: boolean; callbackUrl?: string } | null;
        }>(res)
      )
      .then((data) => {
        if (cancelled) return;
        setConfigured(Boolean(data.configured));
        const fallbackUrl = data.defaultCallbackUrl || currentOriginCallback;
        setDefaultCallbackUrl(fallbackUrl);
        if (data.config) {
          setClientId(data.config.clientId || "");
          if (data.config.hasClientSecret) {
            setClientSecret("••••••••");
          }
          setCallbackUrl(data.config.callbackUrl || currentOriginCallback);
        } else {
          setCallbackUrl(currentOriginCallback);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCallbackUrl(currentOriginCallback);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const browserHomepageUrl = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const resolvedPreviewCallback = callbackUrl.trim() || defaultCallbackUrl || browserCallbackUrl;

  const handleCopyHomepage = async () => {
    if (!browserHomepageUrl) return;
    const copied = await copyTextToClipboard(browserHomepageUrl);
    if (!copied) return;
    setCopiedHomepage(true);
    setTimeout(() => setCopiedHomepage(false), 2000);
  };

  const handleCopyCallback = async () => {
    if (!resolvedPreviewCallback) return;
    const copied = await copyTextToClipboard(resolvedPreviewCallback);
    if (!copied) return;
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setSaving(true);
    try {
      const response = await fetch("/api/settings/github-oauth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, callbackUrl }),
      });
      const data = await readJson<{
        error?: string;
        message?: string;
        callbackUrl?: string;
        effectiveCallbackUrl?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error || "保存失败");
      if (typeof data.callbackUrl === "string" && data.callbackUrl) {
        setCallbackUrl(data.callbackUrl);
      }
      setConfigured(true);
      setNotice({ text: data.message || "GitHub OAuth 配置已保存" });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "保存失败", error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div
          className={cn(
            "rounded-lg p-2 transition-colors",
            configured
              ? "bg-purple-500/15 text-purple-600 dark:bg-purple-500/25 dark:text-purple-300 ring-1 ring-purple-500/30 shadow-sm shadow-purple-500/10"
              : "bg-zinc-500/10 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 ring-1 ring-zinc-500/10"
          )}
        >
          <GitHubIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">GitHub OAuth 登录配置</CardTitle>
            {!loading && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border",
                  configured
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20"
                )}
              >
                {configured ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    已配置
                  </>
                ) : (
                  "未配置"
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-fg-50 mt-0.5">
            配置系统级 GitHub OAuth 授权登录，允许用户使用 GitHub 账号一键快捷登录与绑定
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-ink/5" />
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* 设置引导 */}
            <div className="rounded-xl border border-ink/10 bg-ink/5 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <div>
                  <h4 className="text-xs font-semibold text-fg">设置引导</h4>
                  <p className="text-xs text-fg-50 mt-0.5">
                    启用登录前，请先在提供商应用中设置这些值。
                  </p>
                </div>
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 shrink-0"
                >
                  前往 GitHub Developer settings
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-2 pt-1 text-xs">
                {/* 主页 URL */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-surface p-3 border border-ink/5">
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-medium text-fg">主页 URL</span>
                    <p className="text-[11px] text-fg-50 font-mono select-all break-all">
                      {browserHomepageUrl || "https://your-domain.com"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyHomepage()}
                    disabled={!browserHomepageUrl}
                    className="shrink-0 h-8 gap-1.5 self-end sm:self-center"
                  >
                    {copiedHomepage ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        复制
                      </>
                    )}
                  </Button>
                </div>

                {/* 授权回调 URL */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-surface p-3 border border-ink/5">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <span className="font-medium text-fg">授权回调 URL</span>
                    <p className="text-[11px] text-fg-50 font-mono select-all break-all">
                      {resolvedPreviewCallback}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyCallback()}
                    disabled={!resolvedPreviewCallback}
                    className="shrink-0 h-8 gap-1.5 self-end sm:self-center"
                  >
                    {copiedCallback ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Client ID" required description="GitHub OAuth App 详情页中的 Client ID">
                <Input
                  placeholder="Ov23li..."
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </FormField>
              <FormField
                label="Client Secret"
                required
                description={clientSecret ? "已加密保存，如需更换可直接输入新密钥" : undefined}
              >
                <Input
                  type="password"
                  placeholder="您的 GitHub OAuth 客户端密钥"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </FormField>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-ink/10">
              {notice ? (
                <p className={`text-xs ${notice.error ? "text-red-400" : "text-emerald-400"}`}>
                  {notice.text}
                </p>
              ) : <div />}
              <Button type="submit" disabled={saving || !clientId} className="w-full sm:w-auto">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存 GitHub 设置
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
