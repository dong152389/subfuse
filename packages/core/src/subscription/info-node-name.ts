/**
 * Airport subscriptions often encode account metadata as proxy nodes. They
 * should remain visible in the main selection list, but must not be treated as
 * usable proxies for url-test, fallback, or routing policy groups.
 */
export type SubscriptionInfoCategory =
  | "remaining-traffic"
  | "used-traffic"
  | "total-traffic"
  | "expire-date"
  | "reset-date"
  | "balance"
  | "member"
  | "update-hint"
  | "notice";

const REMAINING_TRAFFIC_RE =
  /^(?:剩余(?:订阅|可用|套餐)?流量|(?:可用|套餐|订阅)?流量剩余|可用流量|套餐剩余|还剩(?:流量)?|剩余可用|剩余)(?:\s*[:：|\s-]\s*|\s*$)|\b(?:remaining\s+traffic|traffic\s+remaining|remaining|data\s+left)(?:\s*[:：|\s-]\s*|\s*$)/i;

const USED_TRAFFIC_RE =
  /^(?:(?:已用|已使用|累计已用|累计使用)流量|流量(?:已用|已使用)|累计已用|累计使用|已用)(?:\s*[:：|\s-]\s*|\s*$)|\b(?:used\s+traffic|traffic\s+used|used)(?:\s*[:：|\s-]\s*|\s*$)/i;

const TOTAL_TRAFFIC_RE =
  /^(?:(?:总|套餐|总可用)流量|流量(?:总量|上限)|总量)(?:\s*[:：|\s-]\s*|\s*$)|\b(?:total\s+traffic|traffic\s+total|total)(?:\s*[:：|\s-]\s*|\s*$)/i;

const EXPIRE_DATE_RE =
  /^(?:(?:套餐|订阅|服务|账号)?到期(?:时间|日)?|距离到期|过期时间|有效(?:期至?|时间)|账号有效期|还剩天数)(?:\s*[:：|\s-]\s*|\s*$)|\b(?:expire|expired|expiration|valid\s+until|valid\s+through)(?:\s*[:：|\s-]\s*|\s*$)/i;

const RESET_DATE_RE =
  /^(?:距离(?:下次)?重置(?:剩余|还剩|还有)?|下次重置|(?:流量)?重置(?:时间|日|周期)?|每月重置|结算日)(?:\s*[:：|\s-]\s*|\s*|\b)|\b(?:reset\s+in|reset\s+date|reset)(?:\s*[:：|\s-]\s*|\s*|\b)/i;

const BALANCE_RE =
  /^(?:账户)?余额|点数|积分(?:\s*[:：||\s-]\s*|\s*$)|\b(?:balance|credits|points)(?:\s*[:：||\s-]\s*|\s*$)/i;

const MEMBER_RE =
  /^(?:(?:会员|用户)?等级|会员)(?:\s*[:：||\s-]\s*|\s*$)|\b(?:vip|member|level)(?:\s*[:：||\s-]\s*|\s*$)/i;

const UPDATE_HINT_RE =
  /(?:版本太旧|请更新|更新软件|去官网更新|客户端更新|update\s+client)/i;

const NOTICE_RE =
  /^(?:(?:官方)?(?:网站|网址)|最新网址|官网|通知|公告|发布页|防失联|telegram|tg(?:群|频道)?|电报(?:群|频道)?|官方(?:tg|telegram|电报)?(?:群|频道)|客服|使用须知|禁止bt)(?:\s*[:：|\s-]\s*|\s*$)|\b(?:notice|announcement|website|channel)\b/i;

export function stripLeadingDecorations(text: string): string {
  let current = text.trim();
  let changed = true;
  while (changed && current.length > 0) {
    const before = current;
    current = current
      .replace(/^[^\p{L}\p{N}\[\]【】()（）<>〔〕「」『』]+/u, "")
      .trim();
    current = current
      .replace(
        /^(?:\[[^\]]*\]|【[^】]*】|\([^)]*\)|（[^）]*）|<[^>]*>|〔[^〕]*〕|「[^」]*」|『[^』]*』)\s*/u,
        ""
      )
      .trim();
    current = current.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    changed = current !== before;
  }
  return current;
}

export function stripLeadingTag(text: string): string {
  return stripLeadingDecorations(text);
}

export function isDummyServer(server: unknown): boolean {
  if (typeof server !== "string") return false;
  const raw = server.trim().toLowerCase().replace(/\.$/, "");
  return (
    raw === "127.0.0.1" ||
    raw === "localhost" ||
    raw === "0.0.0.0" ||
    raw === "::1" ||
    raw === "[::1]" ||
    raw === "198.18.0.1" ||
    raw === "10.0.0.1" ||
    raw === "example.com" ||
    raw === "null" ||
    raw === ""
  );
}

export function buildDynamicNodeFingerprint(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const stripped = stripLeadingDecorations(trimmed);
  if (!stripped) return null;

  const withDates = stripped.replace(
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?\b/g,
    "<date>"
  );
  const withNums = withDates.replace(
    /\b\d+(?:\.\d+)?\s*(?:[kmgtpe]?b|%|天|小时|点|元|次|人|日|days?|hours?|mins?|secs?)?\b/gi,
    "<num>"
  );

  return withNums
    .replace(/[:：|\-_/]+/g, ":")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function isDynamicFingerprintEligible(node?: {
  name?: unknown;
  server?: unknown;
  port?: unknown;
}): boolean {
  if (!node) return false;
  const name = typeof node.name === "string" ? node.name : "";
  if (isSubscriptionInfoNodeName(name)) return true;
  if (isDummyServer(node.server)) return true;
  const port = typeof node.port === "number" ? node.port : Number(node.port);
  if (Number.isFinite(port) && port <= 1) return true;
  return false;
}

export function getSubscriptionInfoNodeCategory(name: unknown): SubscriptionInfoCategory | null {
  if (typeof name !== "string") return null;
  const raw = name.trim();
  if (!raw) return null;

  const candidates = [raw];
  const stripped = stripLeadingDecorations(raw);
  if (stripped && stripped !== raw) {
    candidates.push(stripped);
  }

  for (const text of candidates) {
    if (REMAINING_TRAFFIC_RE.test(text)) return "remaining-traffic";
    if (USED_TRAFFIC_RE.test(text)) return "used-traffic";
    if (TOTAL_TRAFFIC_RE.test(text)) return "total-traffic";
    if (EXPIRE_DATE_RE.test(text)) return "expire-date";
    if (RESET_DATE_RE.test(text)) return "reset-date";
    if (BALANCE_RE.test(text)) return "balance";
    if (MEMBER_RE.test(text)) return "member";
    if (UPDATE_HINT_RE.test(text)) return "update-hint";
    if (NOTICE_RE.test(text)) return "notice";
  }

  return null;
}

export function isSubscriptionInfoNodeName(name: string): boolean {
  return getSubscriptionInfoNodeCategory(name) !== null;
}
