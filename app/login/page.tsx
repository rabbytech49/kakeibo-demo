import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export const metadata = { title: "ログイン | Kakeibo Demo" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-primary">
          Kakeibo
        </h1>
        <p className="mt-3 text-sm text-on-surface-variant">
          ポートフォリオ用のデモです。ワンクリックでお試しいただけます
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          データはサンプルで定期的にリセットされます
        </p>
      </div>
      {error && (
        <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
          ログインに失敗しました。もう一度お試しください
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("demo", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="active-scale rounded-full bg-primary px-8 py-3 font-medium text-on-primary shadow-[0_8px_22px_rgba(171,202,229,0.18)]"
        >
          デモユーザーとしてログイン
        </button>
      </form>
    </main>
  );
}
