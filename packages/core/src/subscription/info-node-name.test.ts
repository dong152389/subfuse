import { describe, expect, it } from "vitest";
import {
  buildDynamicNodeFingerprint,
  getSubscriptionInfoNodeCategory,
  isDummyServer,
  isDynamicFingerprintEligible,
  isSubscriptionInfoNodeName,
  stripLeadingDecorations,
  stripLeadingTag,
} from "./info-node-name";

describe("info-node-name classification", () => {
  it("strips leading tags and emojis properly", () => {
    expect(stripLeadingTag("[Airport] 剩余流量: 8273.38 GB")).toBe("剩余流量: 8273.38 GB");
    expect(stripLeadingTag("【机场】套餐到期: 长期有效")).toBe("套餐到期: 长期有效");
    expect(stripLeadingTag("(Tag) 官网: abc.com")).toBe("官网: abc.com");
    expect(stripLeadingTag("Plain Node")).toBe("Plain Node");
    expect(stripLeadingDecorations("📊 剩余流量: 8273.38 GB")).toBe("剩余流量: 8273.38 GB");
    expect(stripLeadingDecorations("⚡️【提示】流量剩余: 100 GB")).toBe("流量剩余: 100 GB");
    expect(stripLeadingDecorations("● 距离下次重置还有 3 天")).toBe("距离下次重置还有 3 天");
  });

  it("identifies remaining traffic nodes across formatting and emoji variants", () => {
    expect(getSubscriptionInfoNodeCategory("剩余流量: 8273.38 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("剩余流量: 8270.54 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("剩余流量：8273.38 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("剩余流量 8273.38 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("剩余流量-8273.38GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("剩余订阅流量: 50 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("剩余可用: 100 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("剩余: 10 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("[TAG] 剩余流量: 8273.38 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("Remaining Traffic: 10 GB")).toBe("remaining-traffic");
    // Emoji & inverted word orders
    expect(getSubscriptionInfoNodeCategory("📊 剩余流量: 8273.38 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("流量剩余: 500 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("可用流量: 500 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("套餐剩余: 500 GB")).toBe("remaining-traffic");
    expect(getSubscriptionInfoNodeCategory("⚡️ 流量剩余 100GB")).toBe("remaining-traffic");
  });

  it("identifies expire date nodes across formatting variants", () => {
    expect(getSubscriptionInfoNodeCategory("套餐到期: 长期有效")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("套餐到期: 2026-11-20")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("到期时间: 2026-12-31")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("订阅到期: 2026-12-31")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("过期时间: 2026-12-31")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("Expire: 2026-12-31")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("有效期至: 2026-12-31")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("距离到期: 15天")).toBe("expire-date");
    expect(getSubscriptionInfoNodeCategory("🕒 套餐到期: 2026-12-31")).toBe("expire-date");
  });

  it("identifies reset date nodes", () => {
    expect(getSubscriptionInfoNodeCategory("距离下次重置剩余: 5天")).toBe("reset-date");
    expect(getSubscriptionInfoNodeCategory("距离重置: 5天")).toBe("reset-date");
    expect(getSubscriptionInfoNodeCategory("重置日: 1号")).toBe("reset-date");
    expect(getSubscriptionInfoNodeCategory("流量重置日: 1号")).toBe("reset-date");
    expect(getSubscriptionInfoNodeCategory("结算日: 1号")).toBe("reset-date");
    expect(getSubscriptionInfoNodeCategory("Reset: 5 days")).toBe("reset-date");
    expect(getSubscriptionInfoNodeCategory("🔄 距离重置还剩 3 天")).toBe("reset-date");
  });

  it("identifies used and total traffic nodes", () => {
    expect(getSubscriptionInfoNodeCategory("已用流量: 10 GB")).toBe("used-traffic");
    expect(getSubscriptionInfoNodeCategory("流量已用: 10 GB")).toBe("used-traffic");
    expect(getSubscriptionInfoNodeCategory("累计已用: 10 GB")).toBe("used-traffic");
    expect(getSubscriptionInfoNodeCategory("总流量: 100 GB")).toBe("total-traffic");
    expect(getSubscriptionInfoNodeCategory("套餐流量: 100 GB")).toBe("total-traffic");
  });

  it("identifies notice, update hint, balance and member nodes", () => {
    expect(getSubscriptionInfoNodeCategory("官网: https://sub.example.com")).toBe("notice");
    expect(getSubscriptionInfoNodeCategory("最新网址: sub.example.com")).toBe("notice");
    expect(getSubscriptionInfoNodeCategory("📢 官方TG群: t.me/airport")).toBe("notice");
    expect(getSubscriptionInfoNodeCategory("版本太旧请更新")).toBe("update-hint");
    expect(getSubscriptionInfoNodeCategory("余额 | 100元")).toBe("balance");
    expect(getSubscriptionInfoNodeCategory("会员 | VIP")).toBe("member");
  });

  it("does not classify regular proxy nodes as info nodes", () => {
    expect(getSubscriptionInfoNodeCategory("us-Standard|美国|流媒体|高速|01")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("vl-reality-racknerd-aaaa0bd")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("vm-ws-racknerd-aaaa0bd")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("hy2-racknerd-aaaa0bd")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("tu5-racknerd-aaaa0bd")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("anytls-racknerd-aaaa0bd")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("🇭🇰 香港 01 [IEPL 高速]")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("SOCKS-same.example.com:1080")).toBeNull();
    expect(getSubscriptionInfoNodeCategory("")).toBeNull();
    expect(getSubscriptionInfoNodeCategory(null)).toBeNull();
    expect(getSubscriptionInfoNodeCategory(undefined)).toBeNull();
  });

  it("isSubscriptionInfoNodeName boolean check matches category availability", () => {
    expect(isSubscriptionInfoNodeName("剩余流量: 8273.38 GB")).toBe(true);
    expect(isSubscriptionInfoNodeName("套餐到期: 长期有效")).toBe(true);
    expect(isSubscriptionInfoNodeName("us-Standard|美国|流媒体|高速|01")).toBe(false);
  });

  it("builds dynamic fingerprints for arbitrary dynamic info nodes", () => {
    const fp1 = buildDynamicNodeFingerprint("剩余流量: 8270.54 GB");
    const fp2 = buildDynamicNodeFingerprint("📊 剩余流量: 8273.38 GB");
    expect(fp1).toBe(fp2);

    const fp3 = buildDynamicNodeFingerprint("🐶 狗狗积分: 1500 点");
    const fp4 = buildDynamicNodeFingerprint("🐶 狗狗积分: 1420 点");
    expect(fp3).toBe(fp4);
    expect(fp3).toBe("狗狗积分:<num>点");

    const fp5 = buildDynamicNodeFingerprint("到期时间: 2026-11-19");
    const fp6 = buildDynamicNodeFingerprint("到期时间: 2026-11-20");
    expect(fp5).toBe(fp6);
    expect(fp5).toBe("到期时间:<date>");
  });

  it("checks eligibility for dynamic fingerprint matching correctly", () => {
    expect(isDummyServer("127.0.0.1")).toBe(true);
    expect(isDummyServer("localhost")).toBe(true);
    expect(isDummyServer("0.0.0.0")).toBe(true);
    expect(isDummyServer("us.racknerd.com")).toBe(false);

    // Dummy proxy node with arbitrary custom name qualifies
    expect(isDynamicFingerprintEligible({ name: "自定义提示: 100", server: "127.0.0.1", port: 10000 })).toBe(true);

    // Standard info node qualifies even if server is external
    expect(isDynamicFingerprintEligible({ name: "剩余流量: 100GB", server: "node.com", port: 443 })).toBe(true);

    // Regular proxy nodes DO NOT qualify
    expect(isDynamicFingerprintEligible({ name: "US 01", server: "us.node.com", port: 443 })).toBe(false);
    expect(isDynamicFingerprintEligible({ name: "香港 02", server: "hk.node.com", port: 443 })).toBe(false);
  });
});
