import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "./prisma";
import { decryptJson, encryptJson } from "./crypto";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

const SMTP_SETTING_KEY = "smtp_config";

/**
 * Retrieve SMTP configuration from database or fallback to environment variables.
 */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SMTP_SETTING_KEY },
    });

    if (setting?.value) {
      const parsed = decryptJson<SmtpConfig | null>(setting.value, null);
      if (parsed?.host && parsed.port && parsed.user && parsed.pass && parsed.from) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Failed to read SMTP config from database:", error);
  }

  // Fallback to environment variables
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && port && user && pass && from) {
    return { host, port, secure, user, pass, from };
  }

  return null;
}

/**
 * Check whether email sending is configured.
 */
export async function isSmtpConfigured(): Promise<boolean> {
  const config = await getSmtpConfig();
  return Boolean(config);
}

/**
 * Save SMTP configuration to database (encrypted).
 */
export async function saveSmtpConfig(config: SmtpConfig): Promise<void> {
  const encrypted = encryptJson(config);
  await prisma.systemSetting.upsert({
    where: { key: SMTP_SETTING_KEY },
    update: { value: encrypted },
    create: { key: SMTP_SETTING_KEY, value: encrypted },
  });
}

function createTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

/**
 * Test SMTP connection and optionally send a test email.
 */
export async function testSmtpConnection(
  config: SmtpConfig,
  testRecipient?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();

    if (testRecipient) {
      await transporter.sendMail({
        from: config.from,
        to: testRecipient,
        subject: "【SubFuse】SMTP 邮件发送测试",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
            <h2 style="margin-top: 0; color: #111827; font-size: 20px;">SubFuse 邮件服务测试成功</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              您好！这是一封测试邮件，代表您的 SMTP 邮件发送配置已成功建立并能正常通信。
            </p>
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px;">
              发送时间：${new Date().toLocaleString("zh-CN")}
            </div>
          </div>
        `,
      });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP 连接或发送失败";
    return { success: false, error: message };
  }
}

const PURPOSE_TEXT_MAP: Record<string, string> = {
  login: "登录账号",
  register: "注册账号",
  github_bind: "绑定 GitHub 账号",
  reset_password: "重置密码",
  bind: "绑定邮箱",
};

/**
 * Send 6-digit verification code email.
 */
export async function sendVerificationCodeEmail(
  to: string,
  code: string,
  purpose: string
): Promise<{ success: boolean; error?: string }> {
  const config = await getSmtpConfig();
  if (!config) {
    return { success: false, error: "系统未配置 SMTP 邮件服务，无法发送验证码" };
  }

  const actionText = PURPOSE_TEXT_MAP[purpose] || "安全验证";

  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: config.from,
      to,
      subject: `【SubFuse】${code} 是您的${actionText}验证码`,
      html: `
        <div style="background-color: #f8fafc; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 32px 28px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">SubFuse</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 6px 0 0 0; font-size: 14px;">高性能多平台订阅转换与管理系统</p>
            </div>

            <div style="padding: 32px 28px;">
              <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0; line-height: 1.6;">
                您好！您正在进行 <strong>${actionText}</strong> 操作，本次验证码为：
              </p>

              <div style="margin: 28px 0; text-align: center;">
                <div style="display: inline-block; background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 16px 36px; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #166534; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                  ${code}
                </div>
              </div>

              <p style="font-size: 13px; color: #64748b; margin: 0 0 12px 0; line-height: 1.6;">
                • 验证码将在 <strong>10 分钟</strong> 内有效。<br />
                • 如果这不是您本人的操作，请忽略此邮件，您的账号信息依然安全。
              </p>
            </div>

            <div style="background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 18px 28px; text-align: center; font-size: 12px; color: #94a3b8;">
              此邮件由系统自动发出，请勿直接回复。
            </div>
          </div>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "邮件发送失败";
    return { success: false, error: message };
  }
}
