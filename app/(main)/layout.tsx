import { redirect } from "next/navigation";
import BottomNav from "@/components/bottom-nav";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/actions";

export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // データ取得を伴わないページ(/more)もここで守る。
  // 各ページ・Server Actionも requireSession() で個別に検証している。
  // 判定式は app/login/page.tsx と完全に同一にする(リダイレクトループ対策)
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-white/5 bg-surface/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <svg
              viewBox="7 13 50 42"
              className="h-6 w-7 text-expense"
              aria-hidden
            >
              {/* 豚さん貯金箱(app/icon.svg と同じ図案) */}
              <g fill="currentColor">
                <path
                  d="M13 34.5 q-4.4 -0.6 -3 -3.9 q1 -2.3 3.2 -1.3"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  fill="none"
                />
                <rect x="21" y="45" width="5.6" height="8" rx="2.8" />
                <rect x="35.5" y="45" width="5.6" height="8" rx="2.8" />
                <path d="M36.5 23.5 Q38.5 14.5 45.5 16.5 Q45 23 40 25 Z" />
                <ellipse cx="31" cy="36" rx="19" ry="14.5" />
                <rect x="46.5" y="29.5" width="9" height="13" rx="4.5" />
              </g>
              <rect
                x="23"
                y="22.6"
                width="11"
                height="2.8"
                rx="1.4"
                fill="var(--color-surface)"
              />
              <circle cx="42" cy="29" r="1.9" fill="var(--color-surface)" />
            </svg>
            <h1 className="font-display text-2xl font-bold tracking-tight text-primary">
              Kakeibo
            </h1>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="active-scale text-xs text-on-surface-variant"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <p className="border-b border-white/5 bg-surface-container px-5 py-1.5 text-center text-[11px] leading-relaxed text-on-surface-variant">
        ポートフォリオ用デモ — サンプルデータは自動生成です。追加・編集はこのブラウザ内にのみ保存されます。
      </p>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-5">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
