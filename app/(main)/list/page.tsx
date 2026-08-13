import Link from "next/link";
import MonthSwitcher from "@/components/month-switcher";
import EntryItem from "@/components/entry-item";
import { getEntries } from "@/lib/data";
import type { KakeiboEntry } from "@/lib/model";
import {
  currentMonthJST,
  isValidMonth,
  formatYen,
  formatDayHeader,
} from "@/lib/date";

export const dynamic = "force-dynamic";

/** 日付ごとの純増減(入金+ / 出金-、チャージは資金移動なので除外) */
function dayNet(entries: KakeiboEntry[]): number {
  return entries.reduce((s, e) => {
    if (e.type === "入金") return s + e.total;
    if (e.type === "出金") return s - e.total;
    return s;
  }, 0);
}

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = isValidMonth(params.month) ? params.month : currentMonthJST();
  const entries = await getEntries(month);

  const sum = (type: string) =>
    entries.filter((e) => e.type === type).reduce((s, e) => s + e.total, 0);
  const income = sum("入金");
  const expense = sum("出金");
  const charge = sum("チャージ");
  const balance = income - expense;
  const ratio = income > 0 ? Math.round((expense / income) * 100) : null;

  // 日付降順で来るので、連続する同日をまとめる
  const groups: { date: string; entries: KakeiboEntry[] }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.entries.push(e);
    else groups.push({ date: e.date, entries: [e] });
  }

  return (
    <div className="flex flex-col gap-4">
      <MonthSwitcher month={month} basePath="/list" />

      {/* ヒーローサマリー: 今月の収支を主役に */}
      <div className="rounded-3xl bg-surface-container p-5">
        <span className="font-label text-xs tracking-wider text-on-surface-variant">
          今月の収支
        </span>
        <div
          className={`font-label text-3xl font-bold tabular-nums ${
            balance >= 0 ? "text-income" : "text-expense"
          }`}
        >
          {balance >= 0 ? "+" : "−"}
          {formatYen(Math.abs(balance))}
        </div>
        {ratio !== null && (
          <>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-expense"
                style={{ width: `${Math.min(100, ratio)}%` }}
              />
            </div>
            <span className="text-xs text-outline">支出は収入の {ratio}%</span>
          </>
        )}
        <div className="mt-3 flex justify-between gap-2 border-t border-white/5 pt-3">
          <span className="flex flex-col gap-0.5 text-xs text-on-surface-variant">
            収入
            <b className="font-label text-sm tabular-nums text-income">
              {formatYen(income)}
            </b>
          </span>
          <span className="flex flex-col gap-0.5 text-xs text-on-surface-variant">
            支出
            <b className="font-label text-sm tabular-nums text-expense">
              {formatYen(expense)}
            </b>
          </span>
          <span className="flex flex-col gap-0.5 text-xs text-on-surface-variant">
            チャージ
            <b className="font-label text-sm tabular-nums">{formatYen(charge)}</b>
          </span>
        </div>
      </div>

      <Link
        href="/items"
        className="active-scale flex items-center justify-between rounded-2xl bg-surface-container-low px-5 py-4"
      >
        <span className="text-sm">明細一覧・キーワード検索</span>
        <span aria-hidden className="text-outline">›</span>
      </Link>

      {entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-outline">
          この月の記録はありません
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const net = dayNet(g.entries);
            return (
              <div key={g.date} className="flex flex-col">
                <div className="flex items-baseline justify-between px-1 pb-1.5">
                  <span className="text-xs font-bold text-on-surface-variant">
                    {formatDayHeader(g.date)}
                  </span>
                  <span className="font-label text-xs tabular-nums text-outline">
                    計 {net > 0 ? "+" : ""}
                    {formatYen(Math.abs(net))}
                  </span>
                </div>
                <ul className="overflow-hidden rounded-2xl bg-surface-container-low">
                  {g.entries.map((e) => (
                    <EntryItem key={e.id} entry={e} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
