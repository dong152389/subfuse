import { SUBFUSE_ICON_PATH } from "@subfuse/ui/brand";

export function createSubFuseFaviconRedirect(): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: SUBFUSE_ICON_PATH,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
