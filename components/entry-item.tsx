"use client";

import { useState } from "react";
import Link from "next/link";
import { lineTotal, type KakeiboEntry } from "@/lib/model";
import { formatYen } from "@/lib/date";

export default function EntryItem({ entry }: { entry: KakeiboEntry }) {
  const [open, setOpen] = useState(false);
  const e = entry;

  const title =
    e.type === "チャージ"
      ? `チャージ → ${e.chargeTo || "?"}`
      : e.type === "入金"
        ? e.lines[0]?.itemName || e.memo || e.lines[0]?.memo || "入金"
        : e.payee || "支出";

  const amountCls =
    e.type === "入金"
      ? "text-income"
      : e.type === "チャージ"
        ? "text-on-surface-variant"
        : "text-expense";
  const sign = e.type === "入金" ? "+" : e.type === "出金" ? "-" : "";

  return (
    <li className="border-t border-white/5 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-outline">
            {[e.method, e.lines.length > 1 ? `${e.lines.length}品目` : e.lines[0]?.itemName]
              .filter(Boolean)
              .join("・")}
          </span>
        </span>
        <span className={`shrink-0 font-label font-bold tabular-nums ${amountCls}`}>
          {sign}
          {formatYen(e.total)}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {e.type === "出金" && (
            <ul className="flex flex-col gap-1">
              {e.lines.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {l.itemName || "(品名なし)"}
                    <span className="ml-1 text-xs text-outline">
                      {l.category}
                      {l.quantity > 1 ? ` ×${l.quantity}` : ""}
                      {l.discount > 0 ? ` 値引${l.discount}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-label tabular-nums">{formatYen(lineTotal(l))}</span>
                </li>
              ))}
            </ul>
          )}
          {e.creditMonth && (
            <p className="text-xs text-outline">クレジット引落: {e.creditMonth}</p>
          )}
          {e.memo && <p className="text-xs text-outline">備考: {e.memo}</p>}
          <Link
            href={`/edit/${e.id}`}
            className="active-scale self-start rounded-full border border-outline-variant px-4 py-1.5 text-sm text-on-surface-variant"
          >
            編集・削除
          </Link>
        </div>
      )}
    </li>
  );
}
