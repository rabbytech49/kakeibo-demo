"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/data";
import {
  addEntry,
  updateEntry,
  deleteEntry,
  setCreditStatus,
  isCreditMethod,
  normalizeYm,
  type EntryInput,
  type EntryType,
  type LineInput,
} from "@/lib/store";
import { signOut } from "@/lib/auth";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/list");
  revalidatePath("/stats");
  revalidatePath("/balance");
  revalidatePath("/items");
  revalidatePath("/credit");
}

/** フォームの hidden JSON(payload)を検証して EntryInput にする */
function parsePayload(formData: FormData): EntryInput | string {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return "入力内容の形式が不正です";
  }
  const p = raw as Partial<EntryInput>;
  if (!p.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
    return "日付を入力してください";
  }
  if (!["入金", "出金", "チャージ"].includes(p.type as string)) {
    return "種別が不正です";
  }
  const type = p.type as EntryType;
  const payee = String(p.payee ?? "").trim();
  const method = String(p.method ?? "").trim();
  const rawCreditMonth = String(p.creditMonth ?? "").trim();
  if (type === "チャージ" && !String(p.chargeTo ?? "").trim()) {
    return "チャージ先を選択してください";
  }
  // 仕様_画面: 支払先は出金時必須、支払方法は出金・チャージ時必須
  if (type === "出金" && !payee) {
    return "支払先を選択してください";
  }
  if (type !== "入金" && !method) {
    return "支払方法を選択してください";
  }
  let creditMonth = "";
  if (type !== "入金" && isCreditMethod(method)) {
    creditMonth = normalizeYm(rawCreditMonth);
    if (!creditMonth) {
      return "クレジット引落年月を YYYY/M 形式で入力してください";
    }
  }
  if (!Array.isArray(p.lines) || p.lines.length === 0) {
    return "明細を1件以上入力してください";
  }
  const lines: LineInput[] = [];
  for (const l of p.lines as Partial<LineInput>[]) {
    const unitPrice = Number(l.unitPrice);
    const discount = Number(l.discount) || 0;
    const quantity = Number(l.quantity) || 1;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return "金額は1以上の数値を入力してください";
    }
    if (discount < 0 || quantity < 1) {
      return "値引き・数量の値が不正です";
    }
    lines.push({
      itemName: String(l.itemName ?? "").trim(),
      category: String(l.category ?? "").trim(),
      unitPrice,
      discount,
      quantity,
      memo: String(l.memo ?? "").trim(),
    });
  }
  return {
    date: p.date,
    type,
    chargeTo: type === "チャージ" ? String(p.chargeTo ?? "").trim() : "",
    payee: type === "出金" ? payee : "",
    method: type === "入金" ? "" : method,
    creditMonth,
    memo: String(p.memo ?? "").trim(),
    lines,
  };
}

export async function createEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parsePayload(formData);
  if (typeof parsed === "string") return { error: parsed };
  // requireSession() はセッション失効時に redirect() を投げるため、
  // try の外で呼ぶ(catch が NEXT_REDIRECT を握りつぶすとログインに戻れない)
  await requireSession();
  try {
    await addEntry(parsed);
    revalidateAll();
    return { success: true };
  } catch (e) {
    console.error("追加に失敗:", e);
    return { error: "追加に失敗しました。時間をおいて再試行してください" };
  }
}

export async function updateEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "IDが不正です" };
  const parsed = parsePayload(formData);
  if (typeof parsed === "string") return { error: parsed };
  await requireSession(); // redirectを投げるためtryの外(createEntryAction参照)
  try {
    await updateEntry(id, parsed);
    revalidateAll();
  } catch (e) {
    console.error("更新に失敗:", e);
    return { error: "更新に失敗しました。時間をおいて再試行してください" };
  }
  redirect("/list");
}

export async function deleteEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "IDが不正です" };
  await requireSession(); // redirectを投げるためtryの外(createEntryAction参照)
  try {
    await deleteEntry(id);
    revalidateAll();
  } catch (e) {
    console.error("削除に失敗:", e);
    return { error: "削除に失敗しました。時間をおいて再試行してください" };
  }
  redirect("/list");
}

/** 集計シートのクレジット処理ステータスを更新 */
export async function updateCreditStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ym = normalizeYm(String(formData.get("ym") ?? ""));
  const cardIndex = Number(formData.get("cardIndex"));
  const status = String(formData.get("status") ?? "").trim();
  if (!ym || !Number.isInteger(cardIndex) || cardIndex < 0) {
    return { error: "更新対象が不正です" };
  }
  await requireSession(); // redirectを投げるためtryの外(createEntryAction参照)
  try {
    await setCreditStatus(ym, cardIndex, status);
    revalidatePath("/credit");
    return { success: true };
  } catch (e) {
    console.error("ステータス更新に失敗:", e);
    return { error: "ステータスの更新に失敗しました" };
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
