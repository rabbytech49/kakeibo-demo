import MonthSwitcher from "@/components/month-switcher";
import StatsCharts from "@/components/stats-charts";
import { getMonthlySummary } from "@/lib/data";
import { currentMonthJST, isValidMonth, formatYen } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = isValidMonth(params.month) ? params.month : currentMonthJST();
  const summary = await getMonthlySummary(month);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <MonthSwitcher month={month} basePath="/stats" />
        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface-container-low px-2 py-3">
            <div className="font-label text-xs text-on-surface-variant">収入</div>
            <div className="mt-1 font-label text-sm font-bold tabular-nums text-income">
              {formatYen(summary.income)}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-container-low px-2 py-3">
            <div className="font-label text-xs text-on-surface-variant">支出</div>
            <div className="mt-1 font-label text-sm font-bold tabular-nums text-expense">
              {formatYen(summary.expense)}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-container-low px-2 py-3">
            <div className="font-label text-xs text-on-surface-variant">収支</div>
            <div className="mt-1 font-label text-sm font-bold tabular-nums">
              {summary.balance >= 0 ? "+" : "−"}
              {formatYen(Math.abs(summary.balance))}
            </div>
          </div>
        </div>
        <p className="text-right text-xs text-outline">
          チャージ(資金移動・収支対象外): {formatYen(summary.charge)}
        </p>
      </div>

      <StatsCharts
        income={summary.income}
        expense={summary.expense}
        expenseByCategory={summary.expenseByCategory}
      />
    </div>
  );
}
