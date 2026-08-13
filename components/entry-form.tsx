"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createEntryAction,
  updateEntryAction,
  type ActionState,
} from "@/lib/actions";
import {
  chargeDestinationOptions,
  defaultCreditMonth,
  isCreditMethod,
  type EntryType,
  type KakeiboEntry,
  type Masters,
} from "@/lib/model";
import { formatYen } from "@/lib/date";

interface LineDraft {
  itemName: string;
  category: string;
  unitPrice: string;
  discount: string;
  quantity: string;
  memo: string;
}

const emptyLine = (category = "食費"): LineDraft => ({
  itemName: "",
  category,
  unitPrice: "",
  discount: "",
  quantity: "1",
  memo: "",
});

const labelCls =
  "font-label text-xs uppercase tracking-wider text-on-surface-variant";
// M3 filled フィールド(塗り+下線、フォーカスで下線が primary に光る)。globals.css の .m3-field
const inputCls = "m3-field";
const selectCls = "m3-field appearance-none";

// number input はフォーカス中にスクロールすると値が±1されてしまうため、フォーカスを外して無効化する
const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();

export default function EntryForm({
  masters,
  defaultDate,
  initial,
}: {
  masters: Masters;
  defaultDate: string;
  initial?: KakeiboEntry;
}) {
  const isEdit = !!initial;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateEntryAction : createEntryAction,
    {}
  );

  const [type, setType] = useState<EntryType>(initial?.type ?? "出金");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [method, setMethod] = useState(initial?.method ?? "");
  const [chargeTo, setChargeTo] = useState(initial?.chargeTo ?? "");
  const [creditMonth, setCreditMonth] = useState(initial?.creditMonth ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    initial && initial.lines.length > 0
      ? initial.lines.map((l) => ({
          itemName: l.itemName,
          category: l.category,
          unitPrice: String(l.unitPrice),
          discount: String(l.discount),
          quantity: String(l.quantity),
          memo: l.memo,
        }))
      : [emptyLine(masters.categories[0])]
  );

  // 成功メッセージは表示用stateで持ち、事由の切り替えで消せるようにする
  const [showSuccess, setShowSuccess] = useState(false);

  // 新規作成の成功後: デフォルト表示がある項目(日付・数量・費用区分)以外をすべてクリア
  // (アクションは成功のたびに新しいstateを返すため、未処理のstateかどうかで判定する)
  const handledState = useRef<ActionState | null>(null);
  useEffect(() => {
    if (!isEdit && state.success && handledState.current !== state) {
      handledState.current = state;
      setPayee("");
      setMethod("");
      setChargeTo("");
      setCreditMonth("");
      setMemo("");
      setLines([emptyLine(masters.categories[0])]);
      setShowSuccess(true);
    }
  }, [state, isEdit, masters.categories]);

  // トーストは数秒で自動的に消す(連続入力の邪魔をしない)
  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 2600);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const isExpense = type === "出金";
  const isIncome = type === "入金";
  // クレジット引落年月: 出金・チャージ×クレジット系のときのみ入力(仕様_画面)
  const showCredit = !isIncome && isCreditMethod(method);

  // 日付・支払方法の変更時にデフォルト引落年月を自動計算(手修正はその後可能)
  const changeDate = (d: string) => {
    setDate(d);
    if (!isIncome && isCreditMethod(method)) {
      setCreditMonth(defaultCreditMonth(d, method));
    }
  };
  const changeMethod = (m: string) => {
    setMethod(m);
    setCreditMonth(isCreditMethod(m) ? defaultCreditMonth(date, m) : "");
  };
  const changeType = (t: EntryType) => {
    if (t === type) return;
    setType(t);
    setShowSuccess(false);
    // 事由の切り替え時はデフォルト表示がある項目(日付・数量・費用区分)以外をすべてクリア
    setPayee("");
    setMethod("");
    setChargeTo("");
    setCreditMonth("");
    setMemo("");
    setLines([emptyLine(masters.categories[0])]);
  };

  const num = (v: string) => Number(v) || 0;
  const total = lines.reduce(
    (s, l) => s + (num(l.unitPrice) - num(l.discount)) * (num(l.quantity) || 1),
    0
  );

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const payload = JSON.stringify({
    date,
    type,
    chargeTo,
    payee,
    method,
    creditMonth: showCredit ? creditMonth : "",
    memo,
    lines: lines.map((l) => ({
      itemName: l.itemName,
      category: isExpense ? l.category : "",
      unitPrice: num(l.unitPrice),
      discount: num(l.discount),
      quantity: num(l.quantity) || 1,
      memo: l.memo,
    })),
  });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-3xl bg-surface-container p-5"
    >
      <input type="hidden" name="payload" value={payload} />
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

      {/* 事由: セグメンテッドコントロール */}
      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>事由</span>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-container-highest p-1">
          {(["出金", "チャージ", "入金"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={`active-scale rounded-full py-2.5 text-sm font-medium transition-colors ${
                type === t
                  ? "bg-primary-container text-on-primary-container shadow"
                  : "text-on-surface-variant"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 日付 */}
      <label className="flex flex-col gap-1">
        <span className={labelCls}>日付</span>
        <input
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          required
          className={inputCls}
        />
      </label>

      {/* 支払先(出金のみ) */}
      {isExpense && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>支払先</span>
          <PayeeSelect value={payee} onChange={setPayee} payees={masters.payees} />
        </label>
      )}

      {/* チャージ先(チャージのみ・4択) */}
      {type === "チャージ" && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>チャージ先</span>
          <select
            value={chargeTo}
            onChange={(e) => setChargeTo(e.target.value)}
            className={selectCls}
          >
            <option value="">選択してください</option>
            {chargeDestinationOptions(masters.methods).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      )}

      {/* 備考(出金のみ。支払先の補足を書くことが多いため直下に配置) */}
      {isExpense && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>備考</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </label>
      )}

      {/* 支払方法(出金・チャージのみ) */}
      {!isIncome && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>
            {type === "チャージ" ? "支払方法(チャージ元)" : "支払方法"}
          </span>
          <select
            value={method}
            onChange={(e) => changeMethod(e.target.value)}
            className={selectCls}
          >
            <option value="">選択してください</option>
            {masters.methods.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      )}

      {/* クレジット引落年月(クレジット系のみ。デフォルト自動計算) */}
      {showCredit && (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>クレジット引落年月</span>
          <input
            type="text"
            value={creditMonth}
            onChange={(e) => setCreditMonth(e.target.value)}
            placeholder="例: 2026/8"
            required
            className={inputCls}
          />
          <span className="text-xs text-outline">
            {method === "クレジット2"
              ? "1〜15日は翌月・16日以降は翌々月を自動入力しています"
              : "翌月を自動入力しています"}
          </span>
        </label>
      )}

      {/* 明細 */}
      <div className="flex flex-col gap-3">
        <span className={labelCls}>{isExpense ? "明細(品目)" : "金額"}</span>
        {lines.map((l, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl bg-surface-container-low p-3"
          >
            {isExpense ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-outline">品名</span>
                  <input
                    type="text"
                    value={l.itemName}
                    onChange={(e) => setLine(i, { itemName: e.target.value })}
                    placeholder="品名"
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-outline">費用区分</span>
                  <select
                    value={l.category}
                    onChange={(e) => setLine(i, { category: e.target.value })}
                    className={selectCls}
                  >
                    {masters.categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <div className={isExpense ? "grid grid-cols-3 gap-2" : ""}>
              <label className="flex flex-col gap-0.5">
                {/* チャージ・入金はセクション見出しが「金額」なのでラベルを重ねない */}
                {isExpense && (
                  <span className="text-xs text-outline">単価</span>
                )}
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={l.unitPrice}
                  onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                  onWheel={blurOnWheel}
                  placeholder="0"
                  required
                  className={`${inputCls} font-label font-bold`}
                />
              </label>
              {isExpense && (
                <>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-outline">値引き</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={l.discount}
                      onChange={(e) => setLine(i, { discount: e.target.value })}
                      onWheel={blurOnWheel}
                      placeholder="0"
                      className={`${inputCls} font-label`}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-outline">数量</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      onWheel={blurOnWheel}
                      className={`${inputCls} font-label`}
                    />
                  </label>
                </>
              )}
            </div>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-outline">備考</span>
              <input
                type="text"
                value={l.memo}
                onChange={(e) => setLine(i, { memo: e.target.value })}
                className={inputCls}
              />
            </label>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                className="self-end text-xs text-error"
              >
                この明細を削除
              </button>
            )}
          </div>
        ))}
        {isExpense && (
          <button
            type="button"
            onClick={() =>
              setLines((ls) => [...ls, emptyLine(ls[ls.length - 1]?.category)])
            }
            className="active-scale rounded-xl border border-dashed border-outline-variant py-2.5 text-sm text-on-surface-variant"
          >
            ＋ 品目を追加
          </button>
        )}
        <div className="flex items-center justify-between rounded-2xl bg-surface-container-highest px-4 py-3">
          <span className="text-sm text-on-surface-variant">合計</span>
          <span
            className={`font-label text-lg font-bold tabular-nums ${
              isIncome ? "text-income" : "text-expense"
            }`}
          >
            {formatYen(total)}
          </span>
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="active-scale rounded-full bg-primary py-4 text-lg font-bold text-on-primary shadow-[0_8px_22px_rgba(171,202,229,0.18)] disabled:opacity-50"
      >
        {pending ? "送信中…" : isEdit ? "更新する" : "保存する"}
      </button>

      {/* 登録完了トースト: 下からふわっと現れ、数秒で自動的に消える */}
      {!isEdit && showSuccess && (
        <div className="toast-in fixed inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-secondary-container px-5 py-3 text-sm font-bold text-on-secondary-container shadow-2xl">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              className="h-4 w-4"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
            登録しました
          </div>
        </div>
      )}
    </form>
  );
}

/** 支払先: マスタから選択 or 直接入力 */
function PayeeSelect({
  value,
  onChange,
  payees,
}: {
  value: string;
  onChange: (v: string) => void;
  payees: string[];
}) {
  const inMaster = value === "" || payees.includes(value);
  const [freeInput, setFreeInput] = useState(!inMaster);
  return (
    <div className="flex flex-col gap-2">
      {freeInput ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="支払先を入力"
          className={inputCls}
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectCls}
        >
          <option value="">選択してください</option>
          {payees.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => {
          setFreeInput((v) => !v);
          onChange("");
        }}
        className="self-start text-xs text-on-surface-variant underline"
      >
        {freeInput ? "一覧から選ぶ" : "一覧にない支払先を入力する"}
      </button>
    </div>
  );
}
