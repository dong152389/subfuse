import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEmailWhitelistSuffixes,
  isEmailWhitelisted,
  normalizeWhitelistSuffixes,
} from "./email-service";

const mocks = vi.hoisted(() => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  decryptJson: vi.fn(),
  encryptJson: vi.fn(() => "encrypted-value"),
}));

vi.mock("./prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("./crypto", () => ({
  decryptJson: mocks.decryptJson,
  encryptJson: mocks.encryptJson,
}));

describe("normalizeWhitelistSuffixes", () => {
  it("normalizes and deduplicates suffixes", () => {
    const raw = ["@gmail.com", "COMPANY.COM", "  @school.edu.cn  ", "@@corp.net", "@gmail.com", ""];
    const normalized = normalizeWhitelistSuffixes(raw);
    expect(normalized).toEqual(["@gmail.com", "@company.com", "@school.edu.cn", "@corp.net"]);
  });

  it("handles empty array", () => {
    expect(normalizeWhitelistSuffixes([])).toEqual([]);
  });
});

describe("getEmailWhitelistSuffixes & isEmailWhitelisted", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.systemSetting.findUnique.mockResolvedValue(null);
    mocks.decryptJson.mockReturnValue(null);
    process.env = { ...originalEnv };
    delete process.env.EMAIL_WHITELIST_SUFFIXES;
    delete process.env.SMTP_EMAIL_WHITELIST;
    delete process.env.SMTP_HOST;
  });

  it("allows all emails when no whitelist is configured", async () => {
    mocks.prisma.systemSetting.findUnique.mockResolvedValueOnce(null);

    const suffixes = await getEmailWhitelistSuffixes();
    expect(suffixes).toEqual([]);

    const result = await isEmailWhitelisted("user@example.com");
    expect(result.allowed).toBe(true);
    expect(result.suffixes).toEqual([]);
  });

  it("returns suffixes from database config and checks whitelist properly", async () => {
    mocks.prisma.systemSetting.findUnique.mockResolvedValue({
      value: "encrypted-smtp-config",
    });
    mocks.decryptJson.mockReturnValue({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "notify@example.com",
      pass: "secret",
      from: "SubFuse <notify@example.com>",
      emailWhitelistSuffixes: ["@company.com", "sub.corp.org"],
    });

    const suffixes = await getEmailWhitelistSuffixes();
    expect(suffixes).toEqual(["@company.com", "@sub.corp.org"]);

    // Matches @company.com (case insensitive)
    const res1 = await isEmailWhitelisted("Alice@Company.com");
    expect(res1.allowed).toBe(true);

    // Matches @sub.corp.org
    const res2 = await isEmailWhitelisted("bob@sub.corp.org");
    expect(res2.allowed).toBe(true);

    // Does not match - suffix boundary check (e.g. evilcompany.com shouldn't match company.com)
    const res3 = await isEmailWhitelisted("eve@evilcompany.com");
    expect(res3.allowed).toBe(false);

    // Random non-whitelisted email
    const res4 = await isEmailWhitelisted("charlie@gmail.com");
    expect(res4.allowed).toBe(false);
  });

  it("falls back to EMAIL_WHITELIST_SUFFIXES environment variable when database is empty", async () => {
    mocks.prisma.systemSetting.findUnique.mockResolvedValueOnce(null);
    process.env.EMAIL_WHITELIST_SUFFIXES = "@acme.inc, @corp.io";

    const suffixes = await getEmailWhitelistSuffixes();
    expect(suffixes).toEqual(["@acme.inc", "@corp.io"]);

    const res1 = await isEmailWhitelisted("dev@acme.inc");
    expect(res1.allowed).toBe(true);

    const res2 = await isEmailWhitelisted("dev@other.com");
    expect(res2.allowed).toBe(false);
  });
});
