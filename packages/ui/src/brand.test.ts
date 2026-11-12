import { describe, expect, it } from "vitest";
import {
  createSubFuseManifest,
  SUBFUSE_FAVICON_PATH,
  SUBFUSE_FOOTER_DESCRIPTION,
  SUBFUSE_ICON_PATH,
  SUBFUSE_KEYWORDS,
  SUBFUSE_MANIFEST_CATEGORIES,
  SUBFUSE_PRODUCT_DESCRIPTION,
  SUBFUSE_PRODUCT_TITLE,
  SUBFUSE_SITE_NAME,
  SUBFUSE_THEME_COLOR,
} from "./brand";

describe("SubFuse brand constants", () => {
  it("exposes public product metadata", () => {
    expect(SUBFUSE_SITE_NAME).toBe("SubFuse");
    expect(SUBFUSE_PRODUCT_TITLE).toContain("SubFuse");
    expect(SUBFUSE_PRODUCT_DESCRIPTION).toContain("Clash");
    expect(SUBFUSE_FOOTER_DESCRIPTION).toContain("配置");
    expect(SUBFUSE_THEME_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
    expect(SUBFUSE_ICON_PATH).toBe("/icon.png");
    expect(SUBFUSE_FAVICON_PATH).toBe("/favicon.ico");
    expect(SUBFUSE_KEYWORDS).toContain("订阅转换");
    expect(SUBFUSE_MANIFEST_CATEGORIES).toEqual(["utilities", "productivity"]);
  });

  it("builds the shared app manifest", () => {
    expect(createSubFuseManifest()).toEqual({
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
      categories: ["utilities", "productivity"],
      lang: "zh-CN",
    });
  });
});
