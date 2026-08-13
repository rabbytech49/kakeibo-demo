"use client";

import { useActionState, useRef } from "react";
import { updateCreditStatusAction, type ActionState } from "@/lib/actions";
import { CREDIT_STATUS_OPTIONS } from "@/lib/model";

/** 集計シートのクレジット処理ステータス。変更すると即保存 */
export default function CreditStatusSelect({
  ym,
  cardIndex,
  value,
}: {
  ym: string;
  cardIndex: number;
  value: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateCreditStatusAction,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 既存データの表記ゆれ(例: "引落済")も選択肢に含めて表示できるようにする
  const options: string[] = [...CREDIT_STATUS_OPTIONS];
  if (value && !options.includes(value)) options.unshift(value);

  return (
    // key=value: サーバーの値が変わったら select を確実に作り直す(defaultValueは初回マウント時にしか反映されないため)
    <form
      key={value}
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="ym" value={ym} />
      <input type="hidden" name="cardIndex" value={cardIndex} />
      <select
        name="status"
        defaultValue={value}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className={`m3-field appearance-none py-2 text-sm ${
          value ? "text-on-surface" : "text-outline"
        } disabled:opacity-50`}
      >
        <option value="">未処理</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {state.error && <span className="text-xs text-error">{state.error}</span>}
    </form>
  );
}
