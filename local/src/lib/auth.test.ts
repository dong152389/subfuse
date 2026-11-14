import { describe, expect, it } from "vitest";
import {
  ADMIN_USER_QUOTA,
  DEFAULT_USER_QUOTA,
  VIP_USER_QUOTA,
  resolveUserQuota,
} from "./auth";

describe("resolveUserQuota", () => {
  it("returns DEFAULT_USER_QUOTA for regular non-VIP user without overrides", () => {
    const quota = resolveUserQuota(null, false);
    expect(quota).toEqual(DEFAULT_USER_QUOTA);
  });

  it("returns VIP_USER_QUOTA for active VIP user without overrides", () => {
    const quota = resolveUserQuota(
      { isVip: true, vipExpiresAt: new Date(Date.now() + 86400000) },
      false
    );
    expect(quota).toEqual(VIP_USER_QUOTA);
  });

  it("falls back to DEFAULT_USER_QUOTA when VIP has expired", () => {
    const quota = resolveUserQuota(
      { isVip: true, vipExpiresAt: new Date(Date.now() - 86400000) },
      false
    );
    expect(quota).toEqual(DEFAULT_USER_QUOTA);
  });

  it("returns ADMIN_USER_QUOTA for system administrator without overrides", () => {
    const quota = resolveUserQuota(null, true);
    expect(quota).toEqual(ADMIN_USER_QUOTA);
  });

  it("applies custom subscription, template, and node overrides for normal user", () => {
    const quota = resolveUserQuota(
      {
        isVip: false,
        maxSubscriptions: 5,
        maxCustomTemplates: 3,
        maxNodesPerSubscription: 500,
      },
      false
    );
    expect(quota).toEqual({
      ...DEFAULT_USER_QUOTA,
      maxSubscriptions: 5,
      maxCustomTemplates: 3,
      maxNodesPerSubscription: 500,
    });
  });

  it("applies custom quota overrides for VIP user", () => {
    const quota = resolveUserQuota(
      {
        isVip: true,
        vipExpiresAt: null,
        maxSubscriptions: 100,
        maxNodesPerSubscription: 5000,
      },
      false
    );
    expect(quota).toEqual({
      ...VIP_USER_QUOTA,
      maxSubscriptions: 100,
      maxNodesPerSubscription: 5000,
    });
  });

  it("allows setting 0 for quotas", () => {
    const quota = resolveUserQuota(
      {
        isVip: true,
        maxSubscriptions: 0,
        maxCustomTemplates: 0,
        maxNodesPerSubscription: 0,
      },
      false
    );
    expect(quota.maxSubscriptions).toBe(0);
    expect(quota.maxCustomTemplates).toBe(0);
    expect(quota.maxNodesPerSubscription).toBe(0);
  });

  it("ignores negative or null values and preserves base quota", () => {
    const quota = resolveUserQuota(
      {
        isVip: false,
        maxSubscriptions: -1,
        maxCustomTemplates: null,
      },
      false
    );
    expect(quota.maxSubscriptions).toBe(DEFAULT_USER_QUOTA.maxSubscriptions);
    expect(quota.maxCustomTemplates).toBe(DEFAULT_USER_QUOTA.maxCustomTemplates);
  });
});
