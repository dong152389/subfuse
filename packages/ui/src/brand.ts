export const SUBFUSE_SITE_NAME = "SubFuse";

export const SUBFUSE_PRODUCT_TITLE = "SubFuse - Clash 订阅转换与管理服务";

export const SUBFUSE_PRODUCT_DESCRIPTION =
  "Clash 订阅转换、生成与管理工具，支持链式代理、智能分流、多协议和多订阅聚合。";

export const SUBFUSE_FOOTER_DESCRIPTION =
  "Clash 订阅转换、生成和管理工具，让配置更简单";

export const SUBFUSE_THEME_COLOR = "#1e1b4b";

export const SUBFUSE_ICON_PATH = "/icon.png";

export const SUBFUSE_FAVICON_PATH = "/favicon.ico";

export const SUBFUSE_KEYWORDS = [
  "Clash",
  "订阅转换",
  "订阅生成",
  "订阅管理",
  "链式代理",
  "智能分流",
  "订阅聚合",
  "代理配置",
  "SubFuse",
  "Clash 配置",
  "多订阅管理",
];

export const SUBFUSE_MANIFEST_CATEGORIES = ["utilities", "productivity"];

export type SubFuseManifest = {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  orientation: "portrait-primary";
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose: "any" | "maskable";
  }>;
  categories: string[];
  lang: string;
};

export function createSubFuseManifest(): SubFuseManifest {
  return {
    name: SUBFUSE_PRODUCT_TITLE,
    short_name: SUBFUSE_SITE_NAME,
    description: SUBFUSE_PRODUCT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0f0d1a",
    theme_color: SUBFUSE_THEME_COLOR,
    orientation: "portrait-primary",
    icons: [
      {
        src: SUBFUSE_ICON_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: SUBFUSE_ICON_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: [...SUBFUSE_MANIFEST_CATEGORIES],
    lang: "zh-CN",
  };
}
