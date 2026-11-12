import { NextResponse } from "next/server";
import { buildApiErrorBody } from "@subfuse/server-core/http";
import type { ReadJsonBodyResult } from "@subfuse/server-core/http";
export { readJsonBody, type ReadJsonBodyResult } from "@subfuse/server-core/http";

export type LocalApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export const LOCAL_JSON_BODY_LIMITS = {
  small: 64 * 1024,
  subscription: 16 * 1024 * 1024,
  template: 4 * 1024 * 1024,
} as const;

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(error: string, code: LocalApiErrorCode, status: number): NextResponse {
  return NextResponse.json(buildApiErrorBody(error, code), { status });
}

export function jsonBodyError(
  result: Extract<ReadJsonBodyResult, { ok: false }>,
  invalidJsonMessage = "Invalid JSON body."
): NextResponse {
  return result.reason === "too_large"
    ? apiError("Request body is too large.", "PAYLOAD_TOO_LARGE", 413)
    : apiError(invalidJsonMessage, "BAD_REQUEST", 400);
}

export function getStringField(body: unknown, key: string): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function getBooleanField(body: unknown, key: string): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : false;
}

export function getNumberField(body: unknown, key: string): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return !Number.isNaN(parsed) ? parsed : null;
  }
  return null;
}
