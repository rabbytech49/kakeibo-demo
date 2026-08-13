import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  listEntries,
  getEntryWithMasters,
  getMasters,
  listEntriesWithCreditStatuses,
  lineTotal,
  isCreditMethod,
  normalizeYm,
  type KakeiboEntry,
  type Masters,
  type MeisaiLine,
} from "@/lib/store";
import { todayJST } from "@/lib/date";

/**
 * セッションを検証し、未認証なら/loginへ。
 * cache(): 同一リクエスト内で複数のデータ関数が呼んでも auth() が1回で済む
 */
export const requireSession = cache(async (): Promise<void> => {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
});

export async function getEntries(month?: string): Promise<KakeiboEntry[]> {
  await requireSession();
  return listEntries(month);
}

/** 編集ページ用: 記録とマスタをまとめて取得 */
export async function getEntryAndMasters(
  id: string
): Promise<{ entry: KakeiboEntry | null; masters: Masters }> {
  await requireSession();
  return getEntryWithMasters(id);
}

export async function getAllMasters(): Promise<Masters> {
  await requireSession();
  return getMasters();
}

export interface CategorySummary {
  category: string;
  amount: number;
}

export interface MonthlySummary {
  income: number;
  expense: number;
  charge: number; // チャージは資金移動なので収支には含めない(参考表示)
  balance: number;
  expenseByCategory: CategorySummary[];
}

export async function getMonthlySummary(month: string): Promise<MonthlySummary> {
  const entries = await getEntries(month);
  let income = 0;
  let expense = 0;
  let charge = 0;
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    if (e.type === "入金") {
      income += e.total;
    } else if (e.type === "チャージ") {
      charge += e.total;
    } else {
      expense += e.total;
      for (const l of e.lines) {
        const key = l.category || "未分類";
        byCategory.set(key, (byCategory.get(key) ?? 0) + lineTotal(l));
      }
    }
  }
  const expenseByCategory = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  return { income, expense, charge, balance: income - expense, expenseByCategory };
}

// ============================================================
// 残高(仕様_画面: 現金とIKOCCAを明細全件から計算)
// ============================================================

export interface WalletBalance {
  name: string;
  amount: number;
}

export interface BalanceSummary {
  asOf: string; // YYYY-MM-DD(JST)
  wallets: WalletBalance[];
}

/**
 * 現金: 入金(+) / 支払方法=現金の出金・チャージ(−)
 * IKOCCA: チャージ先=IKOCCAのチャージ(+) / 支払方法=IKOCCAの出金(−)
 * ※初期残高は備考「繰越」の入金・チャージレコードが起点(通常レコードと同じ扱いで加算される)
 */
export async function getBalances(): Promise<BalanceSummary> {
  const entries = await getEntries();
  let cash = 0;
  let ikocca = 0;
  for (const e of entries) {
    if (e.type === "入金") {
      cash += e.total;
    } else if (e.type === "出金") {
      if (e.method === "現金") cash -= e.total;
      if (e.method === "IKOCCA") ikocca -= e.total;
    } else {
      // チャージ: チャージ先に加算し、原資が現金なら現金から減算
      if (e.method === "現金") cash -= e.total;
      if (e.chargeTo === "IKOCCA") ikocca += e.total;
    }
  }
  return {
    asOf: todayJST(),
    wallets: [
      { name: "現金", amount: cash },
      { name: "IKOCCA", amount: ikocca },
    ],
  };
}

// ============================================================
// クレジット支払額(引落年月ごとのカード別使用額+処理ステータス)
// ============================================================

export interface CreditMonthSummary {
  ym: string; // YYYY/M
  amounts: Record<string, number>; // 支払方法名 → 使用額
  statuses: string[]; // [クレジット1のステータス, クレジット2の…]
}

export interface CreditSummary {
  cards: string[]; // 出現したクレジット系支払方法(名前順)
  months: CreditMonthSummary[]; // 年月降順
}

export async function getCreditSummary(): Promise<CreditSummary> {
  await requireSession();
  const { entries, statusRecords } = await listEntriesWithCreditStatuses();
  const statusByYm = new Map(statusRecords.map((r) => [r.ym, r.statuses]));
  const byYm = new Map<string, Record<string, number>>();
  const cards = new Set<string>();
  for (const e of entries) {
    if (e.type === "入金" || !isCreditMethod(e.method)) continue;
    const ym = normalizeYm(e.creditMonth);
    if (!ym) continue;
    cards.add(e.method);
    const amounts = byYm.get(ym) ?? {};
    amounts[e.method] = (amounts[e.method] ?? 0) + e.total;
    byYm.set(ym, amounts);
  }
  // ステータスだけ登録済みの年月も一覧に含める
  for (const r of statusRecords) {
    if (r.statuses.some(Boolean) && !byYm.has(r.ym)) byYm.set(r.ym, {});
  }
  const ymKey = (ym: string) => {
    const [y, m] = ym.split("/").map(Number);
    return y * 12 + m;
  };
  const months = [...byYm.entries()]
    .map(([ym, amounts]) => ({
      ym,
      amounts,
      statuses: statusByYm.get(ym) ?? [],
    }))
    .sort((a, b) => ymKey(b.ym) - ymKey(a.ym));
  return { cards: [...cards].sort(), months };
}

// ============================================================
// 明細一覧(全明細+親レコード情報。キーワード検索用)
// ============================================================

export interface LineWithParent extends MeisaiLine {
  date: string; // YYYY-MM-DD
  entryType: string;
  payee: string;
  chargeTo: string;
}

export async function getAllLines(keyword?: string): Promise<LineWithParent[]> {
  const entries = await getEntries();
  const lines: LineWithParent[] = [];
  for (const e of entries) {
    for (const l of e.lines) {
      lines.push({
        ...l,
        date: e.date,
        entryType: e.type,
        payee: e.payee,
        chargeTo: e.chargeTo,
      });
    }
  }
  lines.sort((a, b) => b.date.localeCompare(a.date));
  const q = keyword?.trim();
  if (!q) return lines;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return lines.filter((l) => {
    const haystack =
      `${l.itemName} ${l.category} ${l.memo} ${l.payee} ${l.chargeTo}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}
