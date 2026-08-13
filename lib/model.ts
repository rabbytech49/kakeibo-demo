// クライアント・サーバー共用の型と純粋関数(googleapisに依存しない)

export type EntryType = "入金" | "出金" | "チャージ";

export interface MeisaiLine {
  id: string;
  entryId: string;
  itemName: string;
  category: string;
  unitPrice: number;
  discount: number;
  quantity: number;
  memo: string;
}

export interface KakeiboEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: EntryType;
  chargeTo: string;
  payee: string;
  method: string;
  creditMonth: string;
  memo: string;
  lines: MeisaiLine[];
  total: number;
}

export interface LineInput {
  itemName: string;
  category: string;
  unitPrice: number;
  discount: number;
  quantity: number;
  memo: string;
}

export interface EntryInput {
  date: string;
  type: EntryType;
  chargeTo: string;
  payee: string;
  method: string;
  creditMonth: string;
  memo: string;
  lines: LineInput[];
}

export interface Masters {
  categories: string[];
  payees: string[];
  methods: string[];
}

/** 実額 = (単価 − 値引き) × 数量。値引きは1個あたりの額(仕様_画面の小計) */
export function lineTotal(l: {
  unitPrice: number;
  discount: number;
  quantity: number;
}): number {
  return (l.unitPrice - l.discount) * l.quantity;
}

/** チャージ先に選べる支払方法(仕様_画面: この4つのみ) */
export const CHARGE_DESTINATIONS = [
  "楽天ペイ",
  "モバイルスイカ",
  "ICOCA",
  "バーチャルカード",
] as const;

/** 支払方法マスタからチャージ先の選択肢を抽出(マスタ表記を正とする) */
export function chargeDestinationOptions(methods: string[]): string[] {
  const opts = methods.filter((m) =>
    (CHARGE_DESTINATIONS as readonly string[]).includes(m)
  );
  return opts.length > 0 ? opts : [...CHARGE_DESTINATIONS];
}

export function isCreditMethod(method: string): boolean {
  return method.startsWith("クレジット");
}

/** "2024/07"・"2024/7" → "2024/7"(シートのYYYY/M表記に正規化) */
export function normalizeYm(value: string): string {
  const m = String(value).trim().match(/^(\d{4})[/-](\d{1,2})$/);
  if (!m) return "";
  return `${m[1]}/${Number(m[2])}`;
}

/**
 * クレジット引落年月のデフォルト(仕様_画面)
 * - クレジット1: 事由発生日の翌月
 * - クレジット2: 発生日が1〜15日なら翌月、16日以降なら翌々月
 * @param date YYYY-MM-DD  @returns YYYY/M
 */
export function defaultCreditMonth(date: string, method: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !isCreditMethod(method)) return "";
  const [, y, mo, d] = m.map(Number);
  const offset = method === "クレジット2" && d >= 16 ? 2 : 1;
  const total = y * 12 + (mo - 1) + offset;
  return `${Math.floor(total / 12)}/${(total % 12) + 1}`;
}

/** 集計シートで扱うクレジット処理ステータスの選択肢(実データの表記に合わせる) */
export const CREDIT_STATUS_OPTIONS = [
  "金額確認済",
  "金額確認済 , 引落済",
] as const;
