import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// ============================================================
// デモ用認証(ポートフォリオ公開版)
// 本番版は Google OAuth + メール許可リスト + アクセストークンの
// リフレッシュ(Sheets APIスコープ)で構成しているが、デモでは
// 「デモユーザーとしてログイン」ワンクリックの Credentials プロバイダに
// 置き換えている。セッションは Auth.js デフォルトの JWT(Cookie)。
// ============================================================

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "demo",
      name: "デモユーザー",
      credentials: {},
      authorize: () => ({
        id: "demo",
        name: "デモユーザー",
        email: "demo@example.com",
      }),
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
