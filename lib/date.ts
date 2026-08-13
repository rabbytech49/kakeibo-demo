// JST基準の日付ヘルパー(サーバーはUTCで動く前提)

/** 今日の日付を YYYY-MM-DD で返す */
export function todayJST(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
    new Date()
  );
}

/** 今月を YYYY-MM で返す */
export function currentMonthJST(): string {
  return todayJST().slice(0, 7);
}

/** YYYY-MM に delta ヶ月を加算 */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** "2026-07" → "2026年7月" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export function isValidMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-07-08" → "7月8日(火)"。曜日はUTCで算出しTZずれを防ぐ */
export function formatDayHeader(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}月${d}日(${wd})`;
}
