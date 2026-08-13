import { getBalances } from "@/lib/data";
import { formatYen } from "@/lib/date";

export const dynamic = "force-dynamic";

function formatAsOf(dateISO: string): string {
  const [y, m, d] = dateISO.split("-");
  return `${y}/${m}/${d}時点`;
}

export default async function BalancePage() {
  const { asOf, wallets } = await getBalances();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">残高</h2>
        <p className="mt-1 font-label text-xs tracking-wider text-on-surface-variant">
          {formatAsOf(asOf)}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {wallets.map((w) => (
          <div
            key={w.name}
            className="flex items-center justify-between rounded-2xl bg-surface-container-low p-5"
          >
            <span className="text-on-surface-variant">{w.name}</span>
            <span
              className={`font-label text-2xl font-bold tabular-nums ${
                w.amount < 0 ? "text-expense" : ""
              }`}
            >
              {formatYen(w.amount)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-outline">
        全期間の家計簿明細から計算しています(繰越レコード含む)。
      </p>
    </div>
  );
}
