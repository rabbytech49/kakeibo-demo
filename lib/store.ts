// ============================================================
// インメモリのデモ用データストア
// 本番版はこのファイルの代わりに lib/sheets.ts があり、Google Sheets API v4 を
// 素の fetch で叩いて同名・同シグネチャのドメインAPIを提供している。
// デモではプロセス内メモリに差し替えており、コールドスタート(サーバー
// 再起動・新インスタンス起動)のたびにシードデータへ戻る。
// ============================================================

import {
  lineTotal,
  normalizeYm,
  type EntryInput,
  type KakeiboEntry,
  type Masters,
  type MeisaiLine,
} from "@/lib/model";
import { generateSeedData, uniqueId, CREDIT_CARD_COUNT } from "@/lib/seed";

export * from "@/lib/model";

export interface CreditStatusRecord {
  ym: string; // YYYY/M
  statuses: string[]; // [ステータス1, ステータス2, …] = クレジット1, クレジット2, …
}

interface Store {
  entries: Map<string, KakeiboEntry>;
  creditStatuses: Map<string, string[]>; // ym(YYYY/M) → [ステータス1, ステータス2]
  masters: Masters;
}

// globalThis に退避したシングルトン + 遅延初期化。
// dev の HMR やモジュール再評価でデータが消えないようにする
const globalStore = globalThis as typeof globalThis & { __kakeiboStore?: Store };

function getStore(): Store {
  if (!globalStore.__kakeiboStore) {
    const seed = generateSeedData();
    globalStore.__kakeiboStore = {
      entries: new Map(seed.entries.map((e) => [e.id, e])),
      creditStatuses: seed.creditStatuses,
      masters: seed.masters,
    };
  }
  return globalStore.__kakeiboStore;
}

/** sheets.ts の joinEntries と同じ並び(日付降順、同日は登録順) */
function sortedEntries(store: Store, month?: string): KakeiboEntry[] {
  const entries = [...store.entries.values()].filter(
    (e) => !month || e.date.startsWith(month)
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function buildEntry(id: string, input: EntryInput): KakeiboEntry {
  const lines: MeisaiLine[] = input.lines.map((l) => ({
    ...l,
    id: uniqueId(),
    entryId: id,
  }));
  return {
    id,
    date: input.date,
    type: input.type,
    chargeTo: input.chargeTo,
    payee: input.payee,
    method: input.method,
    creditMonth: input.creditMonth,
    memo: input.memo,
    lines,
    total: lines.reduce((s, l) => s + lineTotal(l), 0),
  };
}

/** 一覧取得。month は "YYYY-MM"(省略時は全件) */
export async function listEntries(month?: string): Promise<KakeiboEntry[]> {
  return structuredClone(sortedEntries(getStore(), month));
}

/** 編集ページ用: 記録とマスタをまとめて読む */
export async function getEntryWithMasters(
  id: string
): Promise<{ entry: KakeiboEntry | null; masters: Masters }> {
  const store = getStore();
  return {
    entry: structuredClone(store.entries.get(id) ?? null),
    masters: structuredClone(store.masters),
  };
}

export async function addEntry(input: EntryInput): Promise<string> {
  const store = getStore();
  const entry = buildEntry(uniqueId(), input);
  store.entries.set(entry.id, entry);
  return entry.id;
}

/** ヘッダーを更新し、明細は全入れ替え(本番のシート実装と同じ意味論) */
export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  const store = getStore();
  if (!store.entries.has(id)) throw new Error(`記録が見つかりません: ${id}`);
  store.entries.set(id, buildEntry(id, input));
}

export async function deleteEntry(id: string): Promise<void> {
  const store = getStore();
  if (!store.entries.has(id)) throw new Error(`記録が見つかりません: ${id}`);
  store.entries.delete(id);
}

/** 費用区分・支払先・支払方法のマスタを読む */
export async function getMasters(): Promise<Masters> {
  return structuredClone(getStore().masters);
}

/** クレジット管理ページ用: 記録とステータスをまとめて読む */
export async function listEntriesWithCreditStatuses(): Promise<{
  entries: KakeiboEntry[];
  statusRecords: CreditStatusRecord[];
}> {
  const store = getStore();
  return {
    entries: structuredClone(sortedEntries(store)),
    statusRecords: [...store.creditStatuses.entries()].map(([ym, statuses]) => ({
      ym,
      statuses: [...statuses],
    })),
  };
}

/** 年月×カード(0始まり: 0=クレジット1)のステータスを更新。行がなければ追加 */
export async function setCreditStatus(
  ym: string,
  cardIndex: number,
  value: string
): Promise<void> {
  const normalized = normalizeYm(ym);
  if (!normalized) throw new Error(`年月の形式が不正です: ${ym}`);
  if (cardIndex < 0 || cardIndex >= CREDIT_CARD_COUNT) {
    throw new Error(`ステータス列がありません: ${cardIndex + 1}列目`);
  }
  const store = getStore();
  const statuses =
    store.creditStatuses.get(normalized) ??
    new Array<string>(CREDIT_CARD_COUNT).fill("");
  statuses[cardIndex] = value;
  store.creditStatuses.set(normalized, statuses);
}
