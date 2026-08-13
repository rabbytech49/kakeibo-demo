# Webアプリのセキュリティ対策集（kakeibo プロジェクトで実施した対策の洗い出し）

> **注**: これは本番版（Google OAuth + Google Sheets + Cloudflare Workers 構成）での対策記録です。
> 公開中のデモ版はデータ層をインメモリストア、認証をゲストログインに置き換えているため、
> トークン管理・Sheets インジェクション対策など該当しない項目があります（設計判断の記録として残しています）。

Next.js (App Router) + Auth.js + Google Sheets API + Cloudflare Workers 構成の個人向けWebアプリで
実際に実施したセキュリティ対策の一覧。汎用的な知見として再利用できるよう「対策・理由・実装ポイント」で整理する。

## 1. 認証・認可

### 1-1. OAuthログイン + メール許可リスト
- **対策**: Google OAuth (Auth.js v5) でログインし、`ALLOWED_EMAILS` 環境変数（カンマ区切り）の許可リストに一致するメールのみ `signIn` コールバックで許可する。
- **理由**: 個人・家族用アプリを公開URLに置くため、Googleアカウント認証だけでは不十分。本人＋家族のみに限定する。
- **実装ポイント**: メールは両側とも `trim().toLowerCase()` で正規化してから比較する。拒否時のUXも確認する（「このアカウントには利用が許可されていません」）。**本番環境で許可リスト外アカウントが実際に拒否されることを実測確認する**ところまでやる。

### 1-2. `email_verified` の必須チェック
- **対策**: `signIn` コールバックで `profile.email_verified === true` を必須にする。
- **理由**: 未検証メールを許すと、許可リスト上のメールアドレスを名乗る別アカウントで成りすましログインできる可能性がある（Auth.js公式推奨のチェック）。
- **実装ポイント**: `!== false` ではなく `=== true` で判定する（undefined を弾く）。

### 1-3. 認可はミドルウェア（Proxy）だけに頼らない多層防御
- **対策**: 全ページ・全Server Actionがデータアクセス前に `requireAccessToken()`（内部で `auth()`）を呼ぶ。加えて `app/(main)/layout.tsx` でも未認証なら `/login` へリダイレクト。
- **理由**: Next.js公式も「Proxy（旧middleware）だけに認可を頼らず各Server Function内で検証せよ」としている。実際、Cloudflare移行で `proxy.ts` を削除せざるを得なくなった際も（OpenNextがNodeミドルウェア未サポート）、認証の関門が崩れなかった。
- **実装ポイント**:
  - データ取得を伴わないページ（例: メニューページ）はServer Actionのチェックが効かないので、layout側のチェックが必須。
  - ミドルウェアを将来復活させる場合も layout / Server Function 側のチェックは残す。

### 1-4. リダイレクトループの防止
- **対策**: 「未認証 → /login」（layout側）と「認証済み → /」（loginページ側）の判定条件を**完全に同一の式**に揃える（`!session?.accessToken || session.error === "RefreshTokenError"`）。
- **理由**: 判定がずれると、トークンリフレッシュ失敗時などに `/login` ⇄ `/` の無限リダイレクトループが起きる。

### 1-5. `redirect()` 例外を catch で握りつぶさない
- **対策**: Server Action 内で、認証チェック（`redirect("/login")` を投げうる処理）は `try` ブロックの**外**に置く。
- **理由**: Next.js の `redirect()` は `NEXT_REDIRECT` 例外で実装されており、`try/catch` で汎用エラー処理をしていると握りつぶされる。セッション失効時に「失敗しました」表示のままログインに戻れないバグになった（実際に発生し修正）。

## 2. トークン・シークレット管理

### 2-1. サービスアカウント・長期鍵を使わない
- **対策**: 外部API（Google Sheets）へのアクセスは**ログインユーザー自身のOAuthアクセストークン**で行う。サービスアカウントのJSON鍵などの長期クレデンシャルをサーバーに置かない。
- **理由**: 長期鍵は漏洩時の影響が大きく、ローテーションも手動。ユーザートークン方式なら権限は本人のスコープ内に限定され、失効も自動。

### 2-2. リフレッシュトークンの取得と自動更新
- **対策**: `access_type: "offline"` + `prompt: "consent"` で確実にrefresh tokenを取得し、JWTコールバックで有効期限の60秒前からの自動リフレッシュを実装。リフレッシュ失敗は `error: "RefreshTokenError"` としてセッションに伝搬し、再ログインへ誘導。
- **実装ポイント**:
  - Googleはリフレッシュ時に新しいrefresh_tokenを返さないことがあるため、`data.refresh_token ?? token.refresh_token` でフォールバックする。
  - **GCPのOAuth同意画面を「テスト中」から「本番」に切り替える**こと。テストモードのままだとrefresh tokenが7日で失効する。

### 2-3. アクセストークンのブラウザ露出を遮断
- **対策**: `/api/auth/session` のGETハンドラをラップし、レスポンスJSONから `accessToken` を削除してからブラウザに返す。
- **理由**: Auth.jsの `session` コールバックでトークンをSessionに載せると、サーバーコードだけでなく `/api/auth/session` 経由でブラウザにも届いてしまう。XSSが起きた場合のトークン窃取面を縮小する多層防御。
- **実装ポイント**:
  - サーバーコードの `auth()` はHTTPを経由せずAuth.jsコアを直接呼ぶため影響なし。
  - Set-Cookie（リフレッシュ済みトークンの永続化）は保持しつつ本文だけ差し替える。`content-length` ヘッダの削除を忘れない。
  - **ログイン済みブラウザで実際に `accessToken` が消えていることを確認**する（user/expiresのみ返る状態）。

### 2-4. 同一リクエスト内のトークン処理を一本化
- **対策**: `requireAccessToken()` を React の `cache()` で包む。
- **理由**: 1リクエスト内で複数のデータ関数が並列に `auth()` を呼ぶと、トークン失効時に**二重リフレッシュ**が走り、片方のrefresh tokenが無効化される競合が起きうる。

### 2-5. 環境変数ファイルの多重保護
- **対策**: `.env` / `.env.local` / `.dev.vars` / `secrets/` を以下の3層で保護:
  1. `.gitignore`（`.env*`、`*.pem`、`.dev.vars`）— コミット防止
  2. `.dockerignore`（`.env`、`.env.*`、`secrets/`、`*.pem`、`*.key`）— イメージ混入防止
  3. `.claude/settings.json` のサンドボックス `denyRead`（`./.env`、`./secrets`）— **AIコーディングエージェントからの読み取り防止**
- **実装ポイント**: AIエージェントを使う開発では3層目が重要。エージェントがログや出力に秘密情報を含めてしまう事故を仕組みで防ぐ。この保護設定を変更しないことをプロジェクトルール（CLAUDE.md）に明記する。

### 2-6. 本番シークレットの管理（Cloudflare Workers）
- **対策**: 本番のシークレットは `wrangler secret put` で登録し、`wrangler.jsonc` の `vars`（平文・リポジトリにコミットされる）には置かない。`AUTH_SECRET` は**本番用に新規生成**し、開発用と共用しない。
- **関連**: Cloudflare認証は `wrangler login`（OAuth）ではなく**最小権限のAPIトークン**（「Edit Cloudflare Workers」テンプレート）を使用。トークンは `.env` に置き、上記の多重保護でカバーする。

## 3. インジェクション対策

### 3-1. スプレッドシート数式インジェクション
- **対策**: シートへ書き込む自由入力文字列（支払先・備考・品名など）に `escapeCellText()` を適用:
  ```ts
  function escapeCellText(value: string): string {
    return /^[=+\-@']/.test(value) ? `'${value}` : value;
  }
  ```
- **理由**: Sheets APIの書き込みを `USER_ENTERED`（日付・数値のパースに必要）で行うと、`=` `+` `-` `@` で始まる値が**数式として評価**される。悪意ある入力で `=IMPORTXML(...)` などによるデータ流出が可能になる（CSV/シートインジェクション）。
- **実装ポイント**:
  - 先頭に `'` を前置するとテキスト扱いになる。`'` はシート表示にもAPIの読み返し値にも含まれないため、**往復で原文が保たれる**。先頭が `'` の値も二重化して原文を保つ。
  - 日付・数値・正規化済みの年月など「パースさせたい値」はエスケープ対象外にする（全部エスケープすると機能が壊れる）。

### 3-2. サーバー側バリデーション
- **対策**: 入力フォームのクライアント側制御（欄の表示/非表示など）に頼らず、Server Action側でも仕様準拠のバリデーションを行う（出金→支払先必須、出金・チャージ→支払方法必須、クレジット→引落年月必須など）。
- **理由**: Server ActionはHTTPエンドポイントであり、UIを迂回して直接叩ける。

## 4. HTTPセキュリティヘッダ

- **対策**: `next.config.ts` の `headers()` で全パス（`/:path*`）に付与:
  - `Content-Security-Policy: frame-ancestors 'none'` — クリックジャッキング対策
  - `X-Frame-Options: DENY` — frame-ancestors非対応の旧ブラウザ用フォールバック
  - `X-Content-Type-Options: nosniff` — MIMEスニッフィング防止
  - `Referrer-Policy: strict-origin-when-cross-origin` — URL情報の漏洩抑制
- **実装ポイント**: ヘッダが**全レスポンス種別**（通常ページ・リダイレクト・APIルート・404）に付くことを、**本番相当のランタイムでも** curl で確認する。今回はNode（`npm run start`）とworkerd（`npm run preview`）の両方で確認した。アダプタ（OpenNext等）を挟む構成では、next.configの設定が実際に適用されるかは検証しないと分からない。

## 5. 攻撃面の縮小

- **デバッグ用ルートの削除**: シート構成確認用に作った一時ルート（`/api/debug/sheets`）は、用が済んだら即削除する。
- **未使用ファイルの削除**: public/ の未使用テンプレートファイル、用途を終えた `instrumentation.ts` などを削除。
- **ID生成に暗号論的乱数**: レコードIDは `crypto.getRandomValues`（Web Crypto）で生成（`Math.random` を使わない）。
- **依存の最小化**: `googleapis`（204MB・全API面参照）を素の `fetch` によるREST呼び出しに置換。バンドルサイズ対策が主目的だが、依存が減ることはサプライチェーンリスクの縮小でもある。

## 6. 検証・運用プラクティス

- **本番データを検証に使わない**: 追加・編集・削除の検証は本番スプレッドシートの**コピー**に対して行う（`SPREADSHEET_ID` を差し替え）。ローカルの `.env.local` / `.dev.vars` は常に検証用コピーを指し、本番IDは `wrangler secret` のみに存在させる。
- **セキュリティ対策は「実測で確認」までがワンセット**:
  - 許可リスト外アカウントの拒否 → 本番で実測
  - セキュリティヘッダ → 全レスポンス種別 × 両ランタイムで curl 確認
  - accessToken 非露出 → ログイン済みブラウザで確認
- **既知の許容リスクを文書に残す**: 対応しないと決めたリスク（例: 行番号ベースの更新は同時編集で行ズレの可能性 → 利用者2人規模なら実害小）は、判断理由とともに計画書に明記する。

## 対象プロジェクトの構成（参考）

- Next.js 16 (App Router) / React 19 / TypeScript / Tailwind 4
- Auth.js (NextAuth) v5 + Google OAuth
- データストア: Google スプレッドシート（Sheets API v4、ユーザートークンでアクセス）
- デプロイ: Cloudflare Workers（`@opennextjs/cloudflare`）
- 開発環境: Docker コンテナ内で Claude Code を使用（サンドボックス denyRead 設定あり）
