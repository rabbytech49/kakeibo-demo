// ============================================================
// 決定的ダミーデータ生成器(ポートフォリオデモ用)
// 月キーから導出したシードで PRNG(mulberry32)を回すため、同一月の
// 生成結果は常に同一。現在月を末尾とする4ヶ月分を生成し、当月は
// todayJST() までの部分月にする。
// ============================================================

import {
  defaultCreditMonth,
  isCreditMethod,
  lineTotal,
  CREDIT_STATUS_OPTIONS,
  type EntryType,
  type KakeiboEntry,
  type LineInput,
  type Masters,
  type MeisaiLine,
} from "@/lib/model";
import { addMonths, currentMonthJST, todayJST } from "@/lib/date";

/** AppSheetのUNIQUEID()と同形式の8桁hex(本番版 sheets.ts から移設) */
export function uniqueId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// マスタ(実在の店名・サービス名は避けた架空名)
export const SEED_MASTERS: Masters = {
  categories: [
    "食費",
    "日用品",
    "外食",
    "交通費",
    "水道光熱費",
    "通信費",
    "家賃",
    "趣味・娯楽",
    "衣類",
    "医療費",
    "交際費",
  ],
  payees: [
    "スーパーみどり",
    "コンビニ",
    "ドラッグストアあおば",
    "書店",
    "カフェ",
    "ネット通販",
    "家電量販店",
    "駅ナカ売店",
    "クリニック",
    "電力会社",
    "水道局",
    "通信会社",
    "不動産管理会社",
    "フリマアプリ",
  ],
  // model.ts の前提: CHARGE_DESTINATIONS(QRペイ・IKOCCA)を含む・
  // 「クレジット」接頭辞2枚・残高計算用の現金/IKOCCA を含むこと
  methods: [
    "現金",
    "クレジット1",
    "クレジット2",
    "QRペイ",
    "IKOCCA",
    "口座振替",
  ],
};

/** 集計シート相当のステータス列数(クレジット1・クレジット2) */
export const CREDIT_CARD_COUNT = 2;

// ---------- シード付きPRNG ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 月キー("2026-08" 等)→ 32bitシード(FNV-1a) */
function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Rng = () => number;

function int(r: Rng, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1));
}

function chance(r: Rng, p: number): boolean {
  return r() < p;
}

/** 10円単位に丸める(公共料金などの見た目用) */
function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

// ---------- エントリ組み立て ----------

interface EntryHead {
  payee?: string;
  method?: string;
  chargeTo?: string;
  creditMonth?: string;
  memo?: string;
}

function makeEntry(
  date: string,
  type: EntryType,
  head: EntryHead,
  lines: LineInput[]
): KakeiboEntry {
  const id = uniqueId();
  const fullLines: MeisaiLine[] = lines.map((l) => ({
    ...l,
    id: uniqueId(),
    entryId: id,
  }));
  return {
    id,
    date,
    type,
    chargeTo: head.chargeTo ?? "",
    payee: head.payee ?? "",
    method: head.method ?? "",
    creditMonth: head.creditMonth ?? "",
    memo: head.memo ?? "",
    lines: fullLines,
    total: fullLines.reduce((s, l) => s + lineTotal(l), 0),
  };
}

function line(
  itemName: string,
  category: string,
  unitPrice: number,
  opts?: { discount?: number; quantity?: number; memo?: string }
): LineInput {
  return {
    itemName,
    category,
    unitPrice,
    discount: opts?.discount ?? 0,
    quantity: opts?.quantity ?? 1,
    memo: opts?.memo ?? "",
  };
}

// ---------- 月次パターン ----------

// スーパーの品目プール(単価はここから乱数で揺らす)
const GROCERY_ITEMS = [
  { name: "卵10個", cat: "食費", lo: 198, hi: 278 },
  { name: "牛乳", cat: "食費", lo: 198, hi: 248 },
  { name: "食パン", cat: "食費", lo: 128, hi: 188 },
  { name: "鶏むね肉", cat: "食費", lo: 268, hi: 398 },
  { name: "豚こま切れ", cat: "食費", lo: 298, hi: 458 },
  { name: "野菜セット", cat: "食費", lo: 398, hi: 598 },
  { name: "ヨーグルト", cat: "食費", lo: 138, hi: 198 },
  { name: "バナナ", cat: "食費", lo: 108, hi: 158 },
  { name: "冷凍うどん", cat: "食費", lo: 158, hi: 248 },
  { name: "豆腐", cat: "食費", lo: 78, hi: 118 },
  { name: "納豆", cat: "食費", lo: 88, hi: 128 },
  { name: "りんご", cat: "食費", lo: 128, hi: 198 },
  { name: "トイレットペーパー", cat: "日用品", lo: 328, hi: 448 },
  { name: "食器用洗剤", cat: "日用品", lo: 158, hi: 248 },
  { name: "ラップ", cat: "日用品", lo: 108, hi: 168 },
] as const;

const DRUGSTORE_ITEMS = [
  { name: "シャンプー", cat: "日用品", lo: 298, hi: 498 },
  { name: "ハンドソープ", cat: "日用品", lo: 198, hi: 298 },
  { name: "洗濯洗剤", cat: "日用品", lo: 328, hi: 478 },
  { name: "ティッシュ5箱", cat: "日用品", lo: 298, hi: 398 },
  { name: "綿棒", cat: "日用品", lo: 108, hi: 158 },
] as const;

/**
 * 1ヶ月分のエントリを日付順不同で生成する(当月分の日付制限は呼び出し側)。
 * 現金・IKOCCA残高が構成上マイナスにならないよう、現金払いの割合や
 * チャージ日を固定的に配置している(最終的に assert でも検証する)。
 */
function generateMonth(month: string, isFirstMonth: boolean): KakeiboEntry[] {
  const r = mulberry32(hashKey(month));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
  const entries: KakeiboEntry[] = [];

  // 繰越(最初の月の1日): data.ts の残高計算はこのレコードが起点
  if (isFirstMonth) {
    entries.push(
      makeEntry(d(1), "入金", { memo: "繰越" }, [line("繰越金", "", 50000)]),
      makeEntry(
        d(1),
        "チャージ",
        { chargeTo: "IKOCCA", method: "現金", memo: "繰越" },
        [line("IKOCCA残高繰越", "", 3000)]
      )
    );
  }

  // 給料25日(入金は支払先・支払方法空欄 — actions.ts の parsePayload 仕様)
  entries.push(
    makeEntry(d(25), "入金", { memo: "給料" }, [line("給料", "", 280000)])
  );

  // 家賃27日(口座振替)
  entries.push(
    makeEntry(d(27), "出金", { payee: "不動産管理会社", method: "口座振替" }, [
      line("家賃", "家賃", 78000),
    ])
  );

  // 光熱費・通信費
  entries.push(
    makeEntry(d(12), "出金", { payee: "電力会社", method: "口座振替" }, [
      line("電気代", "水道光熱費", round10(int(r, 7000, 11500))),
    ]),
    makeEntry(d(18), "出金", { payee: "水道局", method: "口座振替" }, [
      line("水道代", "水道光熱費", round10(int(r, 3200, 4400))),
    ]),
    makeEntry(
      d(21),
      "出金",
      {
        payee: "通信会社",
        method: "クレジット1",
        creditMonth: defaultCreditMonth(d(21), "クレジット1"),
      },
      [line("スマホ料金", "通信費", round10(int(r, 5800, 7200)))]
    )
  );

  // チャージ: IKOCCAは月初(交通費より先に残高を作る)、原資は現金
  entries.push(
    makeEntry(d(4), "チャージ", { chargeTo: "IKOCCA", method: "現金" }, [
      line("IKOCCAチャージ", "", 3000),
    ])
  );
  if (chance(r, 0.5)) {
    entries.push(
      makeEntry(d(22), "チャージ", { chargeTo: "IKOCCA", method: "現金" }, [
        line("IKOCCAチャージ", "", 3000),
      ])
    );
  }
  // QRペイはクレジット1からチャージ
  // (クレジット1の引落はデフォルトで翌月 — model.defaultCreditMonth)
  entries.push(
    makeEntry(
      d(5),
      "チャージ",
      {
        chargeTo: "QRペイ",
        method: "クレジット1",
        creditMonth: defaultCreditMonth(d(5), "クレジット1"),
      },
      [line("QRペイチャージ", "", 5000)]
    )
  );
  if (chance(r, 0.7)) {
    entries.push(
      makeEntry(
        d(17),
        "チャージ",
        {
          chargeTo: "QRペイ",
          method: "クレジット1",
          creditMonth: defaultCreditMonth(d(17), "クレジット1"),
        },
        [line("QRペイチャージ", "", 3000)]
      )
    );
  }

  // スーパー(2〜3日おき、明細2〜4行。値引き・数量>1 を意図的に混ぜて
  // 実額 = (金額 − 値引き) × 数量 の計算を見せる)
  // 現金払いは3回に1回の固定ローテーション(現金残高の下振れ防止)
  const groceryMethods = ["QRペイ", "クレジット1", "現金"] as const;
  let visit = 0;
  for (let day = int(r, 2, 3); day <= daysInMonth; day += int(r, 2, 3)) {
    const method = groceryMethods[visit % groceryMethods.length];
    visit++;
    const lineCount = int(r, 2, 4);
    const chosen = new Set<number>();
    while (chosen.size < lineCount) chosen.add(int(r, 0, GROCERY_ITEMS.length - 1));
    const lines = [...chosen].map((idx) => {
      const item = GROCERY_ITEMS[idx];
      return line(item.name, item.cat, int(r, item.lo, item.hi), {
        discount: chance(r, 0.3) ? int(r, 1, 6) * 10 : 0,
        quantity: chance(r, 0.25) ? int(r, 2, 3) : 1,
      });
    });
    entries.push(
      makeEntry(d(day), "出金", {
        payee: "スーパーみどり",
        method,
        creditMonth:
          method === "クレジット1" ? defaultCreditMonth(d(day), method) : "",
      }, lines)
    );
  }

  // コンビニ(QRペイ払い)
  for (let i = 0; i < 2; i++) {
    entries.push(
      makeEntry(d(int(r, 6, 24)), "出金", { payee: "コンビニ", method: "QRペイ" }, [
        line("お弁当", "外食", int(r, 498, 698)),
        line("お茶", "食費", int(r, 108, 160)),
      ])
    );
  }

  // カフェ(QRペイ)
  for (let i = 0; i < int(r, 1, 2); i++) {
    entries.push(
      makeEntry(d(int(r, 5, 26)), "出金", { payee: "カフェ", method: "QRペイ" }, [
        line("カフェランチ", "外食", int(r, 850, 1200)),
      ])
    );
  }

  // 交通費(IKOCCA。チャージ日(4日)以降に配置し、月内合計はチャージ額未満に収める)
  for (let i = 0; i < int(r, 3, 4); i++) {
    entries.push(
      makeEntry(d(int(r, 5, 28)), "出金", { payee: "駅ナカ売店", method: "IKOCCA" }, [
        line("電車運賃", "交通費", int(r, 15, 42) * 10),
      ])
    );
  }

  // ドラッグストア(日用品)
  for (let i = 0; i < int(r, 1, 2); i++) {
    const lineCount = int(r, 2, 3);
    const chosen = new Set<number>();
    while (chosen.size < lineCount) chosen.add(int(r, 0, DRUGSTORE_ITEMS.length - 1));
    entries.push(
      makeEntry(d(int(r, 3, 27)), "出金", { payee: "ドラッグストアあおば", method: "QRペイ" },
        [...chosen].map((idx) => {
          const item = DRUGSTORE_ITEMS[idx];
          return line(item.name, item.cat, int(r, item.lo, item.hi), {
            discount: chance(r, 0.2) ? int(r, 1, 4) * 10 : 0,
          });
        })
      )
    );
  }

  // 書店(クレジット2、16日以降 → 引落はデフォルトで翌々月になるケース)
  {
    const day = int(r, 16, 26);
    entries.push(
      makeEntry(
        d(day),
        "出金",
        {
          payee: "書店",
          method: "クレジット2",
          creditMonth: defaultCreditMonth(d(day), "クレジット2"),
        },
        [
          line("文庫本", "趣味・娯楽", int(r, 700, 950)),
          ...(chance(r, 0.5) ? [line("雑誌", "趣味・娯楽", int(r, 780, 1100))] : []),
        ]
      )
    );
  }

  // ネット通販(QRペイ)
  entries.push(
    makeEntry(d(int(r, 6, 20)), "出金", { payee: "ネット通販", method: "QRペイ" }, [
      chance(r, 0.5)
        ? line("ゲームソフト", "趣味・娯楽", int(r, 5800, 7800))
        : line("Tシャツ", "衣類", int(r, 1980, 2980), { quantity: chance(r, 0.4) ? 2 : 1 }),
    ])
  );

  // 家電量販店(隔月・クレジット2、15日以前 → 引落は翌月)
  if (m % 2 === 1) {
    const day = int(r, 5, 15);
    entries.push(
      makeEntry(
        d(day),
        "出金",
        {
          payee: "家電量販店",
          method: "クレジット2",
          creditMonth: defaultCreditMonth(d(day), "クレジット2"),
        },
        [line("イヤホン", "趣味・娯楽", int(r, 3980, 8980))]
      )
    );
  }

  // フリマアプリ(衣類)
  if (chance(r, 0.6)) {
    entries.push(
      makeEntry(d(int(r, 8, 24)), "出金", { payee: "フリマアプリ", method: "QRペイ" }, [
        line("古着ジャケット", "衣類", int(r, 1500, 3500)),
      ])
    );
  }

  // 交際費(手土産)
  if (chance(r, 0.6)) {
    entries.push(
      makeEntry(d(int(r, 10, 26)), "出金", { payee: "カフェ", method: "QRペイ" }, [
        line("焼き菓子詰め合わせ", "交際費", int(r, 1500, 2500)),
      ])
    );
  }

  // クリニック(現金)
  if (chance(r, 0.5)) {
    entries.push(
      makeEntry(d(int(r, 6, 20)), "出金", { payee: "クリニック", method: "現金" }, [
        line("診察代", "医療費", int(r, 1500, 2800)),
      ])
    );
  }

  return entries;
}

// ---------- 残高検証・クレジットステータス ----------

/**
 * data.ts の getBalances と同じ規則で現金・IKOCCA残高を時系列に検証する。
 * 同一日内は 入金 → チャージ → 出金 の順で処理する(生成データの前提)
 */
function assertNonNegativeBalances(entries: KakeiboEntry[]): void {
  const typeOrder: Record<EntryType, number> = { 入金: 0, チャージ: 1, 出金: 2 };
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || typeOrder[a.type] - typeOrder[b.type]
  );
  let cash = 0;
  let ikocca = 0;
  for (const e of sorted) {
    if (e.type === "入金") {
      cash += e.total;
    } else if (e.type === "出金") {
      if (e.method === "現金") cash -= e.total;
      if (e.method === "IKOCCA") ikocca -= e.total;
    } else {
      if (e.method === "現金") cash -= e.total;
      if (e.chargeTo === "IKOCCA") ikocca += e.total;
    }
    if (cash < 0 || ikocca < 0) {
      throw new Error(
        `シードデータの残高が負になりました(${e.date}: 現金=${cash}, IKOCCA=${ikocca})`
      );
    }
  }
}

/**
 * クレジット処理ステータス(集計シート相当)を引落年月から機械的に決める:
 * 2ヶ月以上前 →「金額確認済 , 引落済」、先月 →「金額確認済」、当月以降 → 行なし
 */
function buildCreditStatuses(
  entries: KakeiboEntry[],
  currentMonth: string
): Map<string, string[]> {
  const ymKey = (ym: string) => {
    const [yy, mm] = ym.split("/").map(Number);
    return yy * 12 + mm;
  };
  const [cy, cm] = currentMonth.split("-").map(Number);
  const currentKey = cy * 12 + cm;

  const statuses = new Map<string, string[]>();
  for (const e of entries) {
    if (!isCreditMethod(e.method) || !e.creditMonth) continue;
    if (statuses.has(e.creditMonth)) continue;
    const diff = currentKey - ymKey(e.creditMonth);
    if (diff >= 2) {
      statuses.set(e.creditMonth, Array(CREDIT_CARD_COUNT).fill(CREDIT_STATUS_OPTIONS[1]));
    } else if (diff === 1) {
      statuses.set(e.creditMonth, Array(CREDIT_CARD_COUNT).fill(CREDIT_STATUS_OPTIONS[0]));
    }
    // 当月以降は行を作らない(実運用でも未処理の月は空)
  }
  return statuses;
}

// ---------- エントリポイント ----------

export interface SeedData {
  entries: KakeiboEntry[];
  creditStatuses: Map<string, string[]>;
  masters: Masters;
}

const MONTHS_TO_GENERATE = 4;

/** 現在月を末尾とする4ヶ月分のダミーデータを生成する */
export function generateSeedData(): SeedData {
  const today = todayJST();
  const currentMonth = currentMonthJST();
  const entries: KakeiboEntry[] = [];
  for (let i = MONTHS_TO_GENERATE - 1; i >= 0; i--) {
    const month = addMonths(currentMonth, -i);
    entries.push(...generateMonth(month, i === MONTHS_TO_GENERATE - 1));
  }
  // 当月は今日までの部分月にする
  const limited = entries.filter((e) => e.date <= today);
  assertNonNegativeBalances(limited);
  return {
    entries: limited,
    creditStatuses: buildCreditStatuses(limited, currentMonth),
    masters: structuredClone(SEED_MASTERS),
  };
}
