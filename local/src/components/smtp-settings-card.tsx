"use client";

import * as React from "react";
import { Mail, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@subfuse/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subfuse/ui/components/ui/card";
import { FormField } from "@subfuse/ui/components/ui/form-field";
import { Input } from "@subfuse/ui/components/ui/input";
import { SwitchField } from "@subfuse/ui/components/ui/switch-field";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function SmtpSettingsCard() {
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState(465);
  const [secure, setSecure] = React.useState(true);
  const [user, setUser] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testRecipient, setTestRecipient] = React.useState("");
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/smtp", { cache: "no-store" })
      .then((res) => readJson<{ configured: boolean; config?: any }>(res))
      .then((data) => {
        if (!cancelled && data.config) {
          setHost(data.config.host || "");
          setPort(data.config.port || 465);
          setSecure(Boolean(data.config.secure));
          setUser(data.config.user || "");
          setPass(data.config.pass || "");
          setFrom(data.config.from || "");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setSaving(true);
    try {
      const response = await fetch("/api/settings/smtp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, secure, user, pass, from }),
      });
      const data = await readJson<{ error?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.error || "保存失败");
      setNotice({ text: data.message || "SMTP 设置保存成功" });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "保存失败", error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setNotice(null);
    setTesting(true);
    try {
      const response = await fetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port,
          secure,
          user,
          pass,
          from,
          testRecipient: testRecipient.trim() || undefined,
        }),
      });
      const data = await readJson<{ error?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.error || "测试连接失败");
      setNotice({ text: data.message || "SMTP 连接测试成功" });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "测试失败", error: true });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="rounded-lg bg-blue-500/20 p-2 text-blue-300">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-base">SMTP 邮件服务配置</CardTitle>
          <p className="text-xs text-fg-50 mt-0.5">
            配置发信服务器以启用验证码登录、用户注册邮箱校验和密码找回
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-ink/5" />
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="SMTP 服务器地址" required>
                <Input
                  placeholder="smtp.example.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                />
              </FormField>
              <FormField label="端口" required>
                <Input
                  type="number"
                  placeholder="465"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value, 10) || 465)}
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="发信账号 / 用户名" required>
                <Input
                  placeholder="notify@example.com"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />
              </FormField>
              <FormField label="密码 / 授权码" required>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 items-center">
              <FormField label="发件人显示地址 (From)">
                <Input
                  placeholder="SubFuse &lt;noreply@example.com&gt;"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </FormField>
              <div className="pt-2">
                <SwitchField
                  label="使用 SSL/TLS 加密"
                  description="默认 465 端口开启，587/25 端口建议关闭"
                  checked={secure}
                  onCheckedChange={setSecure}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-ink/10 flex flex-col sm:flex-row gap-3 items-end justify-between">
              <div className="w-full sm:max-w-xs flex gap-2">
                <Input
                  type="email"
                  placeholder="输入测试收件邮箱"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={testing || !host || !user}
                  onClick={() => void handleTest()}
                  className="gap-1.5 shrink-0"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  测试连接
                </Button>
              </div>

              <Button type="submit" disabled={saving || !host || !user} className="w-full sm:w-auto">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存 SMTP 设置
              </Button>
            </div>

            {notice && (
              <p className={`text-xs ${notice.error ? "text-red-400" : "text-emerald-400"}`}>
                {notice.text}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
