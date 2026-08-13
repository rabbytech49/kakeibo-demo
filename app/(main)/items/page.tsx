import { getAllLines } from "@/lib/data";
import { lineTotal } from "@/lib/model";
import { formatYen } from "@/lib/date";

export const dynamic = "force-dynamic";

const DISPLAY_LIMIT = 300;

/** "2026-07-05" → "2026/7/5" */
function formatDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const lines = await getAllLines(q);
  const shown = lines.slice(0, DISPLAY_LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-semibold">明細一覧</h2>
      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          className="m3-field min-w-0 flex-1"
        />
        <button
          type="submit"
          className="active-scale shrink-0 rounded-full bg-primary px-5 font-medium text-on-primary"
        >
          検索
        </button>
      </form>
      <p className="text-xs text-outline">
        {q ? `「${q}」の検索結果 ${lines.length}件` : `全${lines.length}件`}
        {lines.length > DISPLAY_LIMIT ? `(先頭${DISPLAY_LIMIT}件を表示)` : ""}
      </p>
      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-outline">
          該当する明細はありません
        </p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 border-b border-white/5 py-3"
            >
              <span className="w-20 shrink-0 font-label text-xs tabular-nums text-on-surface-variant">
                {formatDate(l.date)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {l.itemName || l.memo || `(${l.entryType})`}
                </span>
                <span className="block truncate text-xs text-outline">
                  {[l.category, l.payee || l.chargeTo, l.quantity > 1 ? `×${l.quantity}` : ""]
                    .filter(Boolean)
                    .join("・")}
                </span>
              </span>
              <span className="shrink-0 font-label text-sm font-bold tabular-nums">
                {formatYen(lineTotal(l))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
