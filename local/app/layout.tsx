import type { Metadata } from "next";
import "@subfuse/ui/styles/globals.css";
import { Footer } from "@subfuse/ui/components/layout/footer";
import { MobileNav } from "@subfuse/ui/components/layout/mobile-nav";
import { ScrollLockStabilizer } from "@subfuse/ui/components/layout/scroll-lock-stabilizer";
import { ConfirmDialogHost } from "@subfuse/ui/components/ui/confirm-dialog";
import { Toaster } from "@subfuse/ui/components/ui/toaster";
import { THEME_INIT_SCRIPT } from "@subfuse/ui/theme/theme-init-script";
import { LocalHeader } from "@local/components/local-header";
import { resolveAppVersionInfo } from "@subfuse/server-core/app-version";
import {
  SUBFUSE_FAVICON_PATH,
  SUBFUSE_ICON_PATH,
  SUBFUSE_KEYWORDS,
  SUBFUSE_PRODUCT_DESCRIPTION,
  SUBFUSE_PRODUCT_TITLE,
  SUBFUSE_SITE_NAME,
  SUBFUSE_THEME_COLOR,
} from "@subfuse/ui/brand";

export const metadata: Metadata = {
  title: {
    default: SUBFUSE_PRODUCT_TITLE,
    template: `%s | ${SUBFUSE_SITE_NAME}`,
  },
  description: SUBFUSE_PRODUCT_DESCRIPTION,
  keywords: SUBFUSE_KEYWORDS,
  authors: [{ name: SUBFUSE_SITE_NAME }],
  creator: SUBFUSE_SITE_NAME,
  publisher: SUBFUSE_SITE_NAME,
  icons: {
    icon: SUBFUSE_ICON_PATH,
    shortcut: SUBFUSE_FAVICON_PATH,
    apple: SUBFUSE_ICON_PATH,
  },
};

export const viewport = {
  themeColor: SUBFUSE_THEME_COLOR,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { buildVersion } = resolveAppVersionInfo({ env: process.env, cwd: process.cwd() });

  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <ScrollLockStabilizer />
        <div className="min-h-screen bg-gradient-radial flex flex-col">
          <LocalHeader />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <Footer mode="local" buildVersion={buildVersion} />
          <MobileNav mode="local" />
        </div>
        <Toaster />
        <ConfirmDialogHost />
      </body>
    </html>
  );
}
