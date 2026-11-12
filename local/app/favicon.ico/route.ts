import { createSubFuseFaviconRedirect } from "@subfuse/ui/brand-favicon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return createSubFuseFaviconRedirect();
}
