import { describe, expect, it } from "vitest";
import { SUBFUSE_ICON_PATH } from "./brand";
import { createSubFuseFaviconRedirect } from "./brand-favicon";

describe("SubFuse favicon redirect", () => {
  it("redirects favicon requests to the public app icon", () => {
    const response = createSubFuseFaviconRedirect();

    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(SUBFUSE_ICON_PATH);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
  });
});
