# Document Governance Spec
Trigger: docs/**, src/**, server/**
Last updated: 2026-04-13

## 目的
AI コード読解チュータ開発におけるドキュメントを「インフラ」として扱い、漏れを防ぎつつ三層構造で運用する。
- Tier 1 (hot): `CLAUDE.md` — 常時ロード。最小ルールと索引。
- Tier 2 (warm/on-demand): `docs/specs/` — トリガーに応じて読む技術仕様。
- Tier 3 (cold/context): `docs/adr/` — なぜそう決めたかを残す意思決定記録。

## 運用ルール
- 仕様変更や設計変更を伴う作業では、該当 spec/ADR を更新し `Last updated:` を書き換える。
- 1 セッション 1 リビジョンが前提。説明は必ず evidence に紐づける（`publish_explanation_turn`）。
- read-only 方針: モデルに write/edit/bash を渡さない。
- ローカルホストのみ。外部ネットワークは LLM プロバイダ以外禁止。

## フックとタスク漏れ防止
- `scripts/doc-hooks/doc-reminder.mjs` を使い、変更ファイルに対応する spec を開く。
  - 例: `git diff --name-only | xargs node scripts/doc-hooks/doc-reminder.mjs --files`
- `scripts/doc-hooks/ensure-doc-check.mjs` を `npm run doc-check` として定義。`serve:frontend`/`serve:backend`/`check` もこの script を先行させているため、リマインダーは常に実行される。
- トリガー定義は `docs/specs/triggers.json` で管理（パスパターン → 推奨 spec）。
- ドキュメントドリフト検知（将来対応）: 変更ファイルと spec の最終更新日を突き合わせ、stale を警告する。

## 三層構造の具体
- Tier 1 (熱): CLAUDE.md — 200 行以内、索引、最低限のルール。
- Tier 2 (温): 各 spec は単一テーマに限定し、Trigger ヘッダを必須とする。
- Tier 3 (冷): ADR テンプレートに従い、意思決定の文脈を記録。

## 参照
- ADR: `docs/adr/001-doc-governance.md` — 三層構造採用の決定。
- 設計: `docs/design/ai-code-reading-tutor.md`
- 計画: `docs/plans/local-readonly-poc.md`
- 論文: `/Users/tanabe.nobuyuki/Downloads/2602.20478v1.pdf` (*Codified Context: Infrastructure for AI Agents in a Complex Codebase*)
  - ホット/コールドメモリ分離、トリガーテーブルによる自動ルーティング、仕様を AI 消費向けに書く、ドリフト検知 hook のアイデアを採用。
