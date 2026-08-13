// ============================================================
// デモ用データストア(決定的シード + Cookie差分)
// 本番版はこのファイルの代わりに lib/sheets.ts があり、Google Sheets API v4 を
// 素の fetch で叩いて同名・同シグネチャのドメインAPIを提供している。
//
// デモ版の構成(追補1):
// - シード(lib/seed.ts)は読み取り専用。日付をキーにプロセス内キャッシュし、
//   日替わりで再生成する。IDまで決定的なので、Vercelの複数インスタンスが
//   それぞれ生成しても完全に一致する
// - 訪問者の追加・編集・削除は Cookie(lib/overlay.ts)にのみ保存し、
//   読み出し時に「シード + 差分」を合成する。どのインスタンスに当たっても
//   同じ結果になり、訪問者ごとに独立したデータになる
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
import {
  readOverlay,
  writeOverlay,
  type Overlay,
} from "@/lib/overlay";
import { todayJST } from "@/lib/date";

export * from "@/lib/model";

export interface CreditStatusRecord {
  ym: string; // YYYY/M
  statuses: string[]; // [ステータス1, ステータス2, …] = クレジット1, クレジット2, …
}

interface Seed {
  date: string; // 生成日(JST)。日付が変わったら再生成して全インスタンスを一致させる
  entries: Map<string, KakeiboEntry>;
  creditStatuses: Map<string, string[]>;
  masters: Masters;
}

// globalThis に退避したキャッシュ(dev の HMR・モジュール再評価対策)。
// ミューテーションは一切書き込まない読み取り専用データ
const globalStore = globalThis as typeof globalThis & { __kakeiboSeed?: Seed };

function getSeed(): Seed {
  const today = todayJST();
  if (globalStore.__kakeiboSeed?.date !== today) {
    const seed = generateSeedData();
    globalStore.__kakeiboSeed = {
      date: today,
      entries: new Map(seed.entries.map((e) => [e.id, e])),
      creditStatuses: seed.creditStatuses,
      masters: seed.masters,
    };
  }
  return globalStore.__kakeiboSeed;
}

// ---------- シード + Cookie差分の合成 ----------

/** 削除済み・存在しないIDへの参照は黙って無視する(月替わりでシードが変わっても壊れない) */
function composeEntries(seed: Seed, overlay: Overlay): Map<string, KakeiboEntry> {
  const entries = new Map(seed.entries);
  for (const id of overlay.deleted) entries.delete(id);
  for (const [id, entry] of Object.entries(overlay.upsert)) entries.set(id, entry);
  return entries;
}

function composeCreditStatuses(seed: Seed, overlay: Overlay): Map<string, string[]> {
  const statuses = new Map(seed.creditStatuses);
  for (const [ym, s] of Object.entries(overlay.credit)) statuses.set(ym, s);
  return statuses;
}

async function composedEntries(): Promise<Map<string, KakeiboEntry>> {
  return composeEntries(getSeed(), await readOverlay());
}

/** sheets.ts の joinEntries と同じ並び(日付降順、同日は登録順) */
function sortEntries(entries: Iterable<KakeiboEntry>, month?: string): KakeiboEntry[] {
  return [...entries]
    .filter((e) => !month || e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
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

// ---------- 読み出しAPI(RSCから呼んでよい: cookies() の読みのみ) ----------

/** 一覧取得。month は "YYYY-MM"(省略時は全件) */
export async function listEntries(month?: string): Promise<KakeiboEntry[]> {
  return structuredClone(sortEntries((await composedEntries()).values(), month));
}

/** 編集ページ用: 記録とマスタをまとめて読む */
export async function getEntryWithMasters(
  id: string
): Promise<{ entry: KakeiboEntry | null; masters: Masters }> {
  return {
    entry: structuredClone((await composedEntries()).get(id) ?? null),
    masters: structuredClone(getSeed().masters),
  };
}

/** 費用区分・支払先・支払方法のマスタを読む */
export async function getMasters(): Promise<Masters> {
  return structuredClone(getSeed().masters);
}

/** クレジット管理ページ用: 記録とステータスをまとめて読む */
export async function listEntriesWithCreditStatuses(): Promise<{
  entries: KakeiboEntry[];
  statusRecords: CreditStatusRecord[];
}> {
  const seed = getSeed();
  const overlay = await readOverlay();
  return {
    entries: structuredClone(sortEntries(composeEntries(seed, overlay).values())),
    statusRecords: [...composeCreditStatuses(seed, overlay).entries()].map(
      ([ym, statuses]) => ({ ym, statuses: [...statuses] })
    ),
  };
}

// ---------- 書き込みAPI(Server Actionからのみ: cookies() に書くため) ----------

export async function addEntry(input: EntryInput): Promise<string> {
  const overlay = await readOverlay();
  const entry = buildEntry(uniqueId(), input);
  overlay.upsert[entry.id] = entry;
  await writeOverlay(overlay);
  return entry.id;
}

/** ヘッダーを更新し、明細は全入れ替え(本番のシート実装と同じ意味論) */
export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  const overlay = await readOverlay();
  if (!composeEntries(getSeed(), overlay).has(id)) {
    throw new Error(`記録が見つかりません: ${id}`);
  }
  overlay.upsert[id] = buildEntry(id, input);
  await writeOverlay(overlay);
}

export async function deleteEntry(id: string): Promise<void> {
  const overlay = await readOverlay();
  const seed = getSeed();
  if (!composeEntries(seed, overlay).has(id)) {
    throw new Error(`記録が見つかりません: ${id}`);
  }
  // 圧縮ルール: upsert からは除去し、シード由来IDなら deleted に記録する
  delete overlay.upsert[id];
  if (seed.entries.has(id) && !overlay.deleted.includes(id)) {
    overlay.deleted.push(id);
  }
  await writeOverlay(overlay);
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
  const overlay = await readOverlay();
  const statuses = [
    ...(composeCreditStatuses(getSeed(), overlay).get(normalized) ?? []),
  ];
  while (statuses.length < CREDIT_CARD_COUNT) statuses.push("");
  statuses[cardIndex] = value;
  overlay.credit[normalized] = statuses;
  await writeOverlay(overlay);
}
