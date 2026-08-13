// ============================================================
// 訪問者の追加・編集・削除の差分を Cookie に保存する(追補1)
// Vercel ではインメモリストアがインスタンスごとに別メモリになるため、
// 「決定的シード + Cookie差分」を各リクエストで合成することで、どの
// インスタンスに当たっても同じ結果を返す。副次的に訪問者ごとに独立した
// デモデータになる。
// Cookie の書き込みは Server Action / Route Handler からのみ可能
// (next/headers の cookies() の制約)。読み出しは RSC からでもよい。
// ============================================================

import { cookies } from "next/headers";
import type { KakeiboEntry } from "@/lib/model";

export interface Overlay {
  v: 1;
  upsert: Record<string, KakeiboEntry>; // 追加・編集された記録(明細ID・total込みの完成形)
  deleted: string[]; // 削除されたシード記録のID
  credit: Record<string, string[]>; // ym(YYYY/M) → ステータス配列の上書き
}

const COOKIE_NAME = "demo-overlay";
// ブラウザのCookie上限(約4KB)に余裕を残す
const MAX_ENCODED_BYTES = 3584;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** 保存上限超過。actions.ts がこのメッセージをそのままユーザーに表示する */
export class OverlayLimitError extends Error {}

export function emptyOverlay(): Overlay {
  return { v: 1, upsert: {}, deleted: [], credit: {} };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Cookieから差分を読む。Cookieは訪問者が改ざん・破損させ得るので、
 * 形が崩れていたら空の差分に戻す(壊れるのは本人のデモデータだけ)
 */
export async function readOverlay(): Promise<Overlay> {
  try {
    const raw = (await cookies()).get(COOKIE_NAME)?.value;
    if (!raw) return emptyOverlay();
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    );
    if (
      !isRecord(parsed) ||
      parsed.v !== 1 ||
      !isRecord(parsed.upsert) ||
      !Array.isArray(parsed.deleted) ||
      !isRecord(parsed.credit)
    ) {
      return emptyOverlay();
    }
    return parsed as unknown as Overlay;
  } catch {
    return emptyOverlay();
  }
}

export async function writeOverlay(overlay: Overlay): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(overlay)).toString("base64url");
  if (encoded.length > MAX_ENCODED_BYTES) {
    throw new OverlayLimitError(
      "デモの保存上限に達しました。追加した記録を削除するとまた入力できます"
    );
  }
  (await cookies()).set(COOKIE_NAME, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}
