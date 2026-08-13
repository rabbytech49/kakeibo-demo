@AGENTS.md

# kakeibo プロジェクトルール
- 実装計画と引き継ぎ内容は `docs/plan.md` を参照すること（git管理外のローカル専用ファイル）
- コーディング・コマンド実行（`npm install` 含む）はすべてコンテナ内で行う
- `.claude/settings.json` のサンドボックス設定（`.env`・`secrets` のdenyRead）を変更しないこと
- データ層はインメモリのデモストア（`lib/store.ts`。コールドスタートで `lib/seed.ts` のシードに戻る）
