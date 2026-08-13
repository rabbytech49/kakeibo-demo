import CreditStatusSelect from "@/components/credit-status-select";
import { getCreditSummary } from "@/lib/data";
import { formatYen } from "@/lib/date";

export const dynamic = "force-dynamic";

/** "クレジット1" → 0(集計シートのステータス列番号) */
function cardStatusIndex(card: string): number | null {
  const m = card.match(/^クレジット(\d+)$/);
  return m ? Number(m[1]) - 1 : null;
}

export default async function CreditPage() {
  const credit = await getCreditSummary();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">クレジット管理</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          引落年月ごとの支払額と処理ステータス
        </p>
      </div>
      {credit.months.length === 0 ? (
        <p className="py-8 text-center text-sm text-outline">
          クレジット支払の記録がありません
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {credit.months.map((m) => (
            <li
              key={m.ym}
              className="rounded-2xl bg-surface-container-low p-4"
            >
              <div className="mb-3 font-label font-bold">{m.ym}</div>
              <div className="flex flex-col gap-3">
                {credit.cards.map((card) => {
                  const amount = m.amounts[card] ?? 0;
                  const statusIndex = cardStatusIndex(card);
                  return (
                    <div key={card} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-on-surface-variant">
                        {card}
                      </span>
                      <span className="w-24 shrink-0 text-right font-label text-sm font-bold tabular-nums">
                        {formatYen(amount)}
                      </span>
                      <div className="min-w-0 flex-1">
                        {statusIndex !== null && (
                          <CreditStatusSelect
                            ym={m.ym}
                            cardIndex={statusIndex}
                            value={m.statuses[statusIndex] ?? ""}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
