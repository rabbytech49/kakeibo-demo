"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
  Tooltip,
} from "recharts";
import { formatYen } from "@/lib/date";
import type { CategorySummary } from "@/lib/data";

const SLOT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const tooltipStyle = {
  background: "var(--background)",
  border: "1px solid rgba(128,128,128,.35)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
};

/** 上位8カテゴリ+「その他」に畳む(色は出現順に固定割当) */
function foldCategories(items: CategorySummary[]): CategorySummary[] {
  if (items.length <= SLOT_COLORS.length) return items;
  const head = items.slice(0, SLOT_COLORS.length - 1);
  const rest = items.slice(SLOT_COLORS.length - 1);
  return [
    ...head,
    { category: "その他", amount: rest.reduce((s, c) => s + c.amount, 0) },
  ];
}

function colorFor(index: number, category: string): string {
  return category === "その他" && index >= SLOT_COLORS.length - 1
    ? "var(--chart-other)"
    : SLOT_COLORS[index];
}

export default function StatsCharts({
  income,
  expense,
  expenseByCategory,
}: {
  income: number;
  expense: number;
  expenseByCategory: CategorySummary[];
}) {
  const folded = foldCategories(expenseByCategory);
  const total = folded.reduce((s, c) => s + c.amount, 0);
  const barData = [
    { name: "収入", value: income, fill: "var(--income)" },
    { name: "支出", value: expense, fill: "var(--expense)" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* 収入 vs 支出 */}
      <section>
        <h2 className="mb-2 text-sm font-medium opacity-70">収入と支出</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} margin={{ top: 24, left: 8, right: 8 }}>
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
            />
            <YAxis hide />
            <Bar dataKey="value" barSize={56} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v) => formatYen(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 12 }}
              />
              {barData.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* カテゴリ別支出 */}
      <section>
        <h2 className="mb-2 text-sm font-medium opacity-70">カテゴリ別支出</h2>
        {folded.length === 0 ? (
          <p className="py-8 text-center text-sm opacity-50">
            支出の記録がありません
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={folded}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius={55}
                  outerRadius={90}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {folded.map((c, i) => (
                    <Cell key={c.category} fill={colorFor(i, c.category)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => formatYen(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* 数値つき凡例(コントラストWARNの緩和: 常に可視のラベル) */}
            <ul className="mt-2 flex flex-col gap-1.5">
              {folded.map((c, i) => (
                <li key={c.category} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: colorFor(i, c.category) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.category}</span>
                  <span className="font-medium">{formatYen(c.amount)}</span>
                  <span className="w-12 text-right text-xs opacity-50">
                    {total > 0 ? Math.round((c.amount / total) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
