import { json } from "@local/lib/http";

export async function GET() {
  return json({ ok: true, service: "subfuse-local" });
}
